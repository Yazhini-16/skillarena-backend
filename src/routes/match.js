const router = require('express').Router();
const { joinQueue, leaveQueue, getMatch } = require('../controllers/matchController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.post('/queue/join', joinQueue);
router.post('/queue/leave', leaveQueue);
router.get('/:matchId', getMatch);

module.exports = router;