const { redisClient } = require('../config/redis');
const { pool, withTransaction } = require('../config/db');
const { lockFundsForMatch } = require('../services/walletService');
const { startMatchTimer } = require('./timerService');
const { setActiveMatch } = require('./presenceService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const VALID_FEES = [10, 25, 50, 100, 200, 500];

// In-memory queue as primary store — instant, no network latency
// Redis is used for presence and match state only
const memoryQueues = {};
VALID_FEES.forEach(fee => { memoryQueues[fee] = []; });

const matchmakingHandler = (io, socket) => {
  const { id: userId, username } = socket.user;

  socket.on('queue:join', async ({ entryFee, category = 'all' }) => {
    console.log(`SERVER: queue:join received from ${userId} (${username}) fee=${entryFee} category=${category}`);
    try {
      const fee = Number(entryFee);
      if (!VALID_FEES.includes(fee)) {
        return socket.emit('queue:error', { message: `Invalid entry fee` });
      }

      // Check if already in memory queue
      const alreadyInQueue = memoryQueues[fee]?.find(p => p.userId === userId);
      if (alreadyInQueue) {
        // Remove stale entry and re-add
        memoryQueues[fee] = memoryQueues[fee].filter(p => p.userId !== userId);
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
            });
          }
        }
      } catch (heartsErr) {
        logger.warn('Hearts check failed', { userId, error: heartsErr.message });
      }

      // Check wallet
      const walletResult = await pool.query(
        'SELECT balance FROM wallets WHERE user_id = $1', [userId]
      );
      if (!walletResult.rows[0] || parseFloat(walletResult.rows[0].balance) < fee) {
        return socket.emit('queue:error', { message: 'Insufficient balance' });
      }

      // Add to in-memory queue
      memoryQueues[fee].push({
        userId,
        username,
        category,
        joinedAt: Date.now(),
      });

      // Also track in Redis for presence/disconnect handling
      await redisClient.set(`user:${userId}:queue`, String(fee), 'EX', 120);
      await redisClient.set(`user:${userId}:username`, username, 'EX', 120);
      await redisClient.set(`user:${userId}:category`, category, 'EX', 120);

      console.log(`MEMORY QUEUE fee=${fee}: ${memoryQueues[fee].length} players`, memoryQueues[fee].map(p => p.username));

      socket.emit('queue:joined', {
        entryFee: fee,
        position: memoryQueues[fee].length,
        message: 'Looking for opponent...',
      });

      logger.info('User joined queue', { userId, username, entryFee: fee, category });

      // Try to create match immediately
      await tryCreateMatch(io, fee);

    } catch (err) {
      logger.error('queue:join error', { userId, error: err.message });
      socket.emit('queue:error', { message: 'Failed to join queue. Try again.' });
    }
  });

  socket.on('queue:leave', async () => {
    try {
      // Remove from all memory queues
      VALID_FEES.forEach(fee => {
        memoryQueues[fee] = memoryQueues[fee].filter(p => p.userId !== userId);
      });
      await redisClient.del(`user:${userId}:queue`);
      await redisClient.del(`user:${userId}:username`);
      await redisClient.del(`user:${userId}:category`);
      socket.emit('queue:left', { message: 'Left the queue' });
      logger.info('User left queue', { userId });
    } catch (err) {
      logger.error('queue:leave error', { userId, error: err.message });
    }
  });
};

