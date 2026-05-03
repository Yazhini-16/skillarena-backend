require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket/index');
const { testConnection } = require('./config/db');
const { redisClient } = require('./config/redis');
const { tryCreateMatch } = require('./socket/matchmakingHandler');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8080;
const ENTRY_FEES = [10, 25, 50, 100, 200, 500];

const start = async () => {
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);

  // START LISTENING FIRST — so Railway healthcheck passes immediately
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server + Socket.io running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  // THEN connect to databases in background
  try {
    await testConnection();
    logger.info('PostgreSQL connected');

    await redisClient.ping();
    logger.info('Redis ping successful');

    // Start matchmaking worker only after DB is ready
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

  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    // Don't exit — server is still running, healthcheck still passes
    // Railway will show the error in logs
  }

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
};

start();