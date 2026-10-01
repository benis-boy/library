# Windows browser automation from OpenCode

## Preferred integration

Use the project `browser_cli` custom tool for browser operations in OpenCode on Windows. Its implementation spawns the installed Playwright CLI entry directly (without a shell), captures stdout and stderr through temporary files, and returns a bounded JSON result containing `exitCode`, `stdout`, `stderr`, `timedOut`, `aborted`, and `durationMs`. The fixed child-process deadline is 8 seconds; captured output is capped at 64 KiB. The tool runs in OpenCode's current project directory rather than relying on the OpenCode server's process cwd.

For example, issue `command: "open"`, `args: ["https://example.com"]`, and a task-owned unique `session` name. Use exactly that session on later `goto`, `snapshot`, or other browser commands, then explicitly call `close` on the same session. Every browser operation requires the name: the tool will not accidentally open or reuse an implicit/default session. `list`, `--help`, and `--version` are permitted without a session. `install`, `close-all`, `kill-all`, and `delete-data` are blocked so one task cannot disrupt unrelated browser sessions or remove browser data.

If the command times out or is aborted, the direct CLI child is killed and the tool returns without waiting on inherited stdout/stderr handles. A CLI may already have started a separate browser daemon; process termination is not evidence that this daemon has exited. Check the explicitly owned session and close it deliberately. Never clean up sessions belonging to other tasks. The 8-second bound applies to an individual tool execution, not model inference or end-to-end turn latency.

## Installation and integration check

The project-local `.opencode/tools/browser_cli.ts` loads `scripts/playwright-cli.cjs` from the active project directory. Restart OpenCode after adding or changing the custom tool and its permissions. Then confirm `browser_cli` is offered to an authorized browser role, make a harmless `--version` call and inspect the structured returned output. A real browser workflow is not part of the launcher's unit tests. Integration proof that actual OpenCode dispatch returns reliably is still pending until tested in a restarted OpenCode process.

Do not fall back to direct Bash or PowerShell browser invocations within Windows OpenCode when dispatch completion is unreliable. Direct CLI examples elsewhere in the vendored skill remain useful as manual reference outside that integration. Do not nest `opencode run` or browser CLI calls inside the same failing external ShellTool completion path as a supposed integration test.

## Verification

The isolated runner tests use fake CLI entrypoints and do not launch a browser:

```powershell
node --test --test-name-pattern="captured runner|browser invocation" scripts/playwright-cli-capture.test.cjs
```

That proves local process capture, timeout/abort behavior, and validation only. It does not prove OpenCode discovered the tool, applied permissions, or returned a live browser call to the caller. Verify those manually after an OpenCode restart, without routing the check through the known-failing nested ShellTool path.

### Restart acceptance check

After restarting OpenCode in this repository, ask Design:

> Delegate to frontend-tester: use only browser_cli (no Bash/PowerShell browser calls). First call --version. Then use a unique owned session to open data:text/html,<title>playwright-cli-ready</title><h1>ready</h1>, evaluate document.title, and close that session. Make these separate tool calls. Record actual tool completion and each returned durationMs, exitCode, timedOut, and aborted value. Every simple call must finish within ten seconds. Confirm whether an unwanted terminal appears. On a timeout or infrastructure error, stop testing except for one targeted close of the owned session; do not retry, install anything, or use a shell fallback.

The tool inputs for that workflow are:

```text
{ "command": "--version" }
{ "command": "open", "args": ["data:text/html,<title>playwright-cli-ready</title><h1>ready</h1>"], "session": "unique-task-name" }
{ "command": "eval", "args": ["document.title", "--raw"], "session": "unique-task-name" }
{ "command": "close", "session": "unique-task-name" }
```

Acceptance requires returned tool results, not just a printed title: successful open, evaluation returning
`playwright-cli-ready`, and successful close, with no unwanted console. The internal eight-second deadline
leaves margin for normal dispatch overhead but cannot guarantee a wall-clock bound if OpenCode's event loop
or host is stalled. Missing `browser_cli` means tool discovery/reload is incomplete; report the block rather
than attempting the known-failing shell path.

### Current evidence

Independent regression execution passed all 16 cases in the launcher, captured-runner, and configuration
test files (728 ms Node-reported total). Tests include timeout, cancellation, retained descendant output
descriptors, output bounds, explicit Node resolution independent of OpenCode's executable, and the installed
plugin's custom-tool return contract. Independent review found no remaining defects in the reviewed scope.
These are browser-free checks, not evidence of an actual OpenCode-dispatched browser lifecycle. That final
check remains pending until restart; do not mark automated readiness verified before it passes.

For these script checks, every delegated shell invocation must explicitly use `timeout: 10000` milliseconds.
Browser operations themselves must use `browser_cli`, not a script wrapped in ShellTool. An external shell
timeout alone is not a reliable completion bound in the affected OpenCode runner.
