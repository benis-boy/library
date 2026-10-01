import { tool } from "@opencode-ai/plugin"
import { createRequire } from "node:module"

export default tool({
  description: "Run one bounded Playwright CLI operation and return captured JSON output. Browser operations require an explicit named session; use close on that same session when finished. Does not open or restart a session implicitly.",
  args: {
    command: tool.schema.string().describe("One Playwright CLI command, for example open, goto, snapshot, close, list, --help, or --version. Do not include shell syntax."),
    args: tool.schema.array(tool.schema.string()).default([]).describe("Literal CLI arguments (not a shell command)."),
    session: tool.schema.string().optional().describe("Required for every browser operation. A session name owned by this task. Omit only for list/help/version."),
  },
  async execute(input, context) {
    try {
      const runner = createRequire(import.meta.url)("../../scripts/playwright-cli.cjs") as {
        runCaptured: (args: string[], options: { cwd: string; abortSignal: AbortSignal }) => Promise<{
          exitCode: number
          stdout: string
          stderr: string
          timedOut: boolean
          aborted: boolean
          durationMs: number
        }>
        validateInvocation: (invocation: { command: string; args: string[]; session?: string }) => string[]
      }

      const cliArgs = runner.validateInvocation(input)
      const result = await runner.runCaptured(cliArgs, { cwd: context.directory, abortSignal: context.abort })
      return {
        title: `Playwright CLI: ${input.command}`,
        output: JSON.stringify(result),
        metadata: { ...result, session: input.session ?? null },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        title: "Playwright CLI request rejected",
        output: JSON.stringify({ exitCode: 2, stdout: "", stderr: message, timedOut: false, aborted: false, durationMs: 0 }),
        metadata: { rejected: true },
      }
    }
  },
})
