const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'patreon-oauth.js'), 'utf8');
const campaignId = '12346885';
const secrets = {
  NETLIFY_SECRET_PASSWORD: 'v1-secret',
  WTDR_SECRET_PASSWORD: 'wtdr-secret',
  SOWB_SECRET_PASSWORD: 'sowb-secret',
  COMMENTS_AUTH_SECRET: 'comments-secret',
};

const parseSuccessLog = (message) => JSON.parse(message.slice('po:success '.length));

const member = (attributes = {}, id = campaignId) => ({
  type: 'member',
  attributes,
  relationships: {
    campaign: { data: { id } },
    currently_entitled_tiers: { data: [{ id: 'tier-1', type: 'tier' }] },
  },
});

const identity = (members = [], attributes = {}) => ({
  data: { id: 'patreon-user-42', attributes: { vanity: 'reader-name', full_name: 'Reader Name', ...attributes } },
  included: members,
});

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const createHarness = ({ identityData = identity([member({ patron_status: 'active_patron' })]), token = { access_token: 'access-secret', refresh_token: 'refresh-output' }, env = secrets, fetchImpl, consoleLog } = {}) => {
  const calls = [];
  const logs = [];
  const successLogs = [];
  const fetch = fetchImpl ?? (async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? response(token) : response(identityData);
  });
  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require: (name) => {
      assert.equal(name, 'crypto');
      return crypto;
    },
    process: { env: { ...env } },
    fetch,
    URL,
    URLSearchParams,
    Number,
    JSON,
    console: {
      error: (...values) => logs.push(values),
      log: consoleLog ?? ((...values) => successLogs.push(values)),
    },
  };
  vm.runInNewContext(source, context, { filename: 'patreon-oauth.js' });
  return { handler: module.exports.handler, calls, logs, successLogs };
};

const invoke = (handler, body = { code: 'authorization-code' }, method = 'POST') =>
  handler({ httpMethod: method, body: typeof body === 'string' ? body : JSON.stringify(body) });

const parseBody = (result) => JSON.parse(result.body);

test('Patreon OAuth grants all configured keys to active and qualifying former patrons', async () => {
  for (const membership of [
    member({ patron_status: 'active_patron', campaign_lifetime_support_cents: 0 }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 501 }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 501, currently_entitled_amount_cents: 0 }),
    member({ patron_status: 'declined_patron', campaign_lifetime_support_cents: 501 }),
  ]) {
    const { handler } = createHarness({ identityData: identity([membership]) });
    const result = await invoke(handler);
    const body = parseBody(result);
    assert.equal(result.statusCode, 200);
    assert.equal(body.userInfo.supportsMe, true);
    assert.equal(body.encryption_password, secrets.NETLIFY_SECRET_PASSWORD);
    assert.deepEqual(body.encryption_passwordv2, { WtDR: secrets.WTDR_SECRET_PASSWORD, SoWB: secrets.SOWB_SECRET_PASSWORD });
    assert.deepEqual(body.membershipData.attributes, membership.attributes);
  }
});

test('Patreon OAuth grants owner access without membership and signs the verified Patreon identity', async () => {
  for (const included of [
    undefined,
    [],
    [member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 500 })],
  ]) {
    const ownerIdentity = { data: { id: '101723637', attributes: { vanity: 'owner' } }, included };
    const { handler } = createHarness({ identityData: ownerIdentity });
    const body = parseBody(await invoke(handler));
    const expectedSignedUser = crypto.createHmac('sha256', secrets.COMMENTS_AUTH_SECRET).update('101723637').digest('base64url');

    assert.equal(body.patreonUserId, '101723637');
    assert.equal(body.userInfo.supportsMe, true);
    assert.equal(body.encryption_password, secrets.NETLIFY_SECRET_PASSWORD);
    assert.deepEqual(body.encryption_passwordv2, { WtDR: secrets.WTDR_SECRET_PASSWORD, SoWB: secrets.SOWB_SECRET_PASSWORD });
    assert.equal(body.signedUser, expectedSignedUser);
    assert.deepEqual(body.membershipData, included?.[0] ?? null);
  }
});

