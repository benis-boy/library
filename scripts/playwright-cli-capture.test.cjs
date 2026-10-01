const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { runCaptured, resolveNodeExecutable, validateInvocation, MAX_OUTPUT_BYTES } = require('./playwright-cli.cjs');

function fixture(source) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'playwright-cli-capture-test-'));
  const entry = path.join(directory, 'fixture-cli.js');
  writeFileSync(entry, source);
  return { directory, entry, env: { ...process.env, PLAYWRIGHT_CLI_ENTRY: entry } };
}

test('captured runner returns bounded structured stdout, stderr, cwd, args, and exit code', async () => {
  const f = fixture(`
    process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));
    process.stderr.write('fixture stderr');
    process.exitCode = 17;
  `);
  try {
    const result = await runCaptured(['goto', 'https://example.test/?q=a&b=c'], { cwd: f.directory, env: f.env });
    assert.equal(result.exitCode, 17);
    assert.deepEqual(JSON.parse(result.stdout), { args: ['goto', 'https://example.test/?q=a&b=c'], cwd: f.directory });
    assert.equal(result.stderr, 'fixture stderr');
    assert.equal(result.timedOut, false);
    assert.equal(result.aborted, false);
    assert.ok(result.durationMs >= 0);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test('captured runner finds PATH regardless of Windows environment key casing', async () => {
  const f = fixture(`process.stdout.write('resolved');`);
  const shimDirectory = path.join(f.directory, 'bin');
  const nestedEntry = path.join(shimDirectory, 'node_modules', '@playwright', 'cli', 'playwright-cli.js');
  require('node:fs').mkdirSync(path.dirname(nestedEntry), { recursive: true });
  writeFileSync(nestedEntry, `process.stdout.write('from path');`);
  try {
    const result = await runCaptured([], { cwd: f.directory, env: { Path: `${shimDirectory}${path.delimiter}${path.dirname(process.execPath)}` } });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, 'from path');
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test('captured runner resolves installed Node when the runtime host is not Node', async () => {
  const f = fixture(`process.stdout.write(JSON.stringify({ executable: process.execPath, args: process.argv.slice(2) }));`);
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, 'execPath');
  const installedNode = process.execPath;
  try {
    Object.defineProperty(process, 'execPath', { ...originalDescriptor, value: path.join(f.directory, 'opencode.exe') });
    const result = await runCaptured(['--version'], {
      cwd: f.directory,
      env: { Path: path.dirname(installedNode), PLAYWRIGHT_CLI_ENTRY: f.entry },
    });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { executable: installedNode, args: ['--version'] });
  } finally {
    Object.defineProperty(process, 'execPath', originalDescriptor);
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test('Node executable override is case insensitive, validated, and independent of host and PATH', async () => {
  const f = fixture(`process.stdout.write('explicit Node');`);
  try {
    assert.equal(resolveNodeExecutable({ playwright_node_executable: process.execPath, Path: f.directory }), process.execPath);
    assert.throws(() => resolveNodeExecutable({ PLAYWRIGHT_NODE_EXECUTABLE: f.directory }), /does not point to an existing file/);
    assert.throws(() => resolveNodeExecutable({ PLAYWRIGHT_NODE_EXECUTABLE: path.join(f.directory, 'missing.exe') }), /does not point to an existing file/);
    assert.throws(() => resolveNodeExecutable({ Path: f.directory }), /Could not find Node in PATH/);
    const result = await runCaptured([], { env: { PLAYWRIGHT_CLI_ENTRY: f.entry, playwright_node_executable: process.execPath } });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stdout, 'explicit Node');
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test('custom tool execute matches installed helper contract from a nested session directory', async () => {
  const { pathToFileURL } = require('node:url');
  const ts = require('typescript');
  const toolPath = path.join(__dirname, '..', '.opencode', 'tools', 'browser_cli.ts');
  const helperPath = path.join(__dirname, '..', '.opencode', 'node_modules', '@opencode-ai', 'plugin', 'dist', 'tool.js');
  const helperTypes = readFileSync(helperPath.replace(/\.js$/, '.d.ts'), 'utf8');
  assert.match(helperTypes, /export type ToolResult = string \| \{/);
  assert.match(helperTypes, /output: string/);
  const source = readFileSync(toolPath, 'utf8')
    .replace('"@opencode-ai/plugin"', JSON.stringify(pathToFileURL(helperPath).href))
    .replace('import.meta.url', JSON.stringify(pathToFileURL(toolPath).href));
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  const { default: definition } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
  const f = fixture(`process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));`);
  const savedEntry = process.env.PLAYWRIGHT_CLI_ENTRY;
  try {
    const cwd = path.join(f.directory, 'nested');
    mkdirSync(cwd);
    process.env.PLAYWRIGHT_CLI_ENTRY = f.entry;
    const context = { directory: cwd, worktree: f.directory, abort: new AbortController().signal };
    const result = await definition.execute({ command: 'snapshot', args: [], session: 'owned-fixture' }, context);
    assert.equal(typeof result.output, 'string');
    assert.equal(result.title, 'Playwright CLI: snapshot');
    const captured = JSON.parse(result.output);
    assert.equal(captured.exitCode, 0, captured.stderr);
    assert.deepEqual(JSON.parse(captured.stdout), { args: ['-s=owned-fixture', 'snapshot'], cwd });
    assert.equal(captured.timedOut, false);
    assert.equal(captured.aborted, false);
    assert.deepEqual(result.metadata, { ...captured, session: 'owned-fixture' });
    const rejected = await definition.execute({ command: 'close-all', args: [] }, context);
    assert.equal(JSON.parse(rejected.output).exitCode, 2);
    assert.deepEqual(rejected.metadata, { rejected: true });
  } finally {
    if (savedEntry === undefined) delete process.env.PLAYWRIGHT_CLI_ENTRY;
    else process.env.PLAYWRIGHT_CLI_ENTRY = savedEntry;
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test('captured runner timeout returns structured result and kills the direct child', async () => {
  const f = fixture(`process.stdout.write('before timeout'); setInterval(() => {}, 20);`);
  try {
    const result = await runCaptured(['open'], { cwd: f.directory, env: f.env, timeoutMs: 120 });
    assert.equal(result.exitCode, 124);
    assert.equal(result.stdout, 'before timeout');
    assert.equal(result.timedOut, true);
    assert.equal(result.aborted, false);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test('captured runner abort settles promptly and reports abort separately from timeout', async () => {
  const f = fixture(`setInterval(() => {}, 20);`);
  const controller = new AbortController();
  try {
    const pending = runCaptured(['snapshot'], { cwd: f.directory, env: f.env, timeoutMs: 5000, abortSignal: controller.signal });
    setTimeout(() => controller.abort(), 80);
    const result = await pending;
    assert.equal(result.exitCode, 130);
    assert.equal(result.aborted, true);
    assert.equal(result.timedOut, false);
    assert.ok(result.durationMs < 1000);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test('captured runner returns promptly when descendant retains inherited file descriptors', async () => {
  const f = fixture(`
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', 'setTimeout(() => {}, 800)'], { stdio: 'inherit', windowsHide: true });
    process.stdout.write('parent done');
    process.exit(0);
  `);
  try {
    const started = Date.now();
    const result = await runCaptured(['list'], { cwd: f.directory, env: f.env });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, 'parent done');
    assert.ok(Date.now() - started < 500, 'runner must settle on direct child exit, not descriptor closure');
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test('captured runner caps combined output at the configured limit', async () => {
  const f = fixture(`process.stdout.write('x'.repeat(${MAX_OUTPUT_BYTES + 1000}));`);
  try {
    const result = await runCaptured(['snapshot'], { cwd: f.directory, env: f.env });
    assert.ok(Buffer.byteLength(result.stdout) <= MAX_OUTPUT_BYTES + 32);
    assert.match(result.stdout, /\[output truncated\]$/);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test('browser invocation requires its own session and rejects lifecycle/destructive scope', () => {
  assert.throws(() => validateInvocation({ command: 'goto', args: ['https://example.test'] }), /explicit session name/);
  assert.throws(() => validateInvocation({ command: 'goto', args: ['--session=other'], session: 'owned' }), /session flag/);
  assert.throws(() => validateInvocation({ command: 'close-all' }), /not available/);
  assert.throws(() => validateInvocation({ command: 'delete-data', session: 'owned' }), /not available/);
  assert.deepEqual(validateInvocation({ command: 'goto', args: ['https://example.test/?q=a&b=c'], session: 'owned' }), ['-s=owned', 'goto', 'https://example.test/?q=a&b=c']);
  assert.deepEqual(validateInvocation({ command: 'list' }), ['list']);
});
