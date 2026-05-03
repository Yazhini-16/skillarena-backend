import { Router } from 'express';
import { getWallet, getTransactions, deposit } from '../controllers/walletController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate); // all wallet routes require auth
router.get('/', getWallet);
router.get('/transactions', getTransactions);
router.post('/deposit', deposit);

export default router;
