import * as walletService from '../services/walletService.js';
import { success, error } from '../utils/response.js';

const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    return success(res, wallet);
  } catch (err) { next(err); }
};

const getTransactions = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const txns = await walletService.getTransactionHistory(req.user.id, parseInt(limit), parseInt(offset));
    return success(res, txns);
  } catch (err) { next(err); }
};

const deposit = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return error(res, 'Valid amount required', 400);
    }
    const result = await walletService.deposit(req.user.id, parseFloat(amount));
    return success(res, result, `₹${amount} deposited successfully`);
  } catch (err) { next(err); }
};

export { getWallet, getTransactions, deposit };
