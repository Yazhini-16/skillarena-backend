const { redisClient } = require('../config/redis');
const { pool } = require('../config/db');
const { lockFundsForMatch } = require('./walletService');
const { withTransaction } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const QUEUE_KEY = (fee) => `queue:${fee}`;
const MATCH_TIMEOUT_MS = 90 * 1000; // 90 seconds before refund

const joinQueue = async (userId, entryFee) => {
  const queueKey = QUEUE_KEY(entryFee);

  // Check if user is already in any queue
  const existingQueue = await redisClient.get(`user:${userId}:queue`);
  if (existingQueue) throw { statusCode: 409, message: 'Already in a queue' };

  // Check wallet balance before joining
  const walletResult = await pool.query(
    `SELECT balance FROM wallets WHERE user_id = $1`,
    [userId]
  );
  if (!walletResult.rows[0] || parseFloat(walletResult.rows[0].balance) < entryFee) {
    throw { statusCode: 400, message: 'Insufficient balance to join this match' };
  }

  const timestamp = Date.now();
  await redisClient.zAdd(queueKey, { score: timestamp, value: userId });
  await redisClient.set(`user:${userId}:queue`, entryFee, { EX: 120 }); // auto-expire after 2 min

  return { position: await redisClient.zRank(queueKey, userId) + 1 };
};

const leaveQueue = async (userId, entryFee) => {
  const queueKey = QUEUE_KEY(entryFee);
  await redisClient.zRem(queueKey, userId);
  await redisClient.del(`user:${userId}:queue`);
};

// This is called by the matchmaking worker every 500ms
const processQueue = async (entryFee) => {
  const queueKey = QUEUE_KEY(entryFee);
  const queueLength = await redisClient.zCard(queueKey);

  if (queueLength < 2) return null; // not enough players

  // Get the two oldest players (lowest score = joined earliest)
  const [playerAId, playerBId] = await redisClient.zRange(queueKey, 0, 1);

  // Remove them from queue atomically
  await redisClient.zRem(queueKey, playerAId);
  await redisClient.zRem(queueKey, playerBId);
  await redisClient.del(`user:${playerAId}:queue`);
  await redisClient.del(`user:${playerBId}:queue`);

  // Pick a random problem for this difficulty tier
  const difficulty = entryFee <= 50 ? 'easy' : entryFee <= 200 ? 'medium' : 'hard';
  const problemResult = await pool.query(
    `SELECT id FROM problems WHERE difficulty = $1 AND is_active = true ORDER BY RANDOM() LIMIT 1`,
    [difficulty]
  );
  const problemId = problemResult.rows[0]?.id || null;

  const matchId = uuidv4();
  const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || 10) / 100;
  const prizePool = entryFee * 2 * (1 - platformFeePercent);
  const platformFee = entryFee * 2 * platformFeePercent;

  // Create match + lock funds in a single transaction
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO matches (id, player_a_id, player_b_id, problem_id, entry_fee, prize_pool, platform_fee, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'WAITING')`,
      [matchId, playerAId, playerBId, problemId, entryFee, prizePool, platformFee]
    );
    await lockFundsForMatch(playerAId, entryFee, matchId, client);
    await lockFundsForMatch(playerBId, entryFee, matchId, client);
  });

  return { matchId, playerAId, playerBId, problemId, entryFee, prizePool };
};

module.exports = { joinQueue, leaveQueue, processQueue };