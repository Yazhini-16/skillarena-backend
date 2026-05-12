const { pool } = require('../config/db');
const logger = require('../utils/logger');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─────────────────────────────────────────────────────────────
// Detect installed languages
// ─────────────────────────────────────────────────────────────

const detect = (cmd) => {
  try {
    execSync(cmd, {
      stdio: 'ignore',
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
};

const AVAILABLE = {
  javascript: true,
  python: detect('python3 --version') || detect('python --version'),
  cpp: detect('g++ --version'),
  java: detect('java -version'),
};

const PYTHON_BIN = detect('python3 --version')
  ? 'python3'
  : 'python';

logger.info('Language availability', AVAILABLE);

const normalize = (str) =>
  str?.trim().replace(/\r\n/g, '\n') || '';

// ─────────────────────────────────────────────────────────────
// JavaScript Executor
// ─────────────────────────────────────────────────────────────

const executeJS = (code, stdin) =>
  new Promise((resolve) => {
    const file = path.join(
      os.tmpdir(),
      `code_${Date.now()}.js`
    );

    fs.writeFileSync(file, code);

    const child = spawn(process.execPath, [file]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    if (stdin) {
      child.stdin.write(stdin);
    }

    child.stdin.end();

    child.on('close', (code) => {
      try {
        fs.unlinkSync(file);
      } catch {}

      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    child.on('error', (err) => {
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });
  });

// ─────────────────────────────────────────────────────────────
// Python Executor
// ─────────────────────────────────────────────────────────────

const executePython = (code, stdin) =>
  new Promise((resolve) => {
    if (!AVAILABLE.python) {
      resolve({
        stdout: '',
        stderr: 'Python runtime unavailable',
        exitCode: 1,
      });
      return;
    }

    const file = path.join(
      os.tmpdir(),
      `code_${Date.now()}.py`
    );

    fs.writeFileSync(file, code);

    const child = spawn(PYTHON_BIN, [file]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    if (stdin) {
      child.stdin.write(stdin);
    }

    child.stdin.end();

    child.on('close', (code) => {
      try {
        fs.unlinkSync(file);
      } catch {}

      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    child.on('error', (err) => {
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });
  });

// ─────────────────────────────────────────────────────────────
// Main Executor
// ─────────────────────────────────────────────────────────────

const executeCode = async (
  language,
  code,
  stdin
) => {
  switch (language) {
    case 'javascript':
      return executeJS(code, stdin);

    case 'python':
      return executePython(code, stdin);

    default:
      return {
        stdout: '',
        stderr: 'Language not supported',
        exitCode: 1,
      };
  }
};

// ─────────────────────────────────────────────────────────────
// Evaluate Submission
// ─────────────────────────────────────────────────────────────

const evaluateCode = async (
  matchId,
  userId,
  language,
  code,
  problemId
) => {
  try {
    const result = await pool.query(
      'SELECT test_cases FROM problems WHERE id = $1',
      [problemId]
    );

    if (!result.rows[0]) {
      return {
        score: 0,
        passed: 0,
        total: 0,
        status: 'PROBLEM_NOT_FOUND',
      };
    }

    const testCases =
      result.rows[0].test_cases || [];

    let passed = 0;

    for (const tc of testCases) {
      const execution = await executeCode(
        language,
        code,
        tc.input
      );

      if (
        execution.exitCode !== 0
      ) {
        return {
          score: 0,
          passed: 0,
          total: testCases.length,
          status: 'RUNTIME_ERROR',
          compileError: execution.stderr.slice(0, 300),
        };
      }

      const actual = normalize(
        execution.stdout
      );

      const expected = normalize(
        tc.expected_output
      );

      if (actual === expected) {
        passed++;
      }
    }

    const score = Math.round(
      (passed / testCases.length) * 100
    );

    return {
      score,
      passed,
      total: testCases.length,
      avgTimeMs: 0,
      status:
        passed === testCases.length
          ? 'ACCEPTED'
          : passed === 0
          ? 'WRONG_ANSWER'
          : 'PARTIAL',
      compileError: null,
    };
  } catch (err) {
    logger.error(err);

    return {
      score: 0,
      passed: 0,
      total: 0,
      status: 'JUDGE_ERROR',
      compileError: err.message,
    };
  }
};

module.exports = {
  evaluateCode,
  executeCode,
  AVAILABLE,
};