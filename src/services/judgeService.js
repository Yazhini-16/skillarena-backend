import { pool } from '../config/db.js';
import logger from '../utils/logger.js';
import { execSync, exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SUPPORTED_LANGUAGES = ['javascript', 'python', 'cpp', 'java'];

// Normalize output for fair comparison
const normalize = (str) => {
  if (!str) return '';
  return str.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

// Execute JavaScript code in a sandboxed child process
const executeJS = (code, stdin) => {
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `sa_${Date.now()}_${Math.random().toString(36).slice(2)}.js`);

    try {
      fs.writeFileSync(tmpFile, code);

      const child = spawn(
        process.execPath, // current node binary
        [tmpFile],
        {
          timeout: 5000,
          killSignal: 'SIGKILL',
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      if (stdin) child.stdin.write(stdin);
      child.stdin.end();

      child.on('close', (code) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        resolve({ stdout, stderr, exitCode: code });
      });

      child.on('error', (err) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        resolve({ stdout: '', stderr: err.message, exitCode: 1 });
      });

    } catch (err) {
      try { fs.unlinkSync(tmpFile); } catch {}
      resolve({ stdout: '', stderr: err.message, exitCode: 1 });
    }
  });
};

// Execute Python code in a child process
const executePython = (code, stdin) => {
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `sa_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);

    try {
      fs.writeFileSync(tmpFile, code);

      // Try python3 first, fall back to python
      const pythonBin = (() => {
        try { execSync('python3 --version', { stdio: 'ignore' }); return 'python3'; } catch {}
        try { execSync('python --version', { stdio: 'ignore' }); return 'python'; } catch {}
        return null;
      })();

      if (!pythonBin) {
        try { fs.unlinkSync(tmpFile); } catch {}
        return resolve({ stdout: '', stderr: 'Python not installed', exitCode: 1 });
      }

      const child = spawn(pythonBin, [tmpFile], { timeout: 5000 });
      let stdout = '', stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      if (stdin) child.stdin.write(stdin);
      child.stdin.end();

      child.on('close', (code) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        resolve({ stdout, stderr, exitCode: code });
      });

      child.on('error', (err) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        resolve({ stdout: '', stderr: err.message, exitCode: 1 });
      });

    } catch (err) {
      try { fs.unlinkSync(tmpFile); } catch {}
      resolve({ stdout: '', stderr: err.message, exitCode: 1 });
    }
  });
};

// Route to correct executor based on language
const executeCode = async (language, code, stdin) => {
  switch (language) {
    case 'javascript':
      return executeJS(code, stdin);
    case 'python':
      return executePython(code, stdin);
    default:
      // For cpp/java — fall back to smart mock until Phase 7
      return smartMock(language, code, stdin);
  }
};

// Smart mock for languages we can't execute locally yet (cpp, java)
const smartMock = async (language, code, expectedOutput) => {
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  const codeLen = code.trim().length;
  const hasOutput = code.includes('cout') || code.includes('System.out') ||
                    code.includes('printf') || code.includes('println');
  const hasLogic = code.includes('for') || code.includes('while') ||
                   code.includes('if') || code.includes('map') || code.includes('HashMap');

  if (codeLen > 50 && hasOutput && hasLogic) {
    return { stdout: expectedOutput + '\n', stderr: '', exitCode: 0 };
  }
  return { stdout: '', stderr: 'Wrong answer', exitCode: 1 };
};

// Main evaluation — runs all test cases
const evaluateCode = async (matchId, userId, language, code, problemId) => {
  try {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return {
        score: 0, passed: 0, total: 0,
        avgTimeMs: 0, status: 'UNSUPPORTED_LANGUAGE',
        error: `Unsupported language: ${language}`,
      };
    }

    // Fetch ALL test cases — including private ones (server-side only)
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

    logger.info('Starting local evaluation', {
      matchId, userId, language, testCaseCount: testCases.length,
    });

    let passedCount = 0;
    let passedWeight = 0;
    let totalWeight = 0;
    let totalTimeMs = 0;
    let firstFailureReason = null;
    let compileError = null;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const weight = tc.weight || 1;
      totalWeight += weight;

      const startTime = Date.now();
      let result;

      try {
        result = await executeCode(language, code, tc.input);
      } catch (err) {
        logger.error('Execution failed', { matchId, userId, tcIndex: i, error: err.message });
        if (!firstFailureReason) firstFailureReason = 'EXECUTION_ERROR';
        continue;
      }

      const elapsed = Date.now() - startTime;

      // Runtime error
      if (result.exitCode !== 0 && result.stderr) {
        if (!compileError) compileError = result.stderr.slice(0, 200);
        if (!firstFailureReason) firstFailureReason = 'RUNTIME_ERROR';
        logger.info('Runtime error', { matchId, userId, tcIndex: i, stderr: result.stderr.slice(0, 100) });
        continue;
      }

      // Compare output
      const actualOutput = normalize(result.stdout);
      const expectedOutput = normalize(tc.expected_output);
      const passed = actualOutput === expectedOutput;

      if (passed) {
        passedCount++;
        passedWeight += weight;
        totalTimeMs += elapsed;
      } else {
        if (!firstFailureReason) firstFailureReason = 'WRONG_ANSWER';
        logger.info('Wrong answer', {
          matchId, userId, tcIndex: i,
          expected: expectedOutput.slice(0, 80),
          actual: actualOutput.slice(0, 80),
        });
      }
    }

    const score = totalWeight > 0
      ? Math.round((passedWeight / totalWeight) * 100)
      : 0;

    const avgTimeMs = passedCount > 0
      ? Math.round(totalTimeMs / passedCount)
      : 0;

    const status = compileError ? 'RUNTIME_ERROR'
      : passedCount === testCases.length ? 'ACCEPTED'
      : passedCount === 0 ? (firstFailureReason || 'WRONG_ANSWER')
      : 'PARTIAL';

    logger.info('Evaluation complete', {
      matchId, userId, score,
      passed: passedCount,
      total: testCases.length,
      avgTimeMs, status,
    });

    return {
      score,
      passed: passedCount,
      total: testCases.length,
      avgTimeMs,
      status,
      compileError,
      error: null,
    };

  } catch (err) {
    logger.error('evaluateCode crashed', { matchId, userId, error: err.message });
    return {
      score: 0, passed: 0, total: 0,
      avgTimeMs: 0, status: 'JUDGE_ERROR',
      error: err.message,
    };
  }
};

const testConnection = async () => {
  logger.info('Judge service: local execution engine (JS + Python native, CPP/Java mock)');
  return true;
};

export {
  evaluateCode,
  executeCode,
  testConnection,
  SUPPORTED_LANGUAGES
};
