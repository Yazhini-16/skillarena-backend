// Debug output — first thing that runs
console.log('=== STARTING ===');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket/index');
const { testConnection } = require('./config/db');
const { redisClient } = require('./config/redis');
const { tryCreateMatch } = require('./socket/matchmakingHandler');
const logger = require('./utils/logger');

// Railway injects PORT — never hardcode it
const PORT = process.env.PORT;

if (!PORT) {
  console.error('ERROR: PORT environment variable not set!');
  process.exit(1);
}

console.log(`Starting server on PORT: ${PORT}`);

const ENTRY_FEES = [10, 25, 50, 100, 200, 500];

const start = async () => {
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);

  // Listen FIRST on all interfaces
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  // Connect to databases AFTER server is listening
  setTimeout(async () => {
    try {
      await testConnection();
      logger.info('PostgreSQL connected');
    } catch (err) {
      logger.error('PostgreSQL failed', { error: err.message });
    }

    try {
      await redisClient.ping();
      logger.info('Redis connected');

      setInterval(async () => {
        for (const fee of ENTRY_FEES) {
          try {
            await tryCreateMatch(io, fee);
          } catch (err) {
            logger.error('Matchmaking error', { fee, error: err.message });
          }
        }
      }, 500);

      logger.info('Matchmaking worker started');
    } catch (err) {
      logger.error('Redis failed', { error: err.message });
    }
  }, 1000); // 1 second after server starts

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received');
    httpServer.close(() => process.exit(0));
  });
};

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});