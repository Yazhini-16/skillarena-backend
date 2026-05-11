const router = require('express').Router();
const { pool } = require('../config/db');
const { success } = require('../utils/response');

router.get('/leaderboard', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, username, skill_rating, matches_played, matches_won
       FROM users
       WHERE is_active = true AND matches_played > 0
       ORDER BY skill_rating DESC, matches_won DESC
       LIMIT 50`
    );
    return success(res, result.rows);
  } catch (err) { next(err); }
});

module.exports = router;