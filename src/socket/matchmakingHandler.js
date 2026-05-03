const { redisClient } = require('../config/redis');
const { pool, withTransaction } = require('../config/db');
const { lockFundsForMatch } = require('../services/walletService');
const { startMatchTimer } = require('./timerService');
const { setActiveMatch } = require('./presenceService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const VALID_FEES = [10, 25, 50, 100, 200, 500];

const matchmakingHandler = (io, socket) => {
  const { id: userId, username } = socket.user;

  socket.on('queue:join', async ({ entryFee }) => {
    console.log(`SERVER: queue:join received from ${userId} with fee ${entryFee}`);
    try {
      if (!VALID_FEES.includes(Number(entryFee))) {
        return socket.emit('queue:error', { message: `Invalid entry fee. Valid: ${VALID_FEES.join(', ')}` });
      }

      const existingQueue = await redisClient.get(`user:${userId}:queue`);
      if (existingQueue) {
        return socket.emit('queue:error', { message: 'You are already in a queue' });
      }

      const walletResult = await pool.query(
        'SELECT balance FROM wallets WHERE user_id = $1', [userId]
      );
      if (!walletResult.rows[0] || parseFloat(walletResult.rows[0].balance) < entryFee) {
        return socket.emit('queue:error', { message: 'Insufficient balance' });
      }

      const timestamp = Date.now();
      await redisClient.zadd(`queue:${entryFee}`, timestamp, userId);
      await redisClient.set(`user:${userId}:queue`, entryFee, 'EX', 120);
      await redisClient.set(`user:${userId}:username`, username, 'EX', 120);

      const rank = await redisClient.zrank(`queue:${entryFee}`, userId);

      socket.emit('queue:joined', {
        entryFee,
        position: rank + 1,
        message: 'Looking for opponent...',
      });

      logger.info('User joined queue', { userId, username, entryFee });
      await tryCreateMatch(io, entryFee);

    } catch (err) {
      logger.error('queue:join error', { userId, error: err.message });
      socket.emit('queue:error', { message: 'Failed to join queue. Try again.' });
    }
  });

  socket.on('queue:leave', async () => {
    try {
      const queueFee = await redisClient.get(`user:${userId}:queue`);
      if (!queueFee) {
        return socket.emit('queue:error', { message: 'You are not in a queue' });
      }
      await redisClient.zrem(`queue:${queueFee}`, userId);
      await redisClient.del(`user:${userId}:queue`);
      await redisClient.del(`user:${userId}:username`);
      socket.emit('queue:left', { message: 'Left the queue' });
    } catch (err) {
      logger.error('queue:leave error', { userId, error: err.message });
    }
  });
};

const tryCreateMatch = async (io, entryFee) => {
  const queueKey = `queue:${entryFee}`;

  const queueLength = await redisClient.zcard(queueKey);
  if (queueLength < 2) return null;

  const players = await redisClient.zrange(queueKey, 0, 1);
  if (players.length < 2) return null;

  const [playerAId, playerBId] = players;

  // Remove from queue immediately
  await redisClient.zrem(queueKey, playerAId);
  await redisClient.zrem(queueKey, playerBId);
  await redisClient.del(`user:${playerAId}:queue`);
  await redisClient.del(`user:${playerBId}:queue`);

  // Pick problem based on fee tier
  const difficulty = entryFee <= 25 ? 'easy' : entryFee <= 100 ? 'medium' : 'hard';

  const problemResult = await pool.query(
    `SELECT id, title, description, time_limit_seconds, test_cases
     FROM problems
     WHERE difficulty = $1 AND is_active = true
     ORDER BY RANDOM()
     LIMIT 1`,
    [difficulty]
  );

  // Guard: no problem found — put players back in queue and abort
  if (!problemResult.rows[0]) {
    logger.error('No problems found for difficulty — aborting match', { difficulty, entryFee });
    await redisClient.zadd(queueKey, Date.now(), playerAId);
    await redisClient.zadd(queueKey, Date.now(), playerBId);
    await redisClient.set(`user:${playerAId}:queue`, entryFee, 'EX', 120);
    await redisClient.set(`user:${playerBId}:queue`, entryFee, 'EX', 120);

    // Notify both players
    io.to(`user:${playerAId}`).emit('queue:error', {
      message: 'No problems available right now. Please try again.',
    });
    io.to(`user:${playerBId}`).emit('queue:error', {
      message: 'No problems available right now. Please try again.',
    });
    return null;
  }

  const problem = problemResult.rows[0];

  const matchId = uuidv4();
  const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || 10) / 100;
  const prizePool = parseFloat(entryFee) * 2 * (1 - platformFeePercent);
  const platformFee = parseFloat(entryFee) * 2 * platformFeePercent;

  // Create match + lock funds atomically
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO matches (id, player_a_id, player_b_id, problem_id, entry_fee, prize_pool, platform_fee, status, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PROGRESS', NOW())`,
      [matchId, playerAId, playerBId, problem.id, entryFee, prizePool, platformFee]
    );
    await lockFundsForMatch(playerAId, parseFloat(entryFee), matchId, client);
    await lockFundsForMatch(playerBId, parseFloat(entryFee), matchId, client);
  });

  // Start server-authoritative timer
  const timer = await startMatchTimer(matchId);

  // Store match state in Redis
  const matchState = {
    matchId,
    playerAId,
    playerBId,
    entryFee: parseFloat(entryFee),
    prizePool,
    platformFee,
    problemId: problem.id,
    status: 'IN_PROGRESS',
    playerASubmitted: false,
    playerBSubmitted: false,
  };
  await redisClient.set(`match:${matchId}:state`, JSON.stringify(matchState), 'EX', 7200);

  // Track active match per player
  await setActiveMatch(playerAId, matchId);
  await setActiveMatch(playerBId, matchId);

  // Get usernames
  const playerAUsername = await redisClient.get(`user:${playerAId}:username`) || 'Player A';
  const playerBUsername = await redisClient.get(`user:${playerBId}:username`) || 'Player B';

  // Only send public test cases to clients
  const publicTestCases = problem.test_cases
    ? problem.test_cases.filter(tc => tc.is_public)
    : [];

  const matchPayload = {
    matchId,
    entryFee,
    prizePool,
    timer: {
      startTs: timer.startTs,
      endTs: timer.endTs,
      durationMs: timer.durationMs,
    },
    problem: {
      id: problem.id,
      title: problem.title,
      description: problem.description,
      timeLimitSeconds: problem.time_limit_seconds,
      testCases: publicTestCases,
    },
  };

  // Emit match:ready to both players with their own perspective
  io.to(`user:${playerAId}`).emit('match:ready', {
    ...matchPayload,
    you: { id: playerAId, username: playerAUsername },
    opponent: { id: playerBId, username: playerBUsername },
  });

  io.to(`user:${playerBId}`).emit('match:ready', {
    ...matchPayload,
    you: { id: playerBId, username: playerBUsername },
    opponent: { id: playerAId, username: playerAUsername },
  });

  logger.info('Match created and broadcasted', {
    matchId, playerAId, playerBId, entryFee,
    problem: problem.title, difficulty,
  });

  // Schedule auto-resolve when timer expires
  setTimeout(async () => {
    await handleTimerExpiry(io, matchId);
  }, timer.durationMs + 2000);

  return matchId;
};

