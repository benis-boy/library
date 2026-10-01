const { spawn } = require('node:child_process');
const { appendFileSync, closeSync, existsSync, fstatSync, mkdtempSync, openSync, readSync, rmSync, statSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const ENTRY_RELATIVE_PATH = path.join('node_modules', '@playwright', 'cli', 'playwright-cli.js');

function findEnvValue(env, name) {
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? env[key] : undefined;
}

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function resolveNodeExecutable(env = process.env, searchPath = findEnvValue(env, 'PATH') || '') {
  const explicitNode = findEnvValue(env, 'PLAYWRIGHT_NODE_EXECUTABLE');
  if (explicitNode) {
    if (isFile(explicitNode)) return path.resolve(explicitNode);
    throw new Error(`PLAYWRIGHT_NODE_EXECUTABLE does not point to an existing file: ${explicitNode}`);
  }
  const executable = process.platform === 'win32' ? 'node.exe' : 'node';
  for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory.replace(/^"|"$/g, ''), executable);
    if (isFile(candidate)) return path.resolve(candidate);
  }
  throw new Error('Could not find Node in PATH. Set PLAYWRIGHT_NODE_EXECUTABLE to the installed Node executable.');
}

function resolveCliEntry(env = process.env, searchPath = findEnvValue(env, 'PATH') || '') {
  const explicitEntry = findEnvValue(env, 'PLAYWRIGHT_CLI_ENTRY');
  if (explicitEntry) {
    if (existsSync(explicitEntry) && isFile(explicitEntry)) {
      return path.resolve(explicitEntry);
    }
    throw new Error(`PLAYWRIGHT_CLI_ENTRY does not point to an existing file: ${explicitEntry}`);
  }

  const candidates = new Set();
  for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
    const shimDirectory = directory.replace(/^"|"$/g, '');
    candidates.add(path.join(shimDirectory, ENTRY_RELATIVE_PATH));
    candidates.add(path.join(shimDirectory, '@playwright', 'cli', 'playwright-cli.js'));
    candidates.add(path.join(path.dirname(shimDirectory), ENTRY_RELATIVE_PATH));
    candidates.add(path.join(path.dirname(shimDirectory), '@playwright', 'cli', 'playwright-cli.js'));
    candidates.add(path.join(path.dirname(shimDirectory), 'lib', ENTRY_RELATIVE_PATH));
    candidates.add(path.join(path.dirname(shimDirectory), 'lib', 'node_modules', '@playwright', 'cli', 'playwright-cli.js'));
    for (const shimName of ['playwright-cli', 'playwright-cli.cmd', 'playwright-cli.ps1']) {
      if (existsSync(path.join(shimDirectory, shimName))) {
        candidates.add(path.join(shimDirectory, ENTRY_RELATIVE_PATH));
        candidates.add(path.join(path.dirname(shimDirectory), ENTRY_RELATIVE_PATH));
      }
    }
  }

  for (const candidate of candidates) {
    if (existsSync(candidate) && isFile(candidate)) return path.resolve(candidate);
  }
  throw new Error('Could not find @playwright/cli/playwright-cli.js in PATH npm shim directories. Set PLAYWRIGHT_CLI_ENTRY to its path.');
}

function boundedRead(file, limit) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const size = fstatSync(fd).size;
    const buffer = Buffer.alloc(Math.min(size, limit));
    const bytes = readSync(fd, buffer, 0, buffer.length, 0);
    return { text: buffer.subarray(0, bytes).toString('utf8'), bytes, truncated: size > limit };
  } catch {
    return { text: '', bytes: 0, truncated: false };
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* Already closed. */ }
    }
  }
}