test('Patreon OAuth does not grant owner access from a similar ID, username, or client-supplied identity', async () => {
  for (const ownerIdentity of [
    { data: { id: '101723638', attributes: { vanity: 'ordinary-reader' } }, included: [] },
    { data: { id: '1017236370', attributes: { vanity: '101723637' } }, included: [] },
  ]) {
    const { handler } = createHarness({ identityData: ownerIdentity });
    const body = parseBody(await invoke(handler, { code: 'authorization-code', patreonUserId: '101723637', userName: 'owner' }));

    assert.equal(body.userInfo.supportsMe, false);
    assert.equal(body.encryption_password, 'NOT_ALLOWED');
    assert.deepEqual(body.encryption_passwordv2, { WtDR: 'NOT_ALLOWED', SoWB: 'NOT_ALLOWED' });
  }
});

test('Patreon OAuth denies nonqualifying or non-own campaign membership and ignores legacy bypasses', async () => {
  const excludedMemberships = [
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 500 }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 0, currently_entitled_amount_cents: 50000 }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 499 }),
    member({ patron_status: 'former_patron' }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: null }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: '501' }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: NaN }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: -1 }),
    member({ patron_status: 'former_patron', lifetime_support_cents: 9000 }),
    member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 9000 }, 'other-campaign'),
    member({ patron_status: 'active_patron', campaign_lifetime_support_cents: 0 }, 'other-campaign'),
  ];
  for (const memberships of [...excludedMemberships.map((entry) => [entry]), [], null, undefined]) {
    const data = identity(memberships);
    data.data.attributes.vanity = 'BenisBoy16';
    const { handler } = createHarness({ identityData: data });
    const body = parseBody(await invoke(handler));
    assert.equal(body.userInfo.supportsMe, false);
    assert.equal(body.encryption_password, 'NOT_ALLOWED');
    assert.deepEqual(body.encryption_passwordv2, { WtDR: 'NOT_ALLOWED', SoWB: 'NOT_ALLOWED' });
  }
});

test('Patreon OAuth lifetime eligibility requires over 500 campaign cents and ignores current entitlement', async () => {
  for (const [lifetime, currentlyEntitled, expected] of [
    [500, 0, false],
    [501, 0, true],
    [0, 50000, false],
  ]) {
    const { handler } = createHarness({
      identityData: identity([member({ patron_status: 'former_patron', campaign_lifetime_support_cents: lifetime, currently_entitled_amount_cents: currentlyEntitled })]),
    });
    const body = parseBody(await invoke(handler));
    assert.equal(body.userInfo.supportsMe, expected, `lifetime=${lifetime}, current=${currentlyEntitled}`);
    assert.equal(body.encryption_password, expected ? secrets.NETLIFY_SECRET_PASSWORD : 'NOT_ALLOWED');
  }

  const otherCampaign = createHarness({
    identityData: identity([member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 10000 }, 'other-campaign')]),
  });
  assert.equal(parseBody(await invoke(otherCampaign.handler)).userInfo.supportsMe, false);
});

