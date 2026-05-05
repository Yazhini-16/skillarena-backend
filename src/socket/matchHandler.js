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
      if (!matchStateRaw) return socket.emit('match:error', { message: 'Match not found' });
      const matchState = JSON.parse(matchStateRaw);
      if (matchState.status !== 'IN_PROGRESS') {
        return socket.emit('match:error', { message: 'Match is not in progress' });
      }
      const timer = await getMatchTimer(matchId);
      if (!timer || timer.isExpired) return socket.emit('match:error', { message: 'Time is up' });

      const submissionKey = `match:${matchId}:submitted:${userId}`;
      const alreadySubmitted = await redisClient.set(submissionKey, '1', 'EX', 7200, 'NX');
      if (!alreadySubmitted) return socket.emit('match:error', { message: 'Already submitted' });

      socket.emit('match:submission_received', { matchId, message: 'Submission received. Evaluating...' });
      socket.to(`match:${matchId}`).emit('match:opponent_status', { status: 'submitted', userId, message: 'Opponent submitted' });

      const startTs = await redisClient.get(`match:${matchId}:start_ts`);
      const submissionTimeMs = Date.now() - parseInt(startTs);
      await redisClient.set(`match:${matchId}:time:${userId}`, submissionTimeMs, 'EX', 7200);

      await pool.query(
        `INSERT INTO submissions (match_id, user_id, language, code, status)
         VALUES ($1, $2, $3, $4, 'PENDING') ON CONFLICT (match_id, user_id) DO NOTHING`,
        [matchId, userId, language, code]
      );

      const matchResult = await pool.query('SELECT problem_id FROM matches WHERE id = $1', [matchId]);
      const problemId = matchResult.rows[0]?.problem_id;

      if (!problemId) {
        const ms = JSON.parse(await redisClient.get(`match:${matchId}:state`) || '{}');
        if (ms.playerAId) {
          await refundBothPlayers(ms.playerAId, ms.playerBId, ms.entryFee, matchId);
          io.to(`match:${matchId}`).emit('match:error', { message: 'No problem assigned. Both refunded.' });
        }
        return;
      }

      socket.emit('match:evaluating', { matchId, message: 'Running against all test cases including hidden ones...' });

      const evalResult = await evaluateCode(matchId, userId, language, code, problemId);

      if (evalResult.status === 'JUDGE_ERROR') {
        const ms = JSON.parse(await redisClient.get(`match:${matchId}:state`) || '{}');
        if (ms.playerAId) {
          await refundBothPlayers(ms.playerAId, ms.playerBId, ms.entryFee, matchId);
          await pool.query(`UPDATE matches SET status = 'CANCELLED' WHERE id = $1`, [matchId]);
          io.to(`match:${matchId}`).emit('match:error', { message: 'Evaluation error. Both refunded.' });
        }
        return;
      }

      await redisClient.set(`match:${matchId}:score:${userId}`, evalResult.score, 'EX', 7200);

      const judgeStatus = evalResult.score === 100 ? 'ACCEPTED' : evalResult.score > 0 ? 'PARTIAL' : 'WRONG_ANSWER';
      await pool.query(
        `UPDATE submissions SET status = $1, test_cases_passed = $2, test_cases_total = $3, execution_time_ms = $4
         WHERE match_id = $5 AND user_id = $6`,
        [judgeStatus, evalResult.passed, evalResult.total, evalResult.avgTimeMs, matchId, userId]
      );

      socket.emit('match:evaluation_result', {
        matchId,
        score: evalResult.score,
        passed: evalResult.passed,
        total: evalResult.total,
        status: judgeStatus,
        executionTimeMs: evalResult.avgTimeMs,
        compileError: evalResult.compileError || null,
        message: evalResult.score === 100
          ? `✓ All ${evalResult.total} test cases passed!`
          : evalResult.score > 0
          ? `${evalResult.passed}/${evalResult.total} test cases passed`
          : evalResult.compileError ? 'Runtime error in your code' : 'Wrong answer',
      });

      const scoreA = await redisClient.get(`match:${matchId}:score:${matchState.playerAId}`);
      const scoreB = await redisClient.get(`match:${matchId}:score:${matchState.playerBId}`);

      if (scoreA !== null && scoreB !== null) {
        await determineAndResolveWinner(io, matchId, matchState);
      } else {
        socket.emit('match:waiting_opponent', { matchId, message: 'Waiting for opponent to submit...' });
      }
    } catch (err) {
      logger.error('code:submit error', { userId, matchId, error: err.message });
      socket.emit('match:error', { message: 'Submission failed. Try again.' });
    }
  });

  // ── match:forfeit_request — tab switch or manual forfeit ─────────
  socket.on('match:forfeit_request', async ({ matchId, reason }) => {
    try {
      const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
      if (!matchStateRaw) return;
      const matchState = JSON.parse(matchStateRaw);
      if (matchState.status !== 'IN_PROGRESS') return;

      const winnerId = matchState.playerAId === userId
        ? matchState.playerBId
        : matchState.playerAId;

      io.to(`match:${matchId}`).emit('match:forfeit', {
        matchId, forfeitedBy: userId, winnerId, reason,
        message: reason === 'tab_switch'
          ? 'Opponent forfeited — tab switching detected'
          : 'Opponent forfeited',
      });

      await resolveMatch(io, matchId, winnerId, userId, 'FORFEIT');
    } catch (err) {
      logger.error('forfeit_request error', { userId, matchId, error: err.message });
    }
  });

  socket.on('match:leave', async ({ matchId }) => {
    socket.leave(`match:${matchId}`);
    socket.to(`match:${matchId}`).emit('match:opponent_status', { status: 'disconnected', userId });
  });
};

