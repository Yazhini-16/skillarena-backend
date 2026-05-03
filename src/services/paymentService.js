import Razorpay from 'razorpay';
import crypto from 'crypto';
import { pool, withTransaction } from '../config/db.js';
import logger from '../utils/logger.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Create a Razorpay order ────────────────────────────────────────
// Called when user clicks "Add funds" — creates a pending order
const createOrder = async (userId, amount) => {
  if (amount < 10) throw { statusCode: 400, message: 'Minimum deposit is ₹10' };
  if (amount > 10000) throw { statusCode: 400, message: 'Maximum deposit is ₹10,000' };

  // Razorpay amount is in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(amount * 100);

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `sa_${userId.slice(0, 8)}_${Date.now()}`,
    notes: {
      userId,
      platform: 'SkillArena',
    },
  });

  logger.info('Razorpay order created', {
    orderId: order.id, userId, amount,
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

// ── Verify payment signature ───────────────────────────────────────
// Called after Razorpay checkout completes on frontend
// This is CRITICAL — never credit wallet without verifying signature
const verifyAndCreditWallet = async (userId, {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  // Step 1: Verify signature — prevents fake payment notifications
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    logger.warn('Invalid payment signature', { userId, razorpay_order_id });
    throw { statusCode: 400, message: 'Invalid payment signature' };
  }

  // Step 2: Fetch order from Razorpay to get exact amount
  const order = await razorpay.orders.fetch(razorpay_order_id);
  const amountInRupees = order.amount / 100; // convert paise to rupees

  // Step 3: Check this payment hasn't been credited before (idempotency)
  const existing = await pool.query(
    `SELECT id FROM transactions
     WHERE description LIKE $1 AND type = 'DEPOSIT'`,
    [`%${razorpay_payment_id}%`]
  );
  if (existing.rows.length > 0) {
    logger.warn('Duplicate payment attempt', { razorpay_payment_id });
    throw { statusCode: 409, message: 'Payment already processed' };
  }

  // Step 4: Credit wallet atomically
  return withTransaction(async (client) => {
    const walletResult = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (!walletResult.rows[0]) {
      throw { statusCode: 404, message: 'Wallet not found' };
    }

    const newBalance = parseFloat(walletResult.rows[0].balance) + amountInRupees;

    await client.query(
      `UPDATE wallets
       SET balance = $1, total_deposited = total_deposited + $2
       WHERE user_id = $3`,
      [newBalance, amountInRupees, userId]
    );

    await client.query(
      `INSERT INTO transactions
         (user_id, type, amount, balance_after, description, status)
       VALUES ($1, 'DEPOSIT', $2, $3, $4, 'COMPLETED')`,
      [
        userId,
        amountInRupees,
        newBalance,
        `Razorpay deposit | order:${razorpay_order_id} | payment:${razorpay_payment_id}`,
      ]
    );

    logger.info('Wallet credited via Razorpay', {
      userId, amount: amountInRupees,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });

    return { balance: newBalance, amount: amountInRupees };
  });
};

// ── Webhook handler ────────────────────────────────────────────────
// Razorpay calls this URL when payment status changes
// Backup to verifyAndCreditWallet in case frontend fails
const handleWebhook = async (rawBody, signature) => {
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    logger.warn('Invalid webhook signature');
    throw { statusCode: 400, message: 'Invalid webhook signature' };
  }

  const event = JSON.parse(rawBody);
  logger.info('Razorpay webhook received', { event: event.event });

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const userId = payment.notes?.userId;

    if (!userId) {
      logger.warn('Webhook: no userId in payment notes', { paymentId: payment.id });
      return { received: true };
    }

    // Check if already credited (webhook can fire multiple times)
    const existing = await pool.query(
      `SELECT id FROM transactions WHERE description LIKE $1`,
      [`%${payment.id}%`]
    );

    if (existing.rows.length > 0) {
      logger.info('Webhook: payment already credited', { paymentId: payment.id });
      return { received: true };
    }

    const amountInRupees = payment.amount / 100;

    await withTransaction(async (client) => {
      const walletResult = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (!walletResult.rows[0]) return;

      const newBalance = parseFloat(walletResult.rows[0].balance) + amountInRupees;

      await client.query(
        `UPDATE wallets SET balance = $1, total_deposited = total_deposited + $2
         WHERE user_id = $3`,
        [newBalance, amountInRupees, userId]
      );

      await client.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, status)
         VALUES ($1, 'DEPOSIT', $2, $3, $4, 'COMPLETED')`,
        [userId, amountInRupees, newBalance, `Webhook deposit | payment:${payment.id}`]
      );
    });

    logger.info('Wallet credited via webhook', { userId, amount: amountInRupees });
  }

  return { received: true };
};

export { createOrder, verifyAndCreditWallet, handleWebhook };
