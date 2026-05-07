require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket/index');
const { testConnection } = require('./config/db');
const { redisClient } = require('./config/redis');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8080;
const ENTRY_FEES = [10, 25, 50, 100, 200, 500];

const start = async () => {
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
    logger.info(`Server + Socket.io running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  try {
    await testConnection();
    logger.info('PostgreSQL connected');
  } catch (err) {
    logger.error('PostgreSQL connection failed', { error: err.message });
  }

  try {
    await redisClient.ping();
    logger.info('Redis ping successful');
  } catch (err) {
    logger.error('Redis connection failed', { error: err.message });
  }

  const { tryCreateMatch } = require('./socket/matchmakingHandler');

  const worker = setInterval(async () => {
    for (const fee of ENTRY_FEES) {
      try {
        await tryCreateMatch(io, fee);
      } catch (err) {
        logger.error('Matchmaking worker error', { fee, error: err.message });
      }
    }
  }, 500);

  logger.info('Matchmaking worker started');

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down`);
    clearInterval(worker);
    httpServer.close(async () => {
      try { await redisClient.quit(); } catch {}
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});