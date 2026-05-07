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

  socket.on('queue:join', async ({ entryFee, category = 'all' }) => {
    console.log(`SERVER RECEIVED queue:join: userId=${userId} fee=${entryFee} socketId=${socket.id}`);
    console.log(`SERVER: queue:join received from ${userId} with fee ${entryFee} category ${category}`);
    try {
      if (!VALID_FEES.includes(Number(entryFee))) {
        return socket.emit('queue:error', {
          message: `Invalid entry fee. Valid: ${VALID_FEES.join(', ')}`,
        });
      }

      const existingQueue = await redisClient.get(`user:${userId}:queue`);
      if (existingQueue) {
        // Clear stale queue entry — don't block the user
        await redisClient.zrem(`queue:${existingQueue}`, userId);
        await redisClient.del(`user:${userId}:queue`);
      }

      // Check hearts
      try {
        const heartsResult = await pool.query(
          `SELECT hearts, hearts_reset_at, is_premium FROM users WHERE id = $1`,
          [userId]
        );
        const userData = heartsResult.rows[0];

        if (userData && !userData.is_premium) {
          if (userData.hearts_reset_at && new Date() > new Date(userData.hearts_reset_at)) {
            await pool.query(
              `UPDATE users SET hearts = 3, hearts_reset_at = NULL, consecutive_losses = 0 WHERE id = $1`,
              [userId]
            );
          } else if ((userData.hearts ?? 3) <= 0) {
            const resetTime = new Date(userData.hearts_reset_at);
            const hoursLeft = Math.ceil((resetTime - Date.now()) / (1000 * 60 * 60));
            return socket.emit('queue:error', {
              message: `No hearts remaining. Play again in ${hoursLeft} hour(s).`,
              heartsEmpty: true,
              resetAt: userData.hearts_reset_at,
            });
          }
        }
      } catch (heartsErr) {
        // Don't block queue join if hearts check fails
        logger.warn('Hearts check failed', { userId, error: heartsErr.message });
      }

      // Check wallet balance
      const walletResult = await pool.query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [userId]
      );
      if (!walletResult.rows[0] || parseFloat(walletResult.rows[0].balance) < entryFee) {
        return socket.emit('queue:error', { message: 'Insufficient balance' });
      }

      const timestamp = Date.now();
      await redisClient.zadd(`queue:${entryFee}`, timestamp, userId);
      await redisClient.set(`user:${userId}:queue`, String(entryFee), 'EX', 120);
      await redisClient.set(`user:${userId}:username`, username, 'EX', 120);
      await redisClient.set(`user:${userId}:category`, category, 'EX', 120);

      const rank = await redisClient.zrank(`queue:${entryFee}`, userId);

      socket.emit('queue:joined', {
        entryFee,
        position: (rank ?? 0) + 1,
        message: 'Looking for opponent...',
      });

      logger.info('User joined queue', { userId, username, entryFee, category });

      // Try to create match immediately
      await tryCreateMatch(io, entryFee);

    } catch (err) {
      logger.error('queue:join error', { userId, error: err.message });
      socket.emit('queue:error', { message: 'Failed to join queue. Try again.' });
    }
  });

  socket.on('queue:leave', async () => {
    try {
      const queueFee = await redisClient.get(`user:${userId}:queue`);
      if (queueFee) {
        await redisClient.zrem(`queue:${queueFee}`, userId);
        await redisClient.del(`user:${userId}:queue`);
      }
      await redisClient.del(`user:${userId}:username`);
      await redisClient.del(`user:${userId}:category`);
      socket.emit('queue:left', { message: 'Left the queue' });
    } catch (err) {
      logger.error('queue:leave error', { userId, error: err.message });
    }
  });
};

