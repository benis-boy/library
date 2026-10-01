const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const wrapperPath = path.join(__dirname, 'playwright-cli.cjs');

function makeFixture(source) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'playwright-cli-test-'));
  const entry = path.join(directory, 'fixture-cli.js');
  writeFileSync(entry, source);
  return { directory, entry };
}

test('launcher forwards args, workspace, stdout, stderr, and CLI exit code', () => {
  const fixture = makeFixture(`
    process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));
    process.stderr.write('fixture stderr\\n');
    process.exitCode = 23;
  `);

  try {
    const cwd = fixture.directory;
    const result = spawnSync(process.execPath, [wrapperPath, '-s=name', 'open', 'https://example.test/a?b=c'], {
      cwd,
      env: { ...process.env, PLAYWRIGHT_CLI_ENTRY: fixture.entry },
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 23);
    assert.notEqual(result.stdout, '', 'standalone runner must forward captured stdout');
    assert.deepEqual(JSON.parse(result.stdout), {
      args: ['-s=name', 'open', 'https://example.test/a?b=c'],
      cwd,
    });
    assert.equal(result.stderr, 'fixture stderr\n');
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('launcher exits on child exit without waiting for descendant stdio handles', () => {
  const fixture = makeFixture(`
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], { stdio: 'inherit', windowsHide: true });
    process.stdout.write('parent output\\n');
    process.stderr.write('parent error\\n');
    process.exit(0);
  `);

  try {
    const started = Date.now();
    const result = spawnSync(process.execPath, [wrapperPath, 'open'], {
      cwd: fixture.directory,
      env: { ...process.env, PLAYWRIGHT_CLI_ENTRY: fixture.entry },
      encoding: 'utf8',
      timeout: 2500,
      windowsHide: true,
    });
    const elapsed = Date.now() - started;
    assert.ifError(result.error);
    assert.equal(result.status, 0);
    assert.notEqual(result.stdout, '', 'inherited descendant handles must not discard parent output');
    assert.equal(result.stdout, 'parent output\n');
    assert.equal(result.stderr, 'parent error\n');
    assert.ok(elapsed < 900, `wrapper waited ${elapsed}ms for descendant handles`);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('launcher deadline kills its direct child and returns 124', () => {
  const fixture = makeFixture(`
    process.stdout.write('before timeout\\n');
    setInterval(() => {}, 20);
  `);
  try {
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(wrapperPath)}).run(['open'], { timeoutMs: 150 }).then(code => { process.exitCode = code; });`], {
      cwd: fixture.directory,
      env: { ...process.env, PLAYWRIGHT_CLI_ENTRY: fixture.entry },
      encoding: 'utf8',
      timeout: 2500,
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 124);
    assert.notEqual(result.stdout, '', 'deadline must preserve output already captured');
    assert.equal(result.stdout, 'before timeout\n');
    assert.equal(result.stderr, 'playwright-cli wrapper timed out after 150ms; session may need a targeted close.\n');
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('explicit CLI entry must exist', () => {
  const { resolveCliEntry } = require('./playwright-cli.cjs');
  assert.throws(
    () => resolveCliEntry({ PLAYWRIGHT_CLI_ENTRY: path.join(os.tmpdir(), 'missing-playwright-cli-entry.js') }),
    /PLAYWRIGHT_CLI_ENTRY does not point to an existing file/,
  );
});

test('launcher resolves the package beside an npm shim directory', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'playwright-cli-path-test-'));
  const shimDirectory = path.join(fixture, 'bin');
  const entry = path.join(shimDirectory, 'node_modules', '@playwright', 'cli', 'playwright-cli.js');
  mkdirSync(path.dirname(entry), { recursive: true });
  writeFileSync(entry, '// fixture');

  try {
    const { resolveCliEntry } = require('./playwright-cli.cjs');
    assert.equal(resolveCliEntry({ PATH: shimDirectory }), entry);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
