import { redisClient } from '../config/redis.js';

const MATCH_DURATION_MS = 30 * 60 * 1000;

const startMatchTimer = async (matchId) => {
  const startTs = Date.now();
  const endTs = startTs + MATCH_DURATION_MS;
  await redisClient.set(`match:${matchId}:start_ts`, startTs, 'EX', 7200);
  await redisClient.set(`match:${matchId}:end_ts`, endTs, 'EX', 7200);
  return { startTs, endTs, durationMs: MATCH_DURATION_MS };
};

const getMatchTimer = async (matchId) => {
  const startTs = await redisClient.get(`match:${matchId}:start_ts`);
  const endTs = await redisClient.get(`match:${matchId}:end_ts`);
  if (!startTs || !endTs) return null;
  const now = Date.now();
  const remainingMs = Math.max(0, parseInt(endTs) - now);
  return {
    startTs: parseInt(startTs),
    endTs: parseInt(endTs),
    remainingMs,
    isExpired: remainingMs === 0,
  };
};

const isMatchExpired = async (matchId) => {
  const timer = await getMatchTimer(matchId);
  return timer ? timer.isExpired : true;
};

const clearMatchTimer = async (matchId) => {
  await redisClient.del(`match:${matchId}:start_ts`);
  await redisClient.del(`match:${matchId}:end_ts`);
};

export { startMatchTimer, getMatchTimer, isMatchExpired, clearMatchTimer, MATCH_DURATION_MS };
