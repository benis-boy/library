const crypto = require('crypto');

const CAMPAIGN_ID = '12346885';
const OWNER_PATREON_USER_ID = '101723637';
const ACTIVE_PATRON_STATUS = 'active_patron';
const LOGGABLE_PATRON_STATUSES = new Set(['active_patron', 'former_patron', 'declined_patron']);
// Eligibility is strictly greater than 500 cents (> $5); this assumes the campaign currency is USD.
const LIFETIME_SUPPORT_THRESHOLD_CENTS = 500;
const KEY_ENVIRONMENT_NAMES = {
  v1: 'NETLIFY_SECRET_PASSWORD',
  WtDR: 'WTDR_SECRET_PASSWORD',
  SoWB: 'SOWB_SECRET_PASSWORD',
};
const CLIENT_ID = 'DCmpYjAt5oF-1poN2N_hW22VXTuz8BNIOPk1yeoctffuvobAJCu8I7N7fKc1ngMp';
const REDIRECT_URI = 'https://benis-boy.github.io/library/';
const TOKEN_URL = 'https://www.patreon.com/api/oauth2/token';
const IDENTITY_URL = 'https://www.patreon.com/api/oauth2/v2/identity';
const APPLICATION_USER_AGENT = 'BenisBoyLibrary/1.0 (+https://benis-boy.github.io/library/)';

// All keys share this policy: the owner, an active supporter, or lifetime payments above the threshold.
const isEligibleForKeys = (membership, patreonUserId) => {
  if (patreonUserId === OWNER_PATREON_USER_ID) return true;

  const attributes = membership?.attributes;
  if (attributes?.patron_status === ACTIVE_PATRON_STATUS) return true;

  const lifetimeSupport = attributes?.campaign_lifetime_support_cents;
  return (
    typeof lifetimeSupport === 'number' &&
    Number.isFinite(lifetimeSupport) &&
    lifetimeSupport >= 0 &&
    lifetimeSupport > LIFETIME_SUPPORT_THRESHOLD_CENTS
  );
};

const response = (statusCode, headers, body) => ({ statusCode, headers, body });

const parseRequestBody = (body) => {
  if (typeof body !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getCredentials = (body) => {
  if (!body) return null;
  if (body.code !== undefined && typeof body.code !== 'string') return null;
  if (body.refresh_token !== undefined && typeof body.refresh_token !== 'string') return null;

  // Keep authorization code priority when both credentials are supplied.
  const code = body.code || '';
  const refreshToken = body.refresh_token || '';
  if (!code && !refreshToken) return null;
  return code ? { type: 'authorization_code', value: code } : { type: 'refresh_token', value: refreshToken };
};

const exchangeToken = async (credential) => {
  const params = new URLSearchParams({
    grant_type: credential.type,
    client_id: CLIENT_ID,
  });
  if (credential.type === 'authorization_code') {
    params.set('code', credential.value);
    params.set('redirect_uri', REDIRECT_URI);
  } else {
    params.set('refresh_token', credential.value);
    params.set('redirect_uri', REDIRECT_URI);
  }

  return fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': APPLICATION_USER_AGENT,
    },
    body: params.toString(),
  });
};

const fetchIdentity = async (accessToken) => {
  const url = new URL(IDENTITY_URL);
  url.search = new URLSearchParams({
    include: 'memberships.currently_entitled_tiers,memberships.campaign',
    'fields[user]': 'full_name,vanity',
    'fields[member]': 'campaign_lifetime_support_cents,currently_entitled_amount_cents,patron_status,pledge_cadence',
  }).toString();

  return fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': APPLICATION_USER_AGENT,
    },
  });
};

const getOwnMembership = (userInfo) => {
  if (!Array.isArray(userInfo?.included)) return null;
  return userInfo.included.find(
    (membership) =>
      membership?.type === 'member' &&
      membership?.relationships?.campaign?.data?.id === CAMPAIGN_ID
  ) ?? null;
};

const logSuccessfulAuthentication = (membership, userName) => {
  const attributes = membership?.attributes;
  const patronStatus = LOGGABLE_PATRON_STATUSES.has(attributes?.patron_status)
    ? attributes.patron_status
    : null;
  const lifetimeSupport = attributes?.campaign_lifetime_support_cents;
  const safeLifetimeSupport =
    typeof lifetimeSupport === 'number' && Number.isFinite(lifetimeSupport) && lifetimeSupport >= 0
      ? lifetimeSupport
      : null;

  const safeUserName = typeof userName === 'string' ? Array.from(userName).slice(0, 200).join('') : null;

  try {
    const details = JSON.stringify({ patron_status: patronStatus, lifetimeSupport: safeLifetimeSupport, userName: safeUserName })
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    console.log(`po:success ${details}`);
  } catch {
    // Diagnostics must never turn an otherwise successful authentication into a failure.
  }
};

