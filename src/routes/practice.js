const router = require('express').Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { evaluateCode } = require('../services/judgeService');
const { success, error } = require('../utils/response');

// Add this route to practice.js
const { AVAILABLE } = require('../services/judgeService');

router.get('/languages', (req, res) => {
  return res.json({
    success: true,
    data: AVAILABLE,
    message: 'Language availability',
  });
});
// Get all problems for practice
router.get('/problems', async (req, res, next) => {
  try {
    const { difficulty, category } = req.query;
    let query = `SELECT id, title, slug, description, difficulty, category,
                        time_limit_seconds, test_cases, supported_languages
                 FROM problems WHERE is_active = true`;
    const params = [];

    if (difficulty) { params.push(difficulty); query += ` AND difficulty = $${params.length}`; }
    if (category && category !== 'all') { params.push(category); query += ` AND category = $${params.length}`; }

    query += ' ORDER BY difficulty, category, title';
    const result = await pool.query(query, params);

    // Only send public test cases to client
    const problems = result.rows.map(p => ({
      ...p,
      test_cases: (p.test_cases || []).filter(tc => tc.is_public),
    }));

    return success(res, problems);
  } catch (err) { next(err); }
});

// Get single problem
router.get('/problems/:slug', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, slug, description, difficulty, category,
              time_limit_seconds, test_cases, supported_languages
       FROM problems WHERE slug = $1 AND is_active = true`,
      [req.params.slug]
    );
    if (!result.rows[0]) return error(res, 'Problem not found', 404);

    const problem = result.rows[0];
    problem.test_cases = (problem.test_cases || []).filter(tc => tc.is_public);
    return success(res, problem);
  } catch (err) { next(err); }
});

// Run code against public test cases only
router.post('/run', authenticate, async (req, res, next) => {
  try {
    const { problemId, language, code } = req.body;
    if (!problemId || !language || !code) {
      return error(res, 'problemId, language and code are required', 400);
    }

    const problemResult = await pool.query(
      'SELECT test_cases FROM problems WHERE id = $1',
      [problemId]
    );
    if (!problemResult.rows[0]) return error(res, 'Problem not found', 404);

    const publicTestCases = (problemResult.rows[0].test_cases || []).filter(tc => tc.is_public);
    const { executeCode } = require('../services/judgeService');
    const normalize = (str) => str?.trim().replace(/\r\n/g, '\n') || '';
    const results = [];

    for (let i = 0; i < publicTestCases.length; i++) {
      const tc = publicTestCases[i];
      const startTime = Date.now();
      let result;
      try {
        result = await executeCode(language, code, tc.input);
      } catch (err) {
        results.push({ index: i + 1, input: tc.input, expected: tc.expected_output, actual: '', passed: false, error: err.message, timeMs: 0 });
        continue;
      }
      const elapsed = Date.now() - startTime;
      const actual = normalize(result.stdout);
      const expected = normalize(tc.expected_output);
      results.push({
        index: i + 1, input: tc.input, expected,
        actual, passed: actual === expected,
        error: result.stderr || null, timeMs: elapsed,
      });
    }

    const passedCount = results.filter(r => r.passed).length;
    return success(res, { results, passedCount, totalCount: results.length });
  } catch (err) { next(err); }
});

// Submit against ALL test cases
router.post('/submit', authenticate, async (req, res, next) => {
  try {
    const { problemId, language, code } = req.body;
    if (!problemId || !language || !code) {
      return error(res, 'problemId, language and code are required', 400);
    }

    const evalResult = await evaluateCode(
      `practice-${Date.now()}`,
      req.user.id,
      language,
      code,
      problemId
    );

    return success(res, {
      score: evalResult.score,
      passed: evalResult.passed,
      total: evalResult.total,
      status: evalResult.status,
      avgTimeMs: evalResult.avgTimeMs,
      compileError: evalResult.compileError || null,
    });
  } catch (err) { next(err); }
});

module.exports = router;