import * as matchmakingService from '../services/matchmakingService.js';
import { pool } from '../config/db.js';
import { success, error } from '../utils/response.js';

const joinQueue = async (req, res, next) => {
  try {
    const { entryFee } = req.body;
    const validFees = [10, 25, 50, 100, 200, 500];
    if (!validFees.includes(Number(entryFee))) {
      return error(res, `Entry fee must be one of: ${validFees.join(', ')}`, 400);
    }
    const result = await matchmakingService.joinQueue(req.user.id, Number(entryFee));
    return success(res, result, 'Joined matchmaking queue');
  } catch (err) { next(err); }
};

const leaveQueue = async (req, res, next) => {
  try {
    const { entryFee } = req.body;
    await matchmakingService.leaveQueue(req.user.id, Number(entryFee));
    return success(res, null, 'Left matchmaking queue');
  } catch (err) { next(err); }
};

const getMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const result = await pool.query(
      `SELECT m.*, p.title as problem_title, p.description, p.time_limit_seconds, p.test_cases,
              ua.username as player_a_name, ub.username as player_b_name
       FROM matches m
       JOIN users ua ON ua.id = m.player_a_id
       JOIN users ub ON ub.id = m.player_b_id
       LEFT JOIN problems p ON p.id = m.problem_id
       WHERE m.id = $1 AND (m.player_a_id = $2 OR m.player_b_id = $2)`,
      [matchId, req.user.id]
    );
    if (!result.rows[0]) return error(res, 'Match not found', 404);

    // Filter: only show public test cases to the client
    const match = result.rows[0];
    if (match.test_cases) {
      match.public_test_cases = match.test_cases.filter(tc => tc.is_public);
      delete match.test_cases; // never send all test cases to client
    }

    return success(res, match);
  } catch (err) { next(err); }
};

export { joinQueue, leaveQueue, getMatch };