const getKeys = (isEligible, setFailureStage) => {
  const keys = { v1: 'NOT_ALLOWED', WtDR: 'NOT_ALLOWED', SoWB: 'NOT_ALLOWED' };
  if (isEligible) {
    for (const [key, environmentName] of Object.entries(KEY_ENVIRONMENT_NAMES)) {
      const secret = process.env[environmentName];
      if (!secret) {
        setFailureStage(`key-${key}`);
        throw new Error('Required encryption key configuration is missing.');
      }
      keys[key] = secret;
    }
  }

  return {
    encryption_passwordv1: keys.v1,
    encryption_passwordv2: { WtDR: keys.WtDR, SoWB: keys.SoWB },
  };
};

const signPatreonUserId = (patreonUserId, setFailureStage) => {
  const secret = process.env.COMMENTS_AUTH_SECRET;
  if (!secret) {
    setFailureStage('comments-config');
    throw new Error('Required comments authentication configuration is missing.');
  }
  return crypto.createHmac('sha256', secret).update(patreonUserId).digest('base64url');
};

const makeSuccessfulResponse = (token, userInfo, membership, patreonUserId, setFailureStage) => {
  const userAttributes = userInfo.data.attributes ?? {};
  const userName = userAttributes.vanity ?? userAttributes.full_name ?? 'CouldNotFindName';
  const supportsMe = isEligibleForKeys(membership, patreonUserId);
  const keys = getKeys(supportsMe, setFailureStage);
  const signedUser = signPatreonUserId(patreonUserId, setFailureStage);

  return {
    ...token,
    patreonUserId,
    userInfo: {
      userName,
      supportsMe,
      currently_entitled_tiers: membership?.relationships?.currently_entitled_tiers,
    },
    signedUser,
    membershipData: membership,
    // The frontend still expects the legacy v1 key under encryption_password.
    encryption_password: keys.encryption_passwordv1,
    encryption_passwordv2: keys.encryption_passwordv2,
  };
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST',
  };

  if (event.httpMethod === 'OPTIONS') return response(200, headers, 'CORS Preflight');
  if (event.httpMethod !== 'POST') return response(405, headers, 'Method Not Allowed');

  const credentials = getCredentials(parseRequestBody(event.body));
  if (!credentials) return response(400, headers, 'Valid JSON body with code or refresh_token is required');

  let failureStage = 'token-fetch';
  let hasLoggedFailure = false;
  const logFailure = (code) => {
    if (hasLoggedFailure) return;
    hasLoggedFailure = true;
    console.error(`po:${code}`);
  };
  const statusCodeForLog = (stage, status) =>
    Number.isInteger(status) && status >= 100 && status <= 599 ? `${stage}-http:${status}` : `${stage}-http`;

  try {
    const tokenResponse = await exchangeToken(credentials);
    if (!tokenResponse.ok) {
      // Preserve Patreon token-error status/body passthrough for compatibility.
      failureStage = 'token-json';
      const tokenError = await tokenResponse.json();
      const tokenErrorBody = JSON.stringify(tokenError);
      logFailure(statusCodeForLog('token', tokenResponse.status));
      return response(tokenResponse.status, headers, tokenErrorBody);
    }

    failureStage = 'token-json';
    const token = await tokenResponse.json();
    failureStage = 'token-data';
    if (typeof token?.access_token !== 'string' || token.access_token.length === 0) {
      throw new Error('Patreon token response was invalid.');
    }

    failureStage = 'identity-fetch';
    const identityResponse = await fetchIdentity(token.access_token);
    if (!identityResponse.ok) {
      failureStage = statusCodeForLog('identity', identityResponse.status);
      throw new Error('Patreon identity request failed.');
    }
    failureStage = 'identity-json';
    const userInfo = await identityResponse.json();
    failureStage = 'identity-data';
    const patreonUserId = userInfo?.data?.id;
    if (typeof patreonUserId !== 'string' || patreonUserId.length === 0) {
      throw new Error('Patreon identity response was invalid.');
    }

    const membership = getOwnMembership(userInfo);
    failureStage = 'response';
    const successfulResponse = makeSuccessfulResponse(token, userInfo, membership, patreonUserId, (stage) => {
      failureStage = stage;
    });
    const serializedResponse = JSON.stringify(successfulResponse);
    logSuccessfulAuthentication(membership, successfulResponse.userInfo.userName);
    return response(200, headers, serializedResponse);
  } catch {
    logFailure(failureStage);
    return response(500, headers, 'Patreon authentication failed. Check server configuration and try again.');
  }
};
