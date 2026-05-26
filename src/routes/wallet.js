const router  = require('express').Router();
const { pool, withTransaction } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { sendWithdrawalConfirmation } = require('../services/emailService');
const logger = require('../utils/logger');

// ── Get wallet ─────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT balance, locked_balance, total_deposited FROM wallets WHERE user_id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return error(res, 'Wallet not found', 404);
    return success(res, result.rows[0]);
  } catch (err) { next(err); }
});

// ── Get transactions ───────────────────────────────────────────────
router.get('/transactions', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30'), 100);
    const result = await pool.query(
      `SELECT id, type, amount, balance_after, description, status, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [req.user.id, limit]
    );
    return success(res, result.rows);
  } catch (err) { next(err); }
});

// ── Request withdrawal ─────────────────────────────────────────────
router.post('/withdraw', authenticate, async (req, res, next) => {
  try {
    const { amount, upiId } = req.body;
    const withdrawAmount = parseFloat(amount);

    // Validations
    if (!upiId?.trim()) return error(res, 'UPI ID is required', 400);
    if (!amount || isNaN(withdrawAmount)) return error(res, 'Valid amount required', 400);
    if (withdrawAmount < 50) return error(res, 'Minimum withdrawal is ₹50', 400);
    if (withdrawAmount > 50000) return error(res, 'Maximum withdrawal is ₹50,000 per request', 400);

    // Validate UPI ID format
    const upiRegex = /^[\w.\-_]{3,}@[a-zA-Z]{3,}$/;
    if (!upiRegex.test(upiId.trim())) {
      return error(res, 'Invalid UPI ID format (example: yourname@upi)', 400);
    }

    // Check for pending withdrawal
    const pendingCheck = await pool.query(
      `SELECT id FROM withdrawals WHERE user_id = $1 AND status = 'PENDING'`,
      [req.user.id]
    );
    if (pendingCheck.rows.length > 0) {
      return error(res, 'You already have a pending withdrawal. Wait for it to process.', 400);
    }

    const result = await withTransaction(async (client) => {
      // Lock wallet and check balance
      const walletResult = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [req.user.id]
      );

      if (!walletResult.rows[0]) throw { statusCode: 404, message: 'Wallet not found' };

      const currentBalance = parseFloat(walletResult.rows[0].balance);
      if (currentBalance < withdrawAmount) {
        throw { statusCode: 400, message: `Insufficient balance. Available: ₹${currentBalance.toFixed(2)}` };
      }

      const newBalance = currentBalance - withdrawAmount;

      // Deduct from wallet
      await client.query(
        'UPDATE wallets SET balance = $1 WHERE user_id = $2',
        [newBalance, req.user.id]
      );

      // Create withdrawal record
      const withdrawal = await client.query(
        `INSERT INTO withdrawals (user_id, amount, upi_id, status)
         VALUES ($1, $2, $3, 'PENDING')
         RETURNING id, amount, upi_id, status, created_at`,
        [req.user.id, withdrawAmount, upiId.trim()]
      );

      // Transaction record
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, status)
         VALUES ($1, 'WITHDRAWAL', $2, $3, $4, 'COMPLETED')`,
        [
          req.user.id, withdrawAmount, newBalance,
          `Withdrawal to UPI: ${upiId.trim()} | ref: ${withdrawal.rows[0].id}`,
        ]
      );

      return { withdrawal: withdrawal.rows[0], newBalance };
    });

    // Send confirmation email (non-blocking)
    const userResult = await pool.query(
      'SELECT email, username FROM users WHERE id = $1', [req.user.id]
    );
    if (userResult.rows[0]) {
      sendWithdrawalConfirmation(
        userResult.rows[0].email,
        userResult.rows[0].username,
        withdrawAmount,
        upiId.trim()
      ).catch(() => {});
    }

    logger.info('Withdrawal requested', {
      userId: req.user.id, amount: withdrawAmount, upiId,
    });

    return success(res, {
      withdrawalId: result.withdrawal.id,
      amount: withdrawAmount,
      upiId: upiId.trim(),
      status: 'PENDING',
      newBalance: result.newBalance,
    }, `Withdrawal of ₹${withdrawAmount} initiated. Will be credited to ${upiId} within 24 hours.`);

  } catch (err) { next(err); }
});

// ── Get withdrawal history ─────────────────────────────────────────
router.get('/withdrawals', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, amount, upi_id, status, notes, processed_at, created_at
       FROM withdrawals WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    return success(res, result.rows);
  } catch (err) { next(err); }
});

module.exports = router;