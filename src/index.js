import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { initSocket } from './socket/index.js';
import { testConnection } from './config/db.js';
import { redisClient } from './config/redis.js';
import { tryCreateMatch } from './socket/matchmakingHandler.js';
import logger from './utils/logger.js';


const PORT = process.env.PORT || 8080;

const ENTRY_FEES = [10, 25, 50, 100, 200, 500];

const start = async () => {
  try {
    

    await redisClient.ping();
    logger.info('Redis ping successful');
    await testConnection();

    // Create HTTP server from Express app
    // Socket.io attaches to this same server — same port, no CORS issues
    const httpServer = http.createServer(app);

    // Initialize Socket.io
    const io = initSocket(httpServer);

    // Matchmaking worker — polls every 500ms for all fee tiers
    setInterval(async () => {
      for (const fee of ENTRY_FEES) {
        try {
          await tryCreateMatch(io, fee);
        } catch (err) {
          logger.error('Matchmaking worker error', { fee, error: err.message });
        }
      }
    }, 500);

    logger.info('Matchmaking worker started');

    httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server + Socket.io running on port ${PORT} [${process.env.NODE_ENV}]`);
});

    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down...`);
      httpServer.close(async () => {
        await redisClient.quit();
        logger.info('Shut down complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start', { error: err.message });
    process.exit(1);
  }
};

start();
