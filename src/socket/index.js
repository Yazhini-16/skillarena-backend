import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { redisClient } from '../config/redis.js';
import matchmakingHandler from './matchmakingHandler.js';
import matchHandler from './matchHandler.js';
import logger from '../utils/logger.js';

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20000,
    pingInterval: 10000,
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));
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

    await redisClient.set(`presence:${userId}`, socket.id, 'EX', 3600);
    socket.join(`user:${userId}`);

    matchmakingHandler(io, socket);
    matchHandler(io, socket);

    socket.on('disconnect', async (reason) => {
      logger.info('Socket disconnected', { userId, username, reason });
      await redisClient.del(`presence:${userId}`);

      const activeMatchId = await redisClient.get(`user:${userId}:active_match`);
      if (activeMatchId) {
        await handleDisconnectForfeit(io, userId, activeMatchId);
      }

      const queueFee = await redisClient.get(`user:${userId}:queue`);
      if (queueFee) {
        await redisClient.zrem(`queue:${queueFee}`, userId);
        await redisClient.del(`user:${userId}:queue`);
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
    await new Promise(resolve => setTimeout(resolve, 15000));

    const currentSocketId = await redisClient.get(`presence:${disconnectedUserId}`);
    if (currentSocketId) return;

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

    // Use dynamic import to avoid circular dependency at module load time
    const { resolveMatch } = await import('./matchHandler.js');
    await resolveMatch(io, matchId, winnerId, disconnectedUserId, 'FORFEIT');

  } catch (err) {
    logger.error('Forfeit handling error', { matchId, error: err.message });
  }
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

export { initSocket, getIO };