function runCaptured(args, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  abortSignal,
  cwd = process.cwd(),
  env = process.env,
  maxOutputBytes = MAX_OUTPUT_BYTES,
} = {}) {
  const started = Date.now();
  return new Promise((resolve) => {
    let child;
    let directory;
    let stdoutFd;
    let stderrFd;
    let timedOut = false;
    let aborted = false;
    let settled = false;
    let stdoutPath;
    let stderrPath;

    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      abortSignal?.removeEventListener('abort', onAbort);
      for (const fd of [stdoutFd, stderrFd]) {
        if (fd !== undefined) {
          try { closeSync(fd); } catch { /* Already closed. */ }
        }
      }
      const stdoutResult = stdoutPath ? boundedRead(stdoutPath, maxOutputBytes) : { text: '', bytes: 0, truncated: false };
      const stderrResult = stderrPath ? boundedRead(stderrPath, Math.max(0, maxOutputBytes - stdoutResult.bytes)) : { text: '', bytes: 0, truncated: false };
      const stdout = stdoutResult.text + (stdoutResult.truncated ? '\n[output truncated]' : '');
      const stderr = stderrResult.text + (stderrResult.truncated ? '\n[output truncated]' : '');
      if (directory) scheduleCleanup(directory);
      resolve({ exitCode, stdout, stderr, timedOut, aborted, durationMs: Date.now() - started });
    };

    const stopChild = () => {
      if (child && child.exitCode === null && !child.killed) {
        try { child.kill(); } catch { /* The process may have exited concurrently. */ }
        child.unref();
      }
    };
    const onAbort = () => {
      if (settled) return;
      aborted = true;
      stopChild();
      finish(130);
    };
    const deadline = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      stopChild();
      finish(124);
    }, timeoutMs);

    if (abortSignal?.aborted) {
      onAbort();
      return;
    }
    abortSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      directory = mkdtempSync(path.join(os.tmpdir(), 'playwright-cli-capture-'));
      stdoutPath = path.join(directory, 'stdout.log');
      stderrPath = path.join(directory, 'stderr.log');
      stdoutFd = openSync(stdoutPath, 'w');
      stderrFd = openSync(stderrPath, 'w');
      const entry = resolveCliEntry(env);
      child = spawn(resolveNodeExecutable(env), [entry, ...args], {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', stdoutFd, stderrFd],
      });
      for (const fd of [stdoutFd, stderrFd]) {
        try { closeSync(fd); } catch { /* Child has its own inherited handle. */ }
      }
      stdoutFd = undefined;
      stderrFd = undefined;
      child.once('error', (error) => {
        if (settled) return;
        const message = `Unable to start Playwright CLI: ${error.message}\n`;
        try { if (stderrPath) appendFileSync(stderrPath, message); } catch { /* Return diagnostics best-effort. */ }
        finish(1);
      });
      child.once('exit', (code) => finish(timedOut ? 124 : (code === null ? 1 : code)));
    } catch (error) {
      const message = `Unable to run Playwright CLI: ${error.message}\n`;
      try { if (stderrPath) appendFileSync(stderrPath, message); } catch { /* Temp output is best-effort. */ }
      finish(1);
    }
  });
}

const READ_ONLY_GLOBAL_COMMANDS = new Set(['list', '--help', '-h', '--version', '-v']);
const FORBIDDEN_COMMANDS = new Set(['install', 'install-browser', 'close-all', 'kill-all', 'delete-data']);

function validateInvocation({ command, args = [], session }) {
  if (typeof command !== 'string' || !command.trim() || command.trim() !== command) {
    throw new Error('Provide one Playwright CLI command (without shell syntax).');
  }
  if (!/^(?:[a-z][a-z0-9-]*|--help|-h|--version|-v)$/.test(command)) {
    throw new Error('Command must be one Playwright CLI command name, without flags or shell syntax.');
  }
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new Error('CLI arguments must be an array of strings.');
  }
  const commandName = command.replace(/^--raw\s+/, '').replace(/^--json\s+/, '');
  if (FORBIDDEN_COMMANDS.has(commandName)) throw new Error(`The ${commandName} command is not available through browser_cli.`);
  const allTokens = [command, ...args];
  if (allTokens.some((arg) => /^--?(?:session(?:=|$)|s(?:=|$))/i.test(arg))) {
    throw new Error('Set the session field instead of passing a session flag.');
  }
  if (READ_ONLY_GLOBAL_COMMANDS.has(commandName)) {
    if (session) throw new Error(`${commandName} does not use a named session.`);
  } else {
    if (typeof session !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(session)) {
      throw new Error('A valid explicit session name is required for browser commands.');
    }
  }
  return READ_ONLY_GLOBAL_COMMANDS.has(commandName) ? [command, ...args] : [`-s=${session}`, command, ...args];
}

function scheduleCleanup(directory, attemptsRemaining = 40) {
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    if (attemptsRemaining > 0) {
      const retry = setTimeout(() => scheduleCleanup(directory, attemptsRemaining - 1), 100);
      retry.unref();
    }
  }
}

async function run(args, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const result = await runCaptured(args, { timeoutMs, maxOutputBytes: Infinity });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.timedOut) {
    process.stderr.write(`playwright-cli wrapper timed out after ${timeoutMs}ms; session may need a targeted close.\n`);
  }
  return result.exitCode;
}

if (require.main === module) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { run, runCaptured, resolveCliEntry, resolveNodeExecutable, validateInvocation, DEFAULT_TIMEOUT_MS, MAX_OUTPUT_BYTES };
