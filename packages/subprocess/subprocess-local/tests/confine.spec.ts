import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'

function spec(overrides: Partial<SubprocessSpawnSpec> = {}): SubprocessSpawnSpec {
  return {
    argv: ['true'],
    cwd: process.cwd(),
    stdio: {
      stdin: 'ignore',
      stdout: { maxBytes: 64_000 },
      stderr: { maxBytes: 64_000 },
    },
    graceMs: 200,
    ...overrides,
  }
}

describe('confined spawn policy', () => {
  it('fails closed when a confined spawn has no sandbox service', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(LocalSubprocessRuntime)
    try {
      expect(() => ctx.subprocess.spawn(spec({
        sandbox: { mode: 'read-only', workspaceRoot: process.cwd() },
      }))).toThrow(/requires the sandbox service/)
    } finally {
      await fiber.dispose()
    }
  })
})
