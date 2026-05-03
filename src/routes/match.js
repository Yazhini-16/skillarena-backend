import { Router } from 'express';
import { joinQueue, leaveQueue, getMatch } from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.post('/queue/join', joinQueue);
router.post('/queue/leave', leaveQueue);
router.get('/:matchId', getMatch);

export default router;
