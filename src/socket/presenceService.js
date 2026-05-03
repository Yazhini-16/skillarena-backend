const { redisClient } = require('../config/redis');

const isUserOnline = async (userId) => {
  const socketId = await redisClient.get(`presence:${userId}`);
  return !!socketId;
};

const getSocketId = async (userId) => {
  return await redisClient.get(`presence:${userId}`);
};

const setActiveMatch = async (userId, matchId) => {
  await redisClient.set(`user:${userId}:active_match`, matchId, 'EX', 7200);
};

const clearActiveMatch = async (userId) => {
  await redisClient.del(`user:${userId}:active_match`);
};

module.exports = { isUserOnline, getSocketId, setActiveMatch, clearActiveMatch };