# Patreon authentication and decryption access

## Current flow

1. `src/context/PatreonProvider.tsx` redirects to Patreon with the `identity identity.memberships` scopes and the registered callback `https://benis-boy.github.io/library/`. It remembers the pending reader route.
2. The frontend sends the returned authorization code to the hosted Netlify `patreon-oauth` function. The function also accepts refresh tokens, although the current frontend does not automatically refresh stored sessions.
3. `netlify/functions/patreon-oauth/patreon-oauth.js` exchanges the credential for tokens and fetches API v2 identity with campaign memberships. It selects only campaign `12346885`, not payments to other creators.
4. The function returns tokens, stable Patreon user ID, HMAC-signed comment identity, membership details, reader eligibility (`userInfo.supportsMe`), and decryption keys. The frontend stores this response locally and restores it on later visits.
5. The reader gates secured chapters using login and eligibility. `src/context/LibraryContext.tsx` uses the legacy `encryption_password` for PSSJ and `encryption_passwordv2[bookId]` for other books. The comments API is external; its stable identity/signature contract is unchanged.

## Key policy

The configuration and predicate are near the top of the function. All configured keys are available when the campaign member is **active (`active_patron`) OR has paid a lifetime total strictly greater than 500 cents**. Exactly 500 cents does not satisfy the lifetime condition. Former or declined patrons qualify if their total exceeds the threshold.

The source of the total is `campaign_lifetime_support_cents`, a numeric value reported by Patreon. Missing, null, or malformed totals do not qualify on their own. The old username exemption and August 2025 exception have been removed. `supportsMe` retains its wire name for frontend compatibility but now means reader eligibility, not necessarily an active subscription.

Eligible users receive the keys from `NETLIFY_SECRET_PASSWORD` (legacy v1), `WTDR_SECRET_PASSWORD`, and `SOWB_SECRET_PASSWORD`. Ineligible users receive the string `NOT_ALLOWED` for every key, including v1; previously the v1 key was returned to every successful login. Missing eligible-key or comments-signing configuration fails authentication rather than returning an incomplete success. `COMMENTS_AUTH_SECRET` still signs the stable Patreon user ID.

## Serverless failure logging

The OAuth function is silent for successful and ineligible logins, preflight, wrong methods, and invalid input. A failed upstream/authentication/internal operation emits at most one compact `console.error` code prefixed `po:`; it does not log exception text, payloads, identities, credentials, keys, URLs, or request IDs. Suffixes identify the operation: `token-fetch`, `token-http:<status>`, `token-json`, `token-data`; `identity-fetch`, `identity-http:<status>`, `identity-json`, `identity-data`; `key-v1`, `key-WtDR`, `key-SoWB`; `comments-config`; and fallback `response`. HTTP suffixes contain only a numeric status. Missing key logs name only the key alias, never its environment variable value.

Stored sessions are not automatically revalidated. The new decision applies on the next successful code exchange or refresh; it cannot revoke keys already delivered. Static shared-key encryption also cannot prevent an eligible reader from retaining or sharing a key. No content regeneration, key rotation, deployment, or session migration is included in this change.

## Official API research (2026-10-01)

- [Member resource](https://docs.patreon.com/#member): `campaign_lifetime_support_cents` is “The total amount that the member has ever paid to the campaign in the campaign's currency. `0` if never paid. Can be null.” The old `lifetime_support_cents` field is deprecated in favor of it. No extra payment-ledger summation is needed for this reported lifetime-total policy.
- **Currency matters:** 500 cents means $5 only if the campaign uses USD. This implementation assumes USD; it does not convert foreign campaign currencies. The docs do not establish refund treatment, one-time shop purchase inclusion, or foreign-exchange accounting for this total.
- [Identity endpoint](https://docs.patreon.com/#get-api-oauth2-v2-identity) and [scopes](https://docs.patreon.com/#scopes): existing `identity identity.memberships` scopes expose profile and memberships. Fields/includes must be requested explicitly. Former patron status is supported, but the docs do not clearly guarantee historical/cancelled membership visibility in every identity response. Check a real former patron account before considering that path proven. If necessary, a creator-authorized campaign-members lookup is a separate follow-up, not implemented here.
- [OAuth exchange](https://docs.patreon.com/#step-4-validating-receipt-of-the-oauth-token) and [refresh](https://docs.patreon.com/#step-7-keeping-up-to-date) document server-side form POSTs including `client_secret`. This repository's existing function does not supply a client secret. The refactor preserves that client-authentication behavior to avoid an unconfigured deployment migration; verify the registered client's requirements and add a server-only configured secret if required. Credentials now go in the form body, not the URL.
- [API guidance](https://docs.patreon.com/) recommends an identifying User-Agent to avoid possible 403 responses; both outbound requests now provide one.
- Patreon's **API v1** retirement is unrelated to this project's **encryption v1**. Identity already uses API v2; the unversioned token endpoint is the documented OAuth endpoint.

## Research only: retiring encryption v1

Retirement is feasible with a modest coordinated frontend/backend migration. The current generated public metadata inspected during this change has **98 PSSJ chapters, none secured; 13 WtDR chapters, 10 secured; and 2 SoWB chapters, none secured**. Thus current secured content uses the v2 WtDR path. These counts are a snapshot, not a promise about future generation or historical deployments.

Do not simply remove `encryption_password` from the function: `PatreonProvider.tsx` requires that string before accepting a successful login. Remaining dependencies include:

- `src/context/PatreonContext.tsx`: response and context types.
- `src/context/PatreonProvider.tsx`: callback validation, state, stored-session restoration, and context values.
- `src/context/LibraryContext.tsx`: PSSJ-specific legacy decryption branch.
- Storybook harnesses/mocks and stories supplying legacy credentials.
- `deployment/encryptExport.py`: PSSJ still maps to its legacy secret. Future secured PSSJ chapters need a supported key path even if none are secured today.

Suggested migration:

1. Confirm PSSJ will remain public, or route any future secured PSSJ content through `encryption_passwordv2.PSSJ` using the matching existing content key. The v1/v2 distinction is key routing, not a different cipher format, so routing alone need not re-encrypt compatible existing content.
2. Deploy frontend compatibility first: stop requiring the legacy response property and remove its state/context and PSSJ-only branch once content has a supported path. Update mocks and verify old stored responses still restore safely.
3. Remove the backend legacy field/key requirement only after the new frontend is deployed, accounting for cached older clients. Then remove unused environment configuration only after checking generator and historical-content dependencies.
4. Verify real login, stored-session restore, public PSSJ reading, authorized WtDR decryption, and denied access. If PSSJ becomes secured under v2, verify that path too.

No v1 dependency or encryption mechanism was removed here.

## Verification and proof limits

Focused function regressions use Node's built-in test runner:

```text
node --test --test-name-pattern="Patreon OAuth" "netlify/functions/patreon-oauth/patreon-oauth.test.cjs"
```

The specific diagnostic logging coverage can be isolated with:

```text
node --test --test-name-pattern="Patreon OAuth logging" "netlify/functions/patreon-oauth/patreon-oauth.test.cjs"
```

These exercise the real handler with mocked Patreon responses and synthetic secrets, including the 500/501-cent boundary and all-key denial. They are not real Patreon/Netlify end-to-end proof. Existing Storybook reader stories also mock auth and external dependencies. Deployment configuration, real former-patron membership visibility, campaign currency, and real OAuth exchanges remain live-service verification gaps. The project goal tree/proof inventory remain uninitialized; no authoritative goal IDs are assigned by this work.
