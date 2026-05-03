const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');


const register = async ({ username, email, password }) => {
  // Validate
  if (!username || !email || !password) throw { statusCode: 400, message: 'All fields required' };
  if (password.length < 8) throw { statusCode: 400, message: 'Password must be at least 8 characters' };
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    throw { statusCode: 400, message: 'Username must be 3-30 chars, letters/numbers/underscore only' };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Use a transaction to create user + wallet atomically
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, username, email, skill_rating, created_at`,
      [username.toLowerCase(), email.toLowerCase(), passwordHash]
    );
    const user = userResult.rows[0];

    // Create wallet for this user
    await client.query(
      `INSERT INTO wallets (user_id) VALUES ($1)`,
      [user.id]
    );

    await client.query('COMMIT');

    const token = generateToken({ id: user.id, username: user.username, email: user.email });
    return { user, token };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const login = async ({ email, password }) => {
  if (!email || !password) throw { statusCode: 400, message: 'Email and password required' };

  const result = await pool.query(
    `SELECT id, username, email, password_hash, skill_rating, is_active FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user) throw { statusCode: 401, message: 'Invalid email or password' };
  if (!user.is_active) throw { statusCode: 403, message: 'Account has been deactivated' };

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) throw { statusCode: 401, message: 'Invalid email or password' };

  const token = generateToken({ id: user.id, username: user.username, email: user.email });

  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
};

const getProfile = async (userId) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.email, u.skill_rating, u.matches_played,
            u.matches_won, u.avatar_url, u.created_at,
            w.balance, w.locked_balance
     FROM users u
     LEFT JOIN wallets w ON w.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  if (!result.rows[0]) throw { statusCode: 404, message: 'User not found' };
  return result.rows[0];
};

module.exports = { register, login, getProfile };