test('Patreon OAuth sends credentials in the form body and signs stable identity', async () => {
  const { handler, calls } = createHarness();
  const result = await invoke(handler, { code: 'code-value', refresh_token: 'refresh-value' });
  const body = parseBody(result);
  const tokenRequest = calls[0];
  const tokenForm = new URLSearchParams(tokenRequest.options.body);
  const identityRequest = calls[1];
  const expectedSignedUser = crypto.createHmac('sha256', secrets.COMMENTS_AUTH_SECRET).update('patreon-user-42').digest('base64url');

  assert.equal(tokenRequest.url, 'https://www.patreon.com/api/oauth2/token');
  assert.equal(tokenRequest.options.method, 'POST');
  assert.equal(tokenRequest.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(tokenRequest.options.headers['User-Agent'], 'BenisBoyLibrary/1.0 (+https://benis-boy.github.io/library/)');
  assert.equal(tokenForm.get('grant_type'), 'authorization_code');
  assert.equal(tokenForm.get('client_id'), 'DCmpYjAt5oF-1poN2N_hW22VXTuz8BNIOPk1yeoctffuvobAJCu8I7N7fKc1ngMp');
  assert.equal(tokenForm.get('code'), 'code-value');
  assert.equal(tokenForm.get('redirect_uri'), 'https://benis-boy.github.io/library/');
  assert.equal(tokenForm.get('refresh_token'), null);
  assert.equal(new URL(tokenRequest.url).search, '');
  assert.equal(identityRequest.url, 'https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers%2Cmemberships.campaign&fields%5Buser%5D=full_name%2Cvanity&fields%5Bmember%5D=campaign_lifetime_support_cents%2Ccurrently_entitled_amount_cents%2Cpatron_status%2Cpledge_cadence');
  assert.equal(identityRequest.options.method, 'GET');
  assert.equal(identityRequest.options.headers.Authorization, 'Bearer access-secret');
  assert.equal(identityRequest.options.headers['User-Agent'], tokenRequest.options.headers['User-Agent']);
  assert.equal(body.patreonUserId, 'patreon-user-42');
  assert.equal(body.signedUser, expectedSignedUser);
  assert.equal(body.userInfo.userName, 'reader-name');
  assert.equal(body.userInfo.currently_entitled_tiers.data[0].id, 'tier-1');
});

test('Patreon OAuth sends refresh grant parameters in the form body', async () => {
  const { handler, calls } = createHarness();
  await invoke(handler, { refresh_token: 'refresh-value' });
  const request = calls[0];
  const form = new URLSearchParams(request.options.body);
  assert.equal(form.get('grant_type'), 'refresh_token');
  assert.equal(form.get('client_id'), 'DCmpYjAt5oF-1poN2N_hW22VXTuz8BNIOPk1yeoctffuvobAJCu8I7N7fKc1ngMp');
  assert.equal(form.get('refresh_token'), 'refresh-value');
  assert.equal(form.get('redirect_uri'), 'https://benis-boy.github.io/library/');
  assert.equal(form.get('code'), null);
  assert.equal(new URL(request.url).search, '');
});

test('Patreon OAuth validates malformed requests and restricts methods', async () => {
  const { handler } = createHarness();
  for (const body of ['{', 'null', '[]', '"code"', '{}', { code: 5 }, { refresh_token: null }, { code: '', refresh_token: '' }]) {
    assert.equal((await invoke(handler, body)).statusCode, 400);
  }
  assert.equal((await invoke(handler, {}, 'OPTIONS')).statusCode, 200);
  assert.equal((await invoke(handler, {}, 'GET')).statusCode, 405);
});

test('Patreon OAuth safely fails for missing eligible keys or comments signing configuration', async () => {
  for (const missing of ['NETLIFY_SECRET_PASSWORD', 'WTDR_SECRET_PASSWORD', 'SOWB_SECRET_PASSWORD', 'COMMENTS_AUTH_SECRET']) {
    const env = { ...secrets };
    delete env[missing];
    const { handler } = createHarness({ env });
    const result = await invoke(handler);
    assert.equal(result.statusCode, 500);
    assert.doesNotMatch(result.body, /secret|access-secret|v1-secret|wtdr-secret|sowb-secret/i);
  }

  const ineligibleEnv = { COMMENTS_AUTH_SECRET: secrets.COMMENTS_AUTH_SECRET };
  const { handler } = createHarness({
    identityData: identity([member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 500 })]),
    env: ineligibleEnv,
  });
  const denied = parseBody(await invoke(handler));
  assert.equal(denied.userInfo.supportsMe, false);
  assert.equal(denied.encryption_password, 'NOT_ALLOWED');
  assert.deepEqual(denied.encryption_passwordv2, { WtDR: 'NOT_ALLOWED', SoWB: 'NOT_ALLOWED' });
});

test('Patreon OAuth rejects invalid access tokens and identities without exposing credentials', async () => {
  for (const token of [{}, { access_token: '' }, { access_token: null }]) {
    const { handler } = createHarness({ token });
    const result = await invoke(handler);
    assert.equal(result.statusCode, 500);
    assert.doesNotMatch(result.body, /access-secret|v1-secret|wtdr-secret|sowb-secret/i);
  }

  for (const identityData of [
    { data: { attributes: {} }, included: [] },
    { data: { id: '', attributes: {} }, included: [] },
    { data: { id: 42, attributes: {} }, included: [] },
  ]) {
    const { handler } = createHarness({ identityData });
    const result = await invoke(handler);
    assert.equal(result.statusCode, 500);
    assert.doesNotMatch(result.body, /access-secret|v1-secret|wtdr-secret|sowb-secret/i);
  }
});

