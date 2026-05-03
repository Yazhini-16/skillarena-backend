const router = require('express').Router();
const { getWallet, getTransactions, deposit } = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate); // all wallet routes require auth
router.get('/', getWallet);
router.get('/transactions', getTransactions);
router.post('/deposit', deposit);

module.exports = router;