import { Router } from 'express';
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import {
  createOrder,
  verifyAndCreditWallet,
  handleWebhook,
} from '../services/paymentService.js';

const router = Router();

// ── Create order — authenticated ───────────────────────────────────
router.post('/create-order', authenticate, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return error(res, 'Valid amount required', 400);
    }
    const order = await createOrder(req.user.id, parseFloat(amount));
    return success(res, order, 'Order created');
  } catch (err) { next(err); }
});

// ── Verify payment — authenticated ─────────────────────────────────
router.post('/verify', authenticate, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return error(res, 'Missing payment details', 400);
    }
    const result = await verifyAndCreditWallet(req.user.id, req.body);
    return success(res, result, `₹${result.amount} added to your wallet`);
  } catch (err) { next(err); }
});

// ── Razorpay webhook — no auth, raw body needed ────────────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // raw body for signature verification
  async (req, res, next) => {
    try {
      const signature = req.headers['x-razorpay-signature'];
      if (!signature) return res.status(400).json({ error: 'No signature' });
      const result = await handleWebhook(req.body, signature);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

export default router;
