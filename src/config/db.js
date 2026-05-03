import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Railway's self-signed cert
  },
  max: 20,                   // max connections in pool
  idleTimeoutMillis: 30000,  // close idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if Railway is unreachable
});

pool.on('connect', () => {
  console.log('PostgreSQL pool connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
  // Don't exit — let the pool recover and reconnect
});

// Test connection on startup
const testConnection = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`PostgreSQL connected. Server time: ${result.rows[0].current_time}`);
  } finally {
    client.release();
  }
};

// Atomic transaction helper — always use this for money operations
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export { pool, withTransaction, testConnection };
