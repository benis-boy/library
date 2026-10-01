# AI setup installation

Installed from [agentic-dev-template-2026](https://github.com/benis-boy/agentic-dev-template-2026)
at commit `bd3b006fe61ad3101c4b954e46e9bca6ec4f0a0d`, following its `install.md`.

## Installed and merged files

- `.opencode/opencode.json`: default `design`, maximum subagent depth 2; disables template-replaced built-ins
  `build`, `plan`, `general`, and `explore`. Existing global configuration was inspected and preserved.
- `.opencode/agents/design.md`: primary orchestration, project entrypoints, generation rules, and validation routing.
- `.opencode/agents/heavy-subagent.md`: bounded emergency generalist with assignment-gated delegation.
- `.opencode/agents/luna-worker.md`: bounded implementation and author-local exact test execution.
- `.opencode/agents/luna-reviewer.md`: read-only review with project contract invariants.
- `.opencode/agents/luna-scout.md`: read-only reconnaissance.
- `.opencode/agents/frontend-tester.md`: independent browser and interaction verification; exact UI locator-edit ownership.
- `.opencode/agents/backend-tester.md`: independent script/service verification and explicit missing-runner boundaries.
- `.opencode/commands/init-goals.md`: human-reviewed, approval-gated goal initialization.
- `.opencode/skills/goal-oriented-design/SKILL.md` and `references/{index,goal-tree,e2e-proof}.md`:
  workflow and uninitialized goal/proof seeds. No authoritative goals were inferred or written during installation.
- `.opencode/skills/playwright-cli/SKILL.md` and `references/`: current official CLI skill and supporting documentation.
- `.opencode/skills/upstash/`: existing project skill and all supporting files moved from `.agents/skills/upstash`.
- `AGENTS.md`: merged living product summary, external comments ownership, current test entrypoint, and agent guardrails.
- `eslint.config.js`: excludes vendored `.opencode/skills/**`, matching the existing skill-directory exclusion.
- `.gitignore`: Playwright CLI output exclusion added by the official installer.
- `.playwright/cli.config.json`: selects installed Chromium rather than machine-specific Edge.

Skill access remains deny-by-default. Design has orchestration only; Heavy has orchestration, coding, and browser
testing; Worker has coding and browser testing; Reviewer has coding; Scout has none; Frontend Tester has browser
testing. No backend-testing skill exists in the destination, so Backend Tester retains no skill grants.
All project skills are under `.opencode/skills`; empty project `.agents` directories were removed. User-global
skills and built-in runtime skills retain their original scope.

## Runtime and browser verification

`opencode models github-copilot` lists both required models. `opencode debug config` confirms Design and Heavy use
`github-copilot/gpt-6.1-sol`, all five normal subagents use `github-copilot/gpt-6-luna`, Design is primary/default,
and `subagent_depth` is 2. `opencode debug skill` discovers all three project skills at their new paths.

Node.js is `v22.14.0`. Installed `@playwright/cli@latest` globally; `playwright-cli --version` reports `0.1.22`,
and help discovery succeeds. `playwright-cli install-browser chromium --with-deps` successfully installed Chromium.

**Browser verification is blocked.** The required smoke check did not complete:

```text
playwright-cli -s=install-check open "data:text/html,<title>playwright-cli-ready</title><h1>ready</h1>"
```

It reported the expected page title and snapshot, then exceeded the 120-second shell timeout.

```text
playwright-cli -s=install-check --raw eval "document.title"
The browser 'install-check' is not open, please run open first

playwright-cli -s=install-check close
Browser 'install-check' is not open.
```

The evaluation did not print the required title, and cleanup found no remaining session. Executable and browser
installation do not establish browser readiness; repair the CLI/session execution issue and rerun the exact
three-command smoke check before relying on browser automation.

### Windows CLI follow-up (2026-10-01)

The [official CLI documentation](https://github.com/microsoft/playwright-cli#sessions) describes a browser
session that survives separate CLI calls. `open` should return after launching and navigating; it is not a
foreground server command. `--persistent` saves the profile across browser restarts and is not required
for consecutive calls within an open session. Browsers are headless by default; use `--headed` to see one.

Read-only inspection of the installed `0.1.22` implementation confirmed that PowerShell resolves the npm
`playwright-cli.ps1` shim, which invokes Node. The client launches a detached daemon and uses a
workspace-specific session registry discovered through `.playwright`. Use the same repository working
directory and session name for every call. This project's default config selects installed Chromium.

An independent repeat from `D:\Notes\07_Homepage` produced:

| Command | Elapsed | Exit code | Result |
| --- | --- | --- | --- |
| `playwright-cli -s=install-check open "data:text/html,<title>playwright-cli-ready</title><h1>ready</h1>"` | 865 ms | 0 | Opened; printed expected title |
| `playwright-cli -s=install-check --raw eval "document.title"` | 266 ms | 1 | Browser not open |
| `playwright-cli -s=install-check close` | 267 ms | 0 | Browser already not open |

**Browser readiness remains blocked:** the timeout did not recur, but the session was unavailable to the
next invocation. The cause is not established. Command-runner child-process cleanup is a hypothesis,
not a confirmed diagnosis. Further browser testing was stopped rather than attempting environment repair.

To distinguish a CLI problem from the agent command runner, run these commands individually in a normal
PowerShell terminal opened at `D:\Notes\07_Homepage`:

```powershell
playwright-cli -s=manual-check open "data:text/html,<title>playwright-cli-ready</title><h1>ready</h1>" --headed
playwright-cli -s=manual-check --raw eval "document.title"
playwright-cli -s=manual-check close
```

The evaluation must return `playwright-cli-ready`, and close must report closing the browser. If the manual
check works but agent calls do not, investigate the agent runner's process-lifetime handling. If it also
fails manually, investigate the installed CLI/daemon environment. Environment repair is required before
rerunning automated readiness verification. This smoke check is not product E2E proof; goal initialization
and the project-specific E2E runner remain separate unfinished work.

### Manual success and unwanted-console investigation (2026-10-01)

The user subsequently passed `open --headed`, `--raw eval "document.title"`, and `close` from
`D:\Notes\07_Homepage` with session `project-check`. Evaluation returned `"playwright-cli-ready"`, and
close reported the browser closed. **Manual Windows CLI readiness is established; agent-driven readiness
is still unverified.** An earlier manual run from `C:\Users\benja` did not load the project's Chromium
configuration and attempted Chrome instead; installing Chrome fixed that separate launch error.

The user reports that agent CLI calls create an unwanted terminal, which they later close. Closing that
window may contribute to session loss, but no timing or window-owner evidence establishes causation.
No further browsers were launched during the subsequent investigation.

Confirmed implementation details:

- Installed Playwright CLI `0.1.22`, `playwright-core/lib/tools/cli-client/session.js:153-159`, already uses
  `detached: true` and `windowsHide: true`, with stdin ignored, stdout piped, and stderr redirected to a file.
  After the daemon startup handshake, it destroys the stdout pipe and calls `unref()` (lines 185-189).
- Live process ancestry shows the tool's PowerShell process is a child of installed `opencode.exe` `1.18.34`.
  Versioned upstream OpenCode source uses a non-detached PowerShell shell and requests hidden windows.
  That source does not prove the installed binary's exact launch behavior or identify the unwanted window.
- Node `22.14.0` uses libuv `1.49.2`. Its Windows spawn implementation handles detachment, console hiding,
  and inherited stdio separately. `windowsHide` alone is not proof that every descendant console is hidden.
  Switching the daemon to non-detached is unsafe: libuv can place non-detached children in a kill-on-close
  job, so CLI exit may kill the daemon even after `unref()`.
- Read-only visible-window enumeration found no visible console at inspection time, so its owning process
  could not be identified. No supported CLI setting to change daemon spawn options was found.

References: [Node v22 child processes](https://nodejs.org/docs/latest-v22.x/api/child_process.html),
[libuv Windows spawn implementation](https://github.com/libuv/libuv/blob/v1.49.2/src/win/process.c),
[Windows process creation flags](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags),
and [OpenCode v1.18.34 shell implementation](https://github.com/anomalyco/opencode/blob/e9f8a210b9e2b1e13d375b84906069886eb3b767/packages/opencode/src/tool/shell.ts).

No launcher or global-package patch was applied: neither is justified without identifying the visible
window's owning process and confirming a fix preserves daemon lifetime. When the unwanted window is next
present, record its title and owning PID (for example using Process Explorer's window-target tool), plus
the related shell/Node process tree, before closing it. Target that launch boundary rather than assuming
the browser daemon is responsible. Further automated browser checks remain paused until a bounded fix is
identified; the manual smoke check is not integrated product E2E evidence.

## Required human follow-up

### Current browser integration (supersedes investigation-only guidance above)

The direct CLI and standalone file-output wrapper both failed at the OpenCode tool-completion boundary,
even when PowerShell printed `ELAPSED_MS=877 EXIT_CODE=0`. A project-local custom tool now bypasses that
shell boundary: `.opencode/tools/browser_cli.ts` calls the bounded capture runner directly and returns its
structured result. It resolves installed Node explicitly rather than assuming OpenCode's host executable
can interpret the CLI JavaScript. Browser-capable agent permissions, `AGENTS.md`, and the Playwright skill
now direct agents to this tool; the skill no longer grants shell browser invocations.

Independent browser-free verification passed all 16 runner/configuration tests; independent review found
no remaining defects in the reviewed scope. **Actual OpenCode-dispatched browser readiness is still pending.**
This session did not expose the newly installed custom tool, so restart is needed before acceptance.
See [Windows browser automation](windows-browser-automation.md) for the exact restart acceptance prompt,
fixed eight-second process deadline, explicit ten-second shell limits for script tests, session cleanup,
and the prohibition on falling back to the failing shell path. No global dependency patch was applied.

1. Review all installed agent prompts, permissions, project facts, and `AGENTS.md` guidance.
2. Quit and restart OpenCode so configuration, agents, commands, and skills reload.
3. In a new/fresh session, invoke `/init-goals`. Correct the proposal and explicitly approve it before authoritative
   goal writes. Goal-driven setup remains incomplete until the goal tree, proof inventory, and index are seeded
   and reviewed.
4. Review, adapt, and implement a project-specific end-to-end runner using the template's
   [reference E2E runner plan](https://github.com/benis-boy/agentic-dev-template-2026/blob/main/.opencode/docs/e2e-runner-feature.md).
   This is required for reliable integrated proof. The reference plan was not installed. Mocked Storybook flows
   and the CLI smoke check do not establish integrated production-service E2E readiness.