test('Patreon OAuth protects internal network and identity failures from sensitive details', async () => {
  for (const stage of ['token-network', 'identity-network', 'identity-http', 'identity-json']) {
    let count = 0;
    const sensitiveError = 'access-secret v1-secret private-upstream-response';
    const fetchImpl = async () => {
      count += 1;
      if (stage === 'token-network' || (stage !== 'token-network' && count === 2 && stage === 'identity-network')) {
        throw new Error(sensitiveError);
      }
      if (count === 1) return response({ access_token: 'access-secret' });
      if (stage === 'identity-http') return response({ detail: sensitiveError }, 502);
      if (stage === 'identity-json') return { ok: true, json: async () => { throw new Error(sensitiveError); } };
      return response(identity([member({ patron_status: 'active_patron' })]));
    };
    const { handler } = createHarness({ fetchImpl });
    const result = await invoke(handler);
    assert.equal(result.statusCode, 500, stage);
    assert.doesNotMatch(result.body, /access-secret|v1-secret|private-upstream-response/);
  }
});

test('Patreon OAuth preserves token endpoint error status and body', async () => {
  const tokenError = { error: 'invalid_grant', error_description: 'The supplied grant is invalid.' };
  const { handler } = createHarness({ fetchImpl: async () => response(tokenError, 400) });
  const result = await invoke(handler);
  assert.equal(result.statusCode, 400);
  assert.deepEqual(parseBody(result), tokenError);
});

test('Patreon OAuth success diagnostics include only sanitized campaign membership fields', async () => {
  const cases = [
    {
      identityData: identity([member({ patron_status: 'active_patron', campaign_lifetime_support_cents: 0 })]),
      expected: { patron_status: 'active_patron', lifetimeSupport: 0 },
      supportsMe: true,
    },
    {
      identityData: identity([member({ patron_status: 'former_patron', campaign_lifetime_support_cents: 501 })]),
      expected: { patron_status: 'former_patron', lifetimeSupport: 501 },
      supportsMe: true,
    },
    {
      identityData: identity([member({ patron_status: 'declined_patron', campaign_lifetime_support_cents: 500 })]),
      expected: { patron_status: 'declined_patron', lifetimeSupport: 500 },
      supportsMe: false,
    },
    {
      identityData: { data: { id: '101723637', attributes: { vanity: 'owner' } } },
      expected: { patron_status: null, lifetimeSupport: null },
      supportsMe: true,
    },
    {
      identityData: identity([member({ patron_status: 'untrusted-upstream-status', campaign_lifetime_support_cents: '501' })]),
      expected: { patron_status: null, lifetimeSupport: null },
      supportsMe: false,
    },
    {
      identityData: identity([member({ patron_status: 'former_patron', campaign_lifetime_support_cents: -1 })]),
      expected: { patron_status: 'former_patron', lifetimeSupport: null },
      supportsMe: false,
    },
    {
      identityData: identity([member({ patron_status: 'former_patron', campaign_lifetime_support_cents: Infinity })]),
      expected: { patron_status: 'former_patron', lifetimeSupport: null },
      supportsMe: false,
    },
  ];

  for (const { identityData, expected, supportsMe } of cases) {
    const harness = createHarness({ identityData });
    const result = await invoke(harness.handler);
    assert.equal(result.statusCode, 200);
    assert.equal(parseBody(result).userInfo.supportsMe, supportsMe);
    assert.deepEqual(harness.successLogs, [[`po:success ${JSON.stringify({ ...expected, userName: identityData.data?.attributes?.vanity ?? identityData.data?.attributes?.full_name ?? 'CouldNotFindName' })}`]]);
    assert.deepEqual(harness.logs, []);
    assert.doesNotMatch(JSON.stringify(harness.successLogs), /patreon-user-42|101723637|access-secret|refresh-output|v1-secret|wtdr-secret|sowb-secret/);
  }
});

