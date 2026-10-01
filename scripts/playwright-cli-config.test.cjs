const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

test('Playwright CLI uses full Chromium channel and preserves default headless mode', () => {
  const configPath = join(__dirname, '..', '.playwright', 'cli.config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  assert.equal(config.browser.browserName, 'chromium');
  assert.equal(config.browser.launchOptions.channel, 'chromium');
  assert.equal(Object.hasOwn(config.browser.launchOptions, 'headless'), false);
});
