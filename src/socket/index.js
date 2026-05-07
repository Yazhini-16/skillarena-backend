const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { redisClient } = require('../config/redis');
const matchmakingHandler = require('./matchmakingHandler');
const matchHandler = require('./matchHandler');
const logger = require('../utils/logger');

let io;

const initSocket = (httpServer) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://skillarena-frontend-one.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20000,
    pingInterval: 10000,
    transports: ['websocket', 'polling'],
    // Allow upgrade from polling to websocket
    allowUpgrades: true,
  });

  // JWT auth middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      logger.warn('Socket auth failed', { error: err.message });
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const { id: userId, username } = socket.user;
    logger.info('Socket connected', { userId, username, socketId: socket.id });

    // Update presence — always use latest socket ID
    await redisClient.set(`presence:${userId}`, socket.id, 'EX', 3600);

    // Personal room for direct messages
    socket.join(`user:${userId}`);

    // Register all event handlers fresh on every connection
    matchmakingHandler(io, socket);
    matchHandler(io, socket);

    socket.on('disconnect', async (reason) => {
      logger.info('Socket disconnected', { userId, username, reason });

      // Only remove presence if this socket is still the current one
      const currentSocketId = await redisClient.get(`presence:${userId}`);
      if (currentSocketId === socket.id) {
        await redisClient.del(`presence:${userId}`);
      }

      // Handle active match disconnect
      const activeMatchId = await redisClient.get(`user:${userId}:active_match`);
      if (activeMatchId) {
        handleDisconnectForfeit(io, userId, activeMatchId);
      }

      // Remove from queue if they were in one
      const queueFee = await redisClient.get(`user:${userId}:queue`);
      if (queueFee) {
        await redisClient.zrem(`queue:${queueFee}`, userId);
        await redisClient.del(`user:${userId}:queue`);
        await redisClient.del(`user:${userId}:category`);
        logger.info('Removed disconnected user from queue', { userId });
      }
    });

    socket.on('ping', () => {
      socket.emit('pong', { ts: Date.now() });
    });
  });

  return io;
};

const handleDisconnectForfeit = async (io, disconnectedUserId, matchId) => {
  try {
    // Wait 15 seconds to see if player reconnects
    await new Promise(resolve => setTimeout(resolve, 15000));

    const currentSocketId = await redisClient.get(`presence:${disconnectedUserId}`);
    if (currentSocketId) return; // reconnected

    const matchStateRaw = await redisClient.get(`match:${matchId}:state`);
    if (!matchStateRaw) return;

    const matchState = JSON.parse(matchStateRaw);
    if (matchState.status !== 'IN_PROGRESS') return;

    const winnerId = matchState.playerAId === disconnectedUserId
      ? matchState.playerBId
      : matchState.playerAId;

    io.to(`match:${matchId}`).emit('match:forfeit', {
      matchId,
      forfeitedBy: disconnectedUserId,
      winnerId,
      reason: 'opponent_disconnected',
      message: 'Your opponent disconnected. You win!',
    });

    const { resolveMatch } = require('./matchHandler');
    await resolveMatch(io, matchId, winnerId, disconnectedUserId, 'FORFEIT');

  } catch (err) {
    logger.error('Forfeit handling error', { matchId, error: err.message });
  }
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { initSocket, getIO };