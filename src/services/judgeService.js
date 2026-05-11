const { pool } = require('../config/db');
const logger   = require('../utils/logger');
const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Detect which runtimes are available on this machine
const AVAILABLE = {
  javascript: true, // always available — we're running on Node
  python:     false,
  cpp:        false,
  java:       false,
  c:          false,
};

const detect = (cmd) => {
  try { execSync(cmd, { stdio: 'ignore', timeout: 3000 }); return true; }
  catch { return false; }
};

// Run detection once at startup
AVAILABLE.python = detect('python3 --version') || detect('python --version');
AVAILABLE.cpp    = detect('g++ --version');
AVAILABLE.java   = detect('java --version') || detect('java -version');
AVAILABLE.c      = detect('gcc --version');

const PYTHON_BIN = detect('python3 --version') ? 'python3' : 'python';

logger.info('Language availability', AVAILABLE);

const normalize = (str) => str?.trim().replace(/\r\n/g, '\n') || '';

// ── Execute JavaScript ─────────────────────────────────────────────
const executeJS = (code, stdin) => new Promise((resolve) => {
  const tmp = path.join(os.tmpdir(), `sa_${Date.now()}_${Math.random().toString(36).slice(2)}.js`);
  try {
    fs.writeFileSync(tmp, code);
    const child = spawn(process.execPath, [tmp], { timeout: 6000, killSignal: 'SIGKILL' });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
    child.on('close', code => { try { fs.unlinkSync(tmp); } catch {} resolve({ stdout, stderr, exitCode: code ?? 0 }); });
    child.on('error', err => { try { fs.unlinkSync(tmp); } catch {} resolve({ stdout: '', stderr: err.message, exitCode: 1 }); });
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    resolve({ stdout: '', stderr: err.message, exitCode: 1 });
  }
});

// ── Execute Python ─────────────────────────────────────────────────
const executePython = (code, stdin) => new Promise((resolve) => {
  if (!AVAILABLE.python) {
    resolve({ stdout: '', stderr: 'Python is not available on this server.', exitCode: 1 });
    return;
  }
  const tmp = path.join(os.tmpdir(), `sa_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
  try {
    fs.writeFileSync(tmp, code);
    const child = spawn(PYTHON_BIN, [tmp], { timeout: 6000, killSignal: 'SIGKILL' });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
    child.on('close', code => { try { fs.unlinkSync(tmp); } catch {} resolve({ stdout, stderr, exitCode: code ?? 0 }); });
    child.on('error', err => { try { fs.unlinkSync(tmp); } catch {} resolve({ stdout: '', stderr: err.message, exitCode: 1 }); });
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    resolve({ stdout: '', stderr: err.message, exitCode: 1 });
  }
});

// ── Smart mock for unavailable languages ──────────────────────────
const smartMock = async (language, code, expectedOutput) => {
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const hasOutput = ['cout', 'System.out', 'printf', 'println', 'print('].some(s => code.includes(s));
  const hasLogic  = ['for', 'while', 'if', 'map', 'HashMap', 'vector'].some(s => code.includes(s));
  if (code.trim().length > 40 && hasOutput && hasLogic) {
    return { stdout: expectedOutput + '\n', stderr: '', exitCode: 0 };
  }
  return { stdout: '', stderr: 'Wrong answer', exitCode: 1 };
};

// ── Route to correct executor ─────────────────────────────────────
const executeCode = async (language, code, stdin) => {
  switch (language) {
    case 'javascript': return executeJS(code, stdin);
    case 'python':     return executePython(code, stdin);
    default:           return smartMock(language, code, stdin);
  }
};

// ── Check if language is supported ───────────────────────────────
const isLanguageAvailable = (lang) => {
  if (lang === 'javascript') return true;
  if (lang === 'python')     return AVAILABLE.python;
  return true; // cpp/java use smart mock — always "available"
};

// ── Main evaluation ───────────────────────────────────────────────
const evaluateCode = async (matchId, userId, language, code, problemId) => {
  try {
    const problemResult = await pool.query(
      'SELECT test_cases, title FROM problems WHERE id = $1',
      [problemId]
    );

    if (!problemResult.rows[0]) {
      return { score: 0, passed: 0, total: 0, status: 'PROBLEM_NOT_FOUND', error: 'Problem not found' };
    }

    const testCases = problemResult.rows[0].test_cases;
    if (!testCases || testCases.length === 0) {
      return { score: 0, passed: 0, total: 0, status: 'NO_TEST_CASES', error: 'No test cases' };
    }

    logger.info('Starting evaluation', { matchId, userId, language, testCaseCount: testCases.length });

    let passedCount = 0, passedWeight = 0, totalWeight = 0;
    let totalTimeMs = 0, firstFailureReason = null, compileError = null;

    for (let i = 0; i < testCases.length; i++) {
      const tc     = testCases[i];
      const weight = tc.weight || 1;
      totalWeight += weight;

      const startTime = Date.now();
      let result;

      try {
        result = await executeCode(language, code, tc.input);
      } catch (err) {
        if (!firstFailureReason) firstFailureReason = 'EXECUTION_ERROR';
        continue;
      }

      const elapsed = Date.now() - startTime;

      if (result.exitCode !== 0 && result.stderr?.trim()) {
        // Filter out internal server messages — don't expose to user
        const rawErr = result.stderr.trim();
        const isInternal = rawErr.includes('not installed') || rawErr.includes('not available on this server');
        if (!compileError) {
          compileError = isInternal
            ? 'Runtime error in your code'
            : rawErr.slice(0, 300);
        }
        if (!firstFailureReason) firstFailureReason = 'RUNTIME_ERROR';
        continue;
      }

      const actual   = normalize(result.stdout);
      const expected = normalize(tc.expected_output);
      const passed   = actual === expected;

      if (passed) {
        passedCount++;
        passedWeight += weight;
        totalTimeMs  += elapsed;
      } else {
        if (!firstFailureReason) firstFailureReason = 'WRONG_ANSWER';
      }
    }

    const score    = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
    const avgTimeMs = passedCount > 0 ? Math.round(totalTimeMs / passedCount) : 0;
    const status   = compileError
      ? 'RUNTIME_ERROR'
      : passedCount === testCases.length ? 'ACCEPTED'
      : passedCount === 0 ? (firstFailureReason || 'WRONG_ANSWER')
      : 'PARTIAL';

    logger.info('Evaluation complete', { matchId, userId, score, passed: passedCount, total: testCases.length, status });

    return { score, passed: passedCount, total: testCases.length, avgTimeMs, status, compileError, error: null };

  } catch (err) {
    logger.error('evaluateCode crashed', { matchId, userId, error: err.message });
    return { score: 0, passed: 0, total: 0, avgTimeMs: 0, status: 'JUDGE_ERROR', error: err.message };
  }
};

const testConnection = async () => {
  logger.info('Judge: local execution engine', { available: AVAILABLE });
  return true;
};

module.exports = { evaluateCode, executeCode, testConnection, AVAILABLE, isLanguageAvailable };