test('Patreon OAuth success diagnostics log only verified bounded username safely', async () => {
  const names = [
    { attributes: { vanity: 'verified-vanity', full_name: 'Full Name' }, expected: 'verified-vanity' },
    { attributes: { vanity: null, full_name: 'Full Name' }, expected: 'Full Name' },
    { attributes: { vanity: null, full_name: null }, expected: 'CouldNotFindName' },
    { attributes: { vanity: 42, full_name: 'Full Name' }, expected: null },
    { attributes: { vanity: `first\n${'x'.repeat(220)}` }, expected: `first\n${'x'.repeat(194)}` },
  ];

  for (const { attributes, expected } of names) {
    const identityData = identity([], attributes);
    const { handler, successLogs, logs } = createHarness({ identityData });
    const result = await invoke(handler, { code: 'authorization-code', userName: 'spoofed-request-name' });
    assert.equal(result.statusCode, 200);
    assert.equal(parseBody(result).userInfo.userName, attributes.vanity ?? attributes.full_name ?? 'CouldNotFindName');
    assert.equal(successLogs.length, 1);
    const message = successLogs[0][0];
    assert.equal(message.startsWith('po:success '), true);
    assert.equal(message.includes('\n'), false, 'diagnostic must remain one physical line');
    assert.deepEqual(parseSuccessLog(message), { patron_status: null, lifetimeSupport: null, userName: expected });
    assert.doesNotMatch(message, /spoofed-request-name|patreon-user-42|access-secret|v1-secret|wtdr-secret|sowb-secret/);
    assert.deepEqual(logs, []);
  }

  const astralName = '😀'.repeat(205);
  const astralHarness = createHarness({ identityData: identity([], { vanity: astralName }) });
  await invoke(astralHarness.handler);
  assert.equal(Array.from(parseSuccessLog(astralHarness.successLogs[0][0]).userName).length, 200);

  const nullNameHarness = createHarness({ identityData: identity([], { vanity: null, full_name: 123 }) });
  const nullNameResult = await invoke(nullNameHarness.handler);
  assert.equal(parseBody(nullNameResult).userInfo.userName, 123);
  assert.equal(parseSuccessLog(nullNameHarness.successLogs[0][0]).userName, null);
});

test('Patreon OAuth successful logging remains nonfatal when console logging throws', async () => {
  const { handler } = createHarness({ consoleLog: () => { throw new Error('logging unavailable'); } });
  const result = await invoke(handler);
  assert.equal(result.statusCode, 200);
  assert.equal(parseBody(result).userInfo.supportsMe, true);
});