const handleTimerExpiry = async (io, matchId) => {
  try {
    const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
    if (!matchStateRaw) return;

    const matchState = JSON.parse(matchStateRaw);
    if (matchState.status !== 'IN_PROGRESS') return;

    logger.info('Match timer expired — auto resolving', { matchId });

    const scoreA = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerAId}`) || '0');
    const scoreB = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerBId}`) || '0');
    const timeA = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerAId}`) || '999999');
    const timeB = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerBId}`) || '999999');

    let winnerId, loserId;

    if (scoreA > scoreB) {
      winnerId = matchState.playerAId;
      loserId = matchState.playerBId;
    } else if (scoreB > scoreA) {
      winnerId = matchState.playerBId;
      loserId = matchState.playerAId;
    } else {
      // Tiebreak by submission time — if neither submitted, playerA wins by default
      if (timeA === 999999 && timeB === 999999) {
        winnerId = matchState.playerAId;
        loserId = matchState.playerBId;
      } else {
        winnerId = timeA <= timeB ? matchState.playerAId : matchState.playerBId;
        loserId = winnerId === matchState.playerAId ? matchState.playerBId : matchState.playerAId;
      }
    }

    io.to(`match:${matchId}`).emit('match:time_up', {
      matchId,
      message: "Time's up! Calculating results...",
    });

    const { resolveMatch } = require('./matchHandler');
    await resolveMatch(io, matchId, winnerId, loserId, 'TIME_UP');

  } catch (err) {
    logger.error('Timer expiry error', { matchId, error: err.message });
  }
};

module.exports = matchmakingHandler;
module.exports.tryCreateMatch = tryCreateMatch;