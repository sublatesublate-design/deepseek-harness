import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import { LocalSandboxProvider } from '@deepseek-ai/dsh-sandbox-local'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { SubprocessTerminalHandle } from '@deepseek-ai/dsh-subprocess'

const bwrapProbe = process.platform === 'linux'
  ? spawnSync('bwrap', ['--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--', 'true'], {
    timeout: 5_000,
    stdio: 'ignore',
  })
  : undefined
const bwrapUsable = bwrapProbe?.status === 0
const roots: string[] = []
const hostTempFiles: string[] = []
const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  for (const path of hostTempFiles.splice(0)) rmSync(path, { force: true })
})

async function runTerminal(
  ctx: Context,
  cwd: string,
  command: string,
  sandbox?: SandboxExecutionPolicy,
): Promise<{ output: string; exitCode: number | null }> {
  const terminal: SubprocessTerminalHandle = await ctx.subprocess.spawnTerminal({
    argv: ['/bin/bash', '--noprofile', '--norc', '-c', command],
    cwd,
    rows: 24,
    cols: 80,
    graceMs: 1_000,
    ...sandbox === undefined ? {} : { sandbox },
  })
  let output = ''
  terminal.output.on('data', (chunk) => { output += String(chunk) })
  const outcome = await terminal.done
  return { output, exitCode: outcome.exitCode }
}

describe.skipIf(!bwrapUsable)('local PTY file confinement', () => {
  it('keeps workspace writes, host paths, and full-access behavior distinct', async () => {
    const workspace = mkdtempSync(join(homedir(), 'dsh-pty-workspace-'))
    const outside = mkdtempSync(join(homedir(), 'dsh-pty-outside-'))
    roots.push(workspace, outside)
    const outsideFile = join(outside, 'protected.txt')
    const hostTempFile = join(tmpdir(), `dsh-pty-host-temp-${process.pid}.txt`)
    hostTempFiles.push(hostTempFile)
    writeFileSync(outsideFile, 'original')
    writeFileSync(hostTempFile, 'original')

    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(LocalSandboxProvider, {})
    await ctx.plugin(LocalSubprocessRuntime)
    const confined: SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot: workspace }

    const insideFile = join(workspace, 'allowed.txt')
    expect((await runTerminal(ctx, workspace, `printf allowed > ${JSON.stringify(insideFile)}`, confined)).exitCode)
      .toBe(0)
    expect(readFileSync(insideFile, 'utf8')).toBe('allowed')

    const denied = await runTerminal(
      ctx,
      workspace,
      `printf escaped > ${JSON.stringify(outsideFile)}`,
      confined,
    )
    expect(denied.exitCode).not.toBe(0)
    expect(denied.output.toLowerCase()).toContain('read-only file system')
    expect(readFileSync(outsideFile, 'utf8')).toBe('original')

    expect((await runTerminal(ctx, workspace, `printf ephemeral > ${JSON.stringify(hostTempFile)}`, confined)).exitCode)
      .toBe(0)
    expect(readFileSync(hostTempFile, 'utf8')).toBe('original')

    expect((await runTerminal(ctx, workspace, `printf full-access > ${JSON.stringify(outsideFile)}`)).exitCode)
      .toBe(0)
    expect(readFileSync(outsideFile, 'utf8')).toBe('full-access')
  })
})
