const { redisClient } = require('../config/redis');
const { pool } = require('../config/db');
const { getMatchTimer } = require('./timerService');
const { clearActiveMatch } = require('./presenceService');
const { releaseEscrowToWinner, refundBothPlayers } = require('../services/walletService');
const { evaluateCode } = require('../services/judgeService');
const logger = require('../utils/logger');

const matchHandler = (io, socket) => {
  const { id: userId } = socket.user;

  socket.on('match:join', async ({ matchId }) => {
    try {
      const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
      if (!matchStateRaw) return socket.emit('match:error', { message: 'Match not found' });
      const matchState = JSON.parse(matchStateRaw);
      if (matchState.playerAId !== userId && matchState.playerBId !== userId) {
        return socket.emit('match:error', { message: 'You are not in this match' });
      }
      socket.join(`match:${matchId}`);
      const timer = await getMatchTimer(matchId);
      socket.emit('match:timer_sync', { matchId, ...timer, serverTs: Date.now() });
      socket.to(`match:${matchId}`).emit('match:opponent_status', { status: 'connected', userId });
      logger.info('Player joined match room', { userId, matchId });
    } catch (err) {
      logger.error('match:join error', { userId, error: err.message });
    }
  });

  socket.on('match:timer_request', async ({ matchId }) => {
    try {
      const timer = await getMatchTimer(matchId);
      if (!timer) return;
      socket.emit('match:timer_sync', { matchId, ...timer, serverTs: Date.now() });
    } catch (err) {
      logger.error('match:timer_request error', { userId, error: err.message });
    }
  });

  // ── code:run — public test cases only, does not lock submission ──
  socket.on('code:run', async ({ matchId, language, code }) => {
    try {
      const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
      if (!matchStateRaw) return socket.emit('match:error', { message: 'Match not found' });
      const matchState = JSON.parse(matchStateRaw);
      if (matchState.status !== 'IN_PROGRESS') {
        return socket.emit('match:error', { message: 'Match is not in progress' });
      }
      const timer = await getMatchTimer(matchId);
      if (!timer || timer.isExpired) return socket.emit('match:error', { message: 'Time is up' });

      socket.emit('match:run_started', { matchId, message: 'Running against sample test cases...' });

      const problemResult = await pool.query(
        `SELECT test_cases FROM problems
         WHERE id = (SELECT problem_id FROM matches WHERE id = $1)`,
        [matchId]
      );
      if (!problemResult.rows[0]) return socket.emit('match:error', { message: 'Problem not found' });

      const allTestCases = problemResult.rows[0].test_cases || [];
      const publicTestCases = allTestCases.filter(tc => tc.is_public);

      if (publicTestCases.length === 0) {
        return socket.emit('match:run_result', { matchId, results: [], message: 'No sample test cases' });
      }

      const { executeCode } = require('../services/judgeService');
      const normalize = (str) => str?.trim().replace(/\r\n/g, '\n') || '';
      const results = [];

      for (let i = 0; i < publicTestCases.length; i++) {
        const tc = publicTestCases[i];
        const startTime = Date.now();
        let result;
        try {
          result = await executeCode(language, code, tc.input);
        } catch (err) {
          results.push({ index: i + 1, input: tc.input, expected: tc.expected_output, actual: '', passed: false, error: err.message, timeMs: 0 });
          continue;
        }
        const elapsed = Date.now() - startTime;
        const actualOutput = normalize(result.stdout);
        const expectedOutput = normalize(tc.expected_output);
        const passed = actualOutput === expectedOutput;
        results.push({ index: i + 1, input: tc.input, expected: expectedOutput, actual: actualOutput, passed, error: result.stderr || null, timeMs: elapsed });
      }

      const passedCount = results.filter(r => r.passed).length;
      socket.emit('match:run_result', { matchId, results, passedCount, totalCount: results.length, message: `${passedCount}/${results.length} sample tests passed` });
    } catch (err) {
      logger.error('code:run error', { userId, matchId, error: err.message });
      socket.emit('match:error', { message: 'Run failed. Try again.' });
    }
  });

  // ── code:submit — all test cases, locks answer ───────────────────
  socket.on('code:submit', async ({ matchId, language, code }) => {
    try {
      const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
      if (!matchStateRaw) return socket.emit('match:error', { message: 'Match no