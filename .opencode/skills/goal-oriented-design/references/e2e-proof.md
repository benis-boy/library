# Product Proof Inventory

This seed is intentionally empty. Add entries only after inspecting the project's tests and runners and after human approval of the relevant goals. Never invent evidence, commands, dependencies, environments, or qualification.

An `e2e` test exercises production implementations and every required service boundary in a local, CI, staging, or deployed production environment. A `unit` test may use fakes, mocks, or interception and provides supporting regression evidence. Every leaf goal requires multiple independent tests, including at least one qualifying e2e test.

Use exact stable test IDs or exact Playwright titles. For Playwright entries, record the exact command; use a path only when needed to disambiguate an otherwise stable ID or title. Record prerequisite creation and cleanup ownership. Proof must demonstrate a product outcome, not merely an endpoint response or component render.

| Goal | Exact test ID(s) or suite | Description | Exact command / selector | Type | Environment | Prerequisite creation owner | Cleanup owner | Dependencies | Status / gap |
| ---- | ------------------------- | ----------- | ------------------------ | ---- | ----------- | --------------------------- | ------------- | ------------ | ------------ |

If proof relies on an A=>B=>C decomposition, inventory the transition suites and intermediate identity and contract. Keep independent library inventories separate.