test('Patreon OAuth logging emits success diagnostics only after successful responses and keeps compact failure codes', async () => {
  const quietCases = [
    { method: 'OPTIONS' },
    { method: 'GET' },
    { body: '{' },
  ];
  for (const options of quietCases) {
    const { handler, logs, successLogs } = createHarness(options);
    const result = await invoke(handler, options.body ?? { code: 'authorization-code' }, options.method ?? 'POST');
    assert.equal(logs.length, 0);
    assert.equal(successLogs.length, 0);
  }

  const tokenHttp = createHarness({ fetchImpl: async () => response({ error: 'invalid_grant' }, 401) });
  const tokenHttpResult = await invoke(tokenHttp.handler);
  assert.equal(tokenHttpResult.statusCode, 401);
  assert.deepEqual(parseBody(tokenHttpResult), { error: 'invalid_grant' });
  assert.deepEqual(tokenHttp.logs, [['po:token-http:401']]);
  assert.deepEqual(tokenHttp.successLogs, []);

  const identityHttp = createHarness({ fetchImpl: async (_url, options) =>
    options.method === 'POST' ? response({ access_token: 'access-secret' }) : response({ ignored: true }, 403) });
  assert.equal((await invoke(identityHttp.handler)).statusCode, 500);
  assert.deepEqual(identityHttp.logs, [['po:identity-http:403']]);
  assert.deepEqual(identityHttp.successLogs, []);

  const failures = [
    { code: 'token-fetch', fetchImpl: async () => { throw new Error('private token network detail'); } },
    { code: 'token-json', fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('private token JSON detail'); } }) },
    { code: 'token-data', token: { access_token: '' } },
    { code: 'identity-fetch', fetchImpl: async (_url, options) => options.method === 'POST' ? response({ access_token: 'access-secret' }) : Promise.reject(new Error('private identity network detail')) },
    { code: 'identity-json', fetchImpl: async (_url, options) => options.method === 'POST' ? response({ access_token: 'access-secret' }) : ({ ok: true, json: async () => { throw new Error('private identity JSON detail'); } }) },
    { code: 'identity-data', identityData: { data: { id: '' }, included: [] } },
  ];
  for (const failure of failures) {
    const { code, ...options } = failure;
    const harness = createHarness(options);
    const result = await invoke(harness.handler);
    assert.equal(result.statusCode, 500, code);
    assert.deepEqual(harness.logs, [[`po:${code}`]], code);
    assert.deepEqual(harness.successLogs, [], code);
  }

  for (const [environmentName, code] of [
    ['NETLIFY_SECRET_PASSWORD', 'key-v1'],
    ['WTDR_SECRET_PASSWORD', 'key-WtDR'],
    ['SOWB_SECRET_PASSWORD', 'key-SoWB'],
    ['COMMENTS_AUTH_SECRET', 'comments-config'],
  ]) {
    const env = { ...secrets };
    delete env[environmentName];
    const harness = createHarness({ env });
    assert.equal((await invoke(harness.handler)).statusCode, 500);
    assert.deepEqual(harness.logs, [[`po:${code}`]]);
    assert.deepEqual(harness.successLogs, []);
  }

  const malicious = new Error('access-secret private-upstream-response private-user-name');
  malicious.code = 'private-user-id-and-token';
  const unsafeError = createHarness({ fetchImpl: async () => { throw malicious; } });
  assert.equal((await invoke(unsafeError.handler)).statusCode, 500);
  assert.equal(unsafeError.logs.length, 1);
  assert.deepEqual(unsafeError.logs, [['po:token-fetch']]);
  assert.deepEqual(unsafeError.successLogs, []);
  assert.doesNotMatch(JSON.stringify(unsafeError.logs), /access-secret|private-upstream-response|private-user-name|private-user-id-and-token/);

  const tokenErrorJsonFailure = createHarness({ fetchImpl: async () => ({
    ok: false,
    status: 429,
    json: async () => { throw new SyntaxError('Unexpected token in private non-JSON upstream body'); },
    text: async () => 'private non-JSON upstream body',
  }) });
  assert.equal((await invoke(tokenErrorJsonFailure.handler)).statusCode, 500);
  assert.equal(tokenErrorJsonFailure.logs.length, 1);
  assert.deepEqual(tokenErrorJsonFailure.logs, [['po:token-json']]);
  assert.deepEqual(tokenErrorJsonFailure.successLogs, []);
  assert.ok(Buffer.byteLength(tokenErrorJsonFailure.logs[0][0], 'utf8') <= 20);
  assert.doesNotMatch(JSON.stringify(tokenErrorJsonFailure.logs), /private|upstream|non-JSON/);
});

test('Patreon OAuth logging isolates failure stages across concurrent invocations', async () => {
  let rejectFirstTokenRequest;
  const firstTokenRequest = new Promise((_resolve, reject) => {
    rejectFirstTokenRequest = reject;
  });
  const fetchImpl = async (_url, options) => {
    if (options.method === 'POST') {
      const code = new URLSearchParams(options.body).get('code');
      return code === 'first-invocation' ? firstTokenRequest : response({ access_token: 'access-secret' });
    }
    throw new Error('private identity network detail');
  };
  const harness = createHarness({ fetchImpl });
  const firstInvocation = invoke(harness.handler, { code: 'first-invocation' });
  const secondResult = await invoke(harness.handler, { code: 'second-invocation' });
  rejectFirstTokenRequest(new Error('private token network detail'));
  const firstResult = await firstInvocation;

  assert.equal(firstResult.statusCode, 500);
  assert.equal(secondResult.statusCode, 500);
  assert.deepEqual(harness.logs, [['po:identity-fetch'], ['po:token-fetch']]);
  assert.deepEqual(harness.successLogs, []);
  for (const [message] of harness.logs) {
    assert.match(message, /^po:(?:token-fetch|identity-fetch)$/);
    assert.ok(Buffer.byteLength(message, 'utf8') <= 20);
  }
  assert.doesNotMatch(JSON.stringify(harness.logs), /private|access-secret|first-invocation|second-invocation/);
});