const tryCreateMatch = async (io, entryFee) => {
  const fee = Number(entryFee);
  const queue = memoryQueues[fee];

  console.log(`MATCH CHECK: fee=${fee} queue=${queue?.length} players=${queue?.map(p=>p.username).join(',')}`);

  if (!queue || queue.length < 2) return null;

  // Take first two players
  const playerA = queue.shift();
  const playerB = queue.shift();

  if (!playerA || !playerB) return null;
  if (playerA.userId === playerB.userId) {
    // Same user somehow — put back and abort
    queue.unshift(playerB);
    return null;
  }

  console.log(`CREATING MATCH: ${playerA.username} vs ${playerB.username} fee=${fee}`);

  // Clean up Redis queue tracking
  await redisClient.del(`user:${playerA.userId}:queue`);
  await redisClient.del(`user:${playerB.userId}:queue`);

  const category = playerA.category || 'all';
  const difficulty = fee <= 25 ? 'easy' : fee <= 100 ? 'medium' : 'hard';

  const problemQuery = category !== 'all'
    ? `SELECT id, title, description, time_limit_seconds, test_cases
       FROM problems WHERE difficulty = $1 AND is_active = true AND category = $2
       ORDER BY RANDOM() LIMIT 1`
    : `SELECT id, title, description, time_limit_seconds, test_cases
       FROM problems WHERE difficulty = $1 AND is_active = true
       ORDER BY RANDOM() LIMIT 1`;

  const problemParams = category !== 'all' ? [difficulty, category] : [difficulty];
  const problemResult = await pool.query(problemQuery, problemParams);

  if (!problemResult.rows[0]) {
    logger.error('No problems found', { difficulty, category });
    // Put players back
    queue.unshift(playerB);
    queue.unshift(playerA);
    io.to(`user:${playerA.userId}`).emit('queue:error', {
      message: 'No problems available. Try category "All".',
    });
    io.to(`user:${playerB.userId}`).emit('queue:error', {
      message: 'No problems available. Try category "All".',
    });
    return null;
  }

  const problem = problemResult.rows[0];
  const matchId = uuidv4();
  const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || 10) / 100;
  const prizePool = fee * 2 * (1 - platformFeePercent);
  const platformFee = fee * 2 * platformFeePercent;

  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO matches (id, player_a_id, player_b_id, problem_id, entry_fee, prize_pool, platform_fee, status, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PROGRESS', NOW())`,
        [matchId, playerA.userId, playerB.userId, problem.id, fee, prizePool, platformFee]
      );
      await lockFundsForMatch(playerA.userId, fee, matchId, client);
      await lockFundsForMatch(playerB.userId, fee, matchId, client);
    });
  } catch (txErr) {
    logger.error('Match transaction failed', { error: txErr.message });
    queue.unshift(playerB);
    queue.unshift(playerA);
    return null;
  }

  const timer = await startMatchTimer(matchId);

  const matchState = {
    matchId,
    playerAId: playerA.userId,
    playerBId: playerB.userId,
    entryFee: fee,
    prizePool,
    platformFee,
    problemId: problem.id,
    status: 'IN_PROGRESS',
    playerASubmitted: false,
    playerBSubmitted: false,
  };
  await redisClient.set(`match:${matchId}:state`, JSON.stringify(matchState), 'EX', 7200);

  await setActiveMatch(playerA.userId, matchId);
  await setActiveMatch(playerB.userId, matchId);

  const publicTestCases = problem.test_cases
    ? problem.test_cases.filter(tc => tc.is_public) : [];

  const matchPayload = {
    matchId, entryFee: fee, prizePool,
    timer: { startTs: timer.startTs, endTs: timer.endTs, durationMs: timer.durationMs },
    problem: {
      id: problem.id,
      title: problem.title,
      description: problem.description,
      timeLimitSeconds: problem.time_limit_seconds,
      testCases: publicTestCases,
    },
  };

  io.to(`user:${playerA.userId}`).emit('match:ready', {
    ...matchPayload,
    you: { id: playerA.userId, username: playerA.username },
    opponent: { id: playerB.userId, username: playerB.username },
  });

  io.to(`user:${playerB.userId}`).emit('match:ready', {
    ...matchPayload,
    you: { id: playerB.userId, username: playerB.username },
    opponent: { id: playerA.userId, username: playerA.username },
  });

  logger.info('Match created and broadcasted', {
    matchId, playerA: playerA.username, playerB: playerB.username,
    fee, problem: problem.title,
  });

  // Force join both to match room
  setTimeout(async () => {
    try {
      const socketIdA = await redisClient.get(`presence:${playerA.userId}`);
      const socketIdB = await redisClient.get(`presence:${playerB.userId}`);
      if (socketIdA) {
        const sa = io.sockets.sockets.get(socketIdA);
        if (sa) sa.join(`match:${matchId}`);
      }
      if (socketIdB) {
        const sb = io.sockets.sockets.get(socketIdB);
        if (sb) sb.join(`match:${matchId}`);
      }
    } catch (err) {
      logger.error('Force-join error', { matchId, error: err.message });
    }
  }, 500);

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

    const scoreA = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerAId}`) || '0');
    const scoreB = parseFloat(await redisClient.get(`match:${matchId}:score:${matchState.playerBId}`) || '0');
    const timeA = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerAId}`) || '999999');
    const timeB = parseInt(await redisClient.get(`match:${matchId}:time:${matchState.playerBId}`) || '999999');

    let winnerId, loserId;
    if (scoreA > scoreB) { winnerId = matchState.playerAId; loserId = matchState.playerBId; }
    else if (scoreB > scoreA) { winnerId = matchState.playerBId; loserId = matchState.playerAId; }
    else {
      if (timeA === 999999 && timeB === 999999) {
        winnerId = matchState.playerAId; loserId = matchState.playerBId;
      } else {
        winnerId = timeA <= timeB ? matchState.playerAId : matchState.playerBId;
        loserId = winnerId === matchState.playerAId ? matchState.playerBId : matchState.playerAId;
      }
    }

    io.to(`match:${matchId}`).emit('match:time_up', { matchId, message: "Time's up!" });
    const { resolveMatch } = require('./matchHandler');
    await resolveMatch(io, matchId, winnerId, loserId, 'TIME_UP');
  } catch (err) {
    logger.error('Timer expiry error', { matchId, error: err.message });
  }
};

// Clean up memory queue on disconnect
const removeFromMemoryQueue = (userId) => {
  VALID_FEES.forEach(fee => {
    const before = memoryQueues[fee].length;
    memoryQueues[fee] = memoryQueues[fee].filter(p => p.userId !== userId);
    if (memoryQueues[fee].length < before) {
      console.log(`Removed ${userId} from memory queue fee=${fee}`);
    }
  });
};

module.exports = matchmakingHandler;
module.exports.tryCreateMatch = tryCreateMatch;
module.exports.removeFromMemoryQueue = removeFromMemoryQueue;