const tryCreateMatch = async (io, entryFee) => {
  const queueKey = `queue:${entryFee}`;

   const keyType = await redisClient.type(queueKey);
  if (keyType !== 'none' && keyType !== 'zset') {
    console.warn(`WORKER: queue key ${queueKey} has wrong type ${keyType} — deleting`);
    await redisClient.del(queueKey);
    return null;
  }

  const queueLength = await redisClient.zcard(queueKey);
  console.log(`WORKER: fee=${entryFee} queueLength=${queueLength}`); // ADD THIS

  if (queueLength < 2) return null;

  const players = await redisClient.zrange(queueKey, 0, 1);
  console.log(`WORKER: players found:`, players); // ADD THIS
  if (!players || players.length < 2) return null;

  const [playerAId, playerBId] = players;

  // Prevent matching a player with themselves
  if (playerAId === playerBId) {
    await redisClient.zrem(queueKey, playerAId);
    return null;
  }

  // Remove from queue immediately to prevent double matching
  await redisClient.zrem(queueKey, playerAId);
  await redisClient.zrem(queueKey, playerBId);
  await redisClient.del(`user:${playerAId}:queue`);
  await redisClient.del(`user:${playerBId}:queue`);

  // Get category preference
  const categoryA = await redisClient.get(`user:${playerAId}:category`) || 'all';

  // Pick difficulty based on entry fee
  const difficulty = entryFee <= 25 ? 'easy' : entryFee <= 100 ? 'medium' : 'hard';

  // Build problem query
  const problemQuery = categoryA !== 'all'
    ? `SELECT id, title, description, time_limit_seconds, test_cases
       FROM problems
       WHERE difficulty = $1 AND is_active = true AND category = $2
       ORDER BY RANDOM() LIMIT 1`
    : `SELECT id, title, description, time_limit_seconds, test_cases
       FROM problems
       WHERE difficulty = $1 AND is_active = true
       ORDER BY RANDOM() LIMIT 1`;

  const problemParams = categoryA !== 'all'
    ? [difficulty, categoryA]
    : [difficulty];

  const problemResult = await pool.query(problemQuery, problemParams);

  // No problem found — put players back and abort
  if (!problemResult.rows[0]) {
    logger.error('No problems found', { difficulty, category: categoryA });
    await redisClient.zadd(queueKey, Date.now(), playerAId);
    await redisClient.zadd(queueKey, Date.now(), playerBId);
    await redisClient.set(`user:${playerAId}:queue`, String(entryFee), 'EX', 120);
    await redisClient.set(`user:${playerBId}:queue`, String(entryFee), 'EX', 120);
    io.to(`user:${playerAId}`).emit('queue:error', {
      message: 'No problems available for this category. Try "All".',
    });
    io.to(`user:${playerBId}`).emit('queue:error', {
      message: 'No problems available for this category. Try "All".',
    });
    return null;
  }

  const problem = problemResult.rows[0];
  const matchId = uuidv4();
  const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || 10) / 100;
  const prizePool = parseFloat(entryFee) * 2 * (1 - platformFeePercent);
  const platformFee = parseFloat(entryFee) * 2 * platformFeePercent;

  // Create match + lock funds atomically
  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO matches
           (id, player_a_id, player_b_id, problem_id, entry_fee, prize_pool, platform_fee, status, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PROGRESS', NOW())`,
        [matchId, playerAId, playerBId, problem.id, entryFee, prizePool, platformFee]
      );
      await lockFundsForMatch(playerAId, parseFloat(entryFee), matchId, client);
      await lockFundsForMatch(playerBId, parseFloat(entryFee), matchId, client);
    });
  } catch (txErr) {
    logger.error('Match transaction failed', { error: txErr.message });
    // Refund queue positions
    await redisClient.zadd(queueKey, Date.now(), playerAId);
    await redisClient.zadd(queueKey, Date.now(), playerBId);
    await redisClient.set(`user:${playerAId}:queue`, String(entryFee), 'EX', 120);
    await redisClient.set(`user:${playerBId}:queue`, String(entryFee), 'EX', 120);
    return null;
  }

  // Start timer
  const timer = await startMatchTimer(matchId);

  // Store match state
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
  await redisClient.set(
    `match:${matchId}:state`,
    JSON.stringify(matchState),
    'EX', 7200
  );

  await setActiveMatch(playerAId, matchId);
  await setActiveMatch(playerBId, matchId);

  const playerAUsername = await redisClient.get(`user:${playerAId}:username`) || 'Player A';
  const playerBUsername = await redisClient.get(`user:${playerBId}:username`) || 'Player B';

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

  // Emit match:ready to both players
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
    problem: problem.title, difficulty, category: categoryA,
  });

  // Force-join both players to match room using their socket connections
  setTimeout(async () => {
    try {
      const socketIdA = await redisClient.get(`presence:${playerAId}`);
      const socketIdB = await redisClient.get(`presence:${playerBId}`);

      if (socketIdA) {
        const socketA = io.sockets.sockets.get(socketIdA);
        if (socketA) {
          socketA.join(`match:${matchId}`);
          logger.info('Force-joined playerA to match room', { matchId });
        }
      }

      if (socketIdB) {
        const socketB = io.sockets.sockets.get(socketIdB);
        if (socketB) {
          socketB.join(`match:${matchId}`);
          logger.info('Force-joined playerB to match room', { matchId });
        }
      }
    } catch (err) {
      logger.error('Force-join error', { matchId, error: err.message });
    }
  }, 1000);

  // Auto-resolve when timer expires
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

    const scoreA = parseFloat(
      await redisClient.get(`match:${matchId}:score:${matchState.playerAId}`) || '0'
    );
    const scoreB = parseFloat(
      await redisClient.get(`match:${matchId}:score:${matchState.playerBId}`) || '0'
    );
    const timeA = parseInt(
      await redisClient.get(`match:${matchId}:time:${matchState.playerAId}`) || '999999'
    );
    const timeB = parseInt(
      await redisClient.get(`match:${matchId}:time:${matchState.playerBId}`) || '999999'
    );

    let winnerId, loserId;

    if (scoreA > scoreB) {
      winnerId = matchState.playerAId;
      loserId = matchState.playerBId;
    } else if (scoreB > scoreA) {
      winnerId = matchState.playerBId;
      loserId = matchState.playerAId;
    } else {
      if (timeA === 999999 && timeB === 999999) {
        winnerId = matchState.playerAId;
        loserId = matchState.playerBId;
      } else {
        winnerId = timeA <= timeB ? matchState.playerAId : matchState.playerBId;
        loserId = winnerId === matchState.playerAId
          ? matchState.playerBId
          : matchState.playerAId;
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