// ── Winner determination — score is ALWAYS primary ────────────────
const determineAndResolveWinner = async (io, matchId, matchState) => {
  const scoreA = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerAId}`) || '0');
  const scoreB = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerBId}`) || '0');
  const timeA = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerAId}`) || '999999');
  const timeB = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerBId}`) || '999999');

  let winnerId, loserId;

  if (scoreA > scoreB) {
    winnerId = matchState.playerAId; loserId = matchState.playerBId;
  } else if (scoreB > scoreA) {
    winnerId = matchState.playerBId; loserId = matchState.playerAId;
  } else {
    // Equal scores — faster submission wins
    winnerId = timeA <= timeB ? matchState.playerAId : matchState.playerBId;
    loserId = winnerId === matchState.playerAId ? matchState.playerBId : matchState.playerAId;
  }

  logger.info('Winner determined', { matchId, winnerId, scoreA, scoreB, timeA, timeB });
  await resolveMatch(io, matchId, winnerId, loserId, 'COMPLETED');
};

// ── Final match resolution with hearts system ─────────────────────
const resolveMatch = async (io, matchId, winnerId, loserId, resolveType = 'COMPLETED') => {
  try {
    const alreadyResolved = await redisClient.get(`match:${matchId}:resolved`);
    if (alreadyResolved) return;
    await redisClient.set(`match:${matchId}:resolved`, '1', 'EX', 7200);

    const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
    if (!matchStateRaw) return;
    const matchState = JSON.parse(matchStateRaw);
    matchState.status = 'COMPLETED';
    await redisClient.set(`match:${matchId}:state`, JSON.stringify(matchState), 'EX', 7200);

    // Payout
    const { netPrize, platformFee } = await releaseEscrowToWinner(
      winnerId, loserId, matchState.entryFee, matchId
    );

    const scoreA = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerAId}`) || '0');
    const scoreB = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerBId}`) || '0');
    const timeA = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerAId}`) || '0');
    const timeB = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerBId}`) || '0');

    await pool.query(
      `UPDATE matches SET status = 'COMPLETED', winner_id = $1,
       player_a_score = $2, player_b_score = $3,
       player_a_time_ms = $4, player_b_time_ms = $5, completed_at = NOW()
       WHERE id = $6`,
      [winnerId, scoreA, scoreB, timeA, timeB, matchId]
    );

    // ── Hearts system — runs inside resolveMatch (async context) ──
    try {
      // Handle loser hearts
      const loserResult = await pool.query(
        `SELECT consecutive_losses, hearts, is_premium FROM users WHERE id = $1`,
        [loserId]
      );
      const loser = loserResult.rows[0];

      if (loser && !loser.is_premium) {
        const newConsecutiveLosses = (loser.consecutive_losses || 0) + 1;
        const newHearts = Math.max(0, (loser.hearts ?? 3) - 1);
        const heartsResetAt = newHearts === 0
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : null;

        await pool.query(
          `UPDATE users SET
             consecutive_losses = $1,
             hearts = $2,
             hearts_reset_at = CASE WHEN $3::timestamptz IS NOT NULL THEN $3::timestamptz ELSE hearts_reset_at END
           WHERE id = $4`,
          [newConsecutiveLosses, newHearts, heartsResetAt, loserId]
        );
      }

      // Reset winner hearts
      await pool.query(
        `UPDATE users SET
           consecutive_losses = 0,
           hearts = LEAST(COALESCE(hearts, 3) + 1, 3),
           hearts_reset_at = NULL
         WHERE id = $1`,
        [winnerId]
      );
    } catch (heartsErr) {
      // Don't fail the match if hearts update fails
      logger.error('Hearts update error', { matchId, error: heartsErr.message });
    }

    // Update player stats
    await pool.query(
      `UPDATE users SET matches_played = matches_played + 1,
       matches_won = matches_won + 1, skill_rating = skill_rating + 25
       WHERE id = $1`, [winnerId]
    );
    await pool.query(
      `UPDATE users SET matches_played = matches_played + 1,
       skill_rating = GREATEST(skill_rating - 15, 0) WHERE id = $1`, [loserId]
    );

    await clearActiveMatch(winnerId);
    await clearActiveMatch(loserId);

    const walletResult = await pool.query(
      'SELECT balance FROM wallets WHERE user_id = $1', [winnerId]
    );

    io.to(`match:${matchId}`).emit('match:result', {
      matchId, resolveType, winnerId, loserId, netPrize, platformFee,
      scores: { [matchState.playerAId]: scoreA, [matchState.playerBId]: scoreB },
      times: { [matchState.playerAId]: timeA, [matchState.playerBId]: timeB },
      winnerNewBalance: walletResult.rows[0]?.balance || 0,
    });

    logger.info('Match resolved', { matchId, winnerId, netPrize, resolveType });

  } catch (err) {
    logger.error('resolveMatch error', { matchId, error: err.message });
    try {
      const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
      if (matchStateRaw) {
        const matchState = JSON.parse(matchStateRaw);
        await refundBothPlayers(matchState.playerAId, matchState.playerBId, matchState.entryFee, matchId);
        io.to(`match:${matchId}`).emit('match:error', { message: 'Match resolution failed. Both refunded.' });
      }
    } catch (refundErr) {
      logger.error('Refund failed', { matchId, error: refundErr.message });
    }
  }
};

module.exports = matchHandler;
module.exports.resolveMatch = resolveMatch;