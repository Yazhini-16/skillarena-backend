const router  = require('express').Router();
const { pool } = require('../config/db');
const { hashPassword, comparePassword } = require('../services/authService');
const { generateToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { sendOTP, sendWelcome } = require('../services/emailService');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

// ── Send OTP before registration ────────────────────────────────────
// Client calls this first, then shows OTP input, then calls /register
router.post('/send-otp', async (req, res, next) => {
  try {
    const { email, username } = req.body;
    if (!email || !username) return error(res, 'Email and username required', 400);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return error(res, 'Invalid email format', 400);

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );
    if (existing.rows.length > 0) {
      const taken = existing.rows[0];
      return error(res, 'Email or username already taken', 409);
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP in Redis for 10 minutes
    await redisClient.set(
      `otp:${email.toLowerCase()}`,
      JSON.stringify({ otp, username }),
      'EX', 600
    );

    // Send email
    const sent = await sendOTP(email, otp, username);
    if (!sent) return error(res, 'Failed to send verification email. Check your email address.', 500);

    logger.info('OTP sent', { email });
    return success(res, null, 'Verification code sent to your email');
  } catch (err) { next(err); }
});

// ── Register with OTP verification ─────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, username, password, otp } = req.body;

    if (!email || !username || !password || !otp) {
      return error(res, 'All fields including OTP are required', 400);
    }

    if (username.length < 3) return error(res, 'Username must be at least 3 characters', 400);
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return error(res, 'Username: letters, numbers, underscore only', 400);
    if (password.length < 8) return error(res, 'Password must be at least 8 characters', 400);

    // Verify OTP from Redis
    const otpDataRaw = await redisClient.get(`otp:${email.toLowerCase()}`);
    if (!otpDataRaw) {
      return error(res, 'Verification code expired. Request a new one.', 400);
    }

    const otpData = JSON.parse(otpDataRaw);
    if (otpData.otp !== otp.trim()) {
      return error(res, 'Invalid verification code', 400);
    }

    // OTP valid — delete it
    await redisClient.del(`otp:${email.toLowerCase()}`);

    // Check uniqueness again
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );
    if (existing.rows.length > 0) return error(res, 'Email or username already taken', 409);

    const hashedPassword = await hashPassword(password);

    const userResult = await pool.query(
      `INSERT INTO users (email, username, password_hash, is_active, is_verified, skill_rating, matches_played, matches_won)
       VALUES ($1, $2, $3, true, true, 1000, 0, 0)
       RETURNING id, email, username, skill_rating, matches_played, matches_won, is_verified`,
      [email.toLowerCase(), username, hashedPassword]
    );

    const user = userResult.rows[0];

    // Create wallet
    await pool.query(
      'INSERT INTO wallets (user_id, balance, locked_balance) VALUES ($1, 0, 0)',
      [user.id]
    );

    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    // Send welcome email (non-blocking)
    sendWelcome(email, username).catch(() => {});

    logger.info('User registered', { userId: user.id, email, username });
    return success(res, { user, token }, 'Account created successfully');
  } catch (err) { next(err); }
});

// ── Login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const result = await pool.query(
      `SELECT u.*, w.balance, w.locked_balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (!result.rows[0]) return error(res, 'Invalid email or password', 401);

    const user = result.rows[0];
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return error(res, 'Invalid email or password', 401);

    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    return success(res, {
      user: {
        id: user.id, email: user.email, username: user.username,
        skill_rating: user.skill_rating, matches_played: user.matches_played,
        matches_won: user.matches_won, hearts: user.hearts ?? 3,
        is_premium: user.is_premium, balance: user.balance,
      },
      token,
    }, 'Login successful');
  } catch (err) { next(err); }
});

// ── Get current user ───────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.username, u.skill_rating, u.matches_played,
              u.matches_won, u.hearts, u.hearts_reset_at, u.consecutive_losses,
              u.is_premium, u.created_at, w.balance, w.locked_balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return error(res, 'User not found', 404);
    return success(res, result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;