import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import SandboxProvider from '@deepseek-ai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import type { SubprocessSpawnSpec, SubprocessTerminalSpawnSpec } from '@deepseek-ai/dsh-subprocess'

class RecordingSandbox extends SandboxProvider {
  readonly confine = vi.fn((argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv => ({
    argv: ['/sandbox', '--', ...argv],
    enforcement: 'full',
    denialSignatures: [],
    runnerFailureRules: [],
  }))
}

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

function terminalSpec(overrides: Partial<SubprocessTerminalSpawnSpec> = {}): SubprocessTerminalSpawnSpec {
  return {
    argv: ['shell'],
    cwd: process.cwd(),
    rows: 24,
    cols: 80,
    graceMs: 200,
    sandbox: { mode: 'workspace-write', workspaceRoot: process.cwd() },
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

  it('fails closed when a confined terminal has no sandbox service', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(LocalSubprocessRuntime)
    try {
      await expect(ctx.subprocess.spawnTerminal(terminalSpec())).rejects.toThrow(
        /confined terminal spawn requires the sandbox service/,
      )
    } finally {
      await fiber.dispose()
    }
  })

  it('validates raw terminal input and cancellation before confinement', async () => {
    const ctx = new Context()
    await ctx.plugin(RecordingSandbox)
    const fiber = await ctx.plugin(LocalSubprocessRuntime)
    try {
      await expect(ctx.subprocess.spawnTerminal(terminalSpec({ argv: [] }))).rejects.toThrow(
        /terminal argv must contain a program/,
      )
      await expect(ctx.subprocess.spawnTerminal(terminalSpec({ signal: AbortSignal.abort('stop') })))
        .rejects.toBe('stop')
      expect((ctx.sandbox as RecordingSandbox).confine).not.toHaveBeenCalled()
    } finally {
      await fiber.dispose()
    }
  })

  it('rejects non-existent and symlink-escaped terminal working directories before confinement', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'dsh-pty-workspace-'))
    const escaped = join(workspace, 'escaped')
    symlinkSync(process.cwd(), escaped, process.platform === 'win32' ? 'junction' : 'dir')
    const ctx = new Context()
    await ctx.plugin(RecordingSandbox)
    const fiber = await ctx.plugin(LocalSubprocessRuntime)
    try {
      await expect(ctx.subprocess.spawnTerminal(terminalSpec({
        cwd: join(workspace, 'missing'),
        sandbox: { mode: 'workspace-write', workspaceRoot: workspace },
      }))).rejects.toThrow(/must be an existing directory/)
      await expect(ctx.subprocess.spawnTerminal(terminalSpec({
        cwd: escaped,
        sandbox: { mode: 'workspace-write', workspaceRoot: workspace },
      }))).rejects.toThrow(/outside the workspace and temp roots/)
      expect((ctx.sandbox as RecordingSandbox).confine).not.toHaveBeenCalled()
    } finally {
      await fiber.dispose()
      rmSync(workspace, { recursive: true, force: true })
    }
  })
})
