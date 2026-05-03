const Redis = require('ioredis');

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not set');
}

const isSecure = process.env.REDIS_URL.startsWith('rediss://');

const redisClient = new Redis(process.env.REDIS_URL, {
  tls: isSecure ? { rejectUnauthorized: false } : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 200, 3000);
  },
  lazyConnect: false,
  enableOfflineQueue: true,
});

redisClient.on('connect', () => console.log('Redis connected to Railway'));
redisClient.on('ready', () => console.log('Redis ready'));
redisClient.on('error', (err) => console.error('Redis error:', err.message));
redisClient.on('reconnecting', () => console.warn('Redis reconnecting...'));

module.exports = { redisClient };