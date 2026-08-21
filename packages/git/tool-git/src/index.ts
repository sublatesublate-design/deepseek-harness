/**
 * Bounded, shell-free Git workflow tools. The package exposes observation,
 * explicit-path staging, and staged-only commits; commit always asks the
 * approval seam and no history-rewriting or remote mutation is registered.
 * @module @deepseek-ai/dsh-tool-git
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import type { ToolExecution, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { defineTool, type GenericCallView, type PreToolDecision } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-sandbox-policy'

export const name = 'tool-git'
export const inject = ['tools', 'systemPrompt', 'subprocess']

const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024
const DEFAULT_GRACE_MS = 1_000

/** Deployment-owned output and process bounds. */
export interface Config {
  /** Maximum bytes collected independently from stdout and stderr. */
  maxOutputBytes?: number
  /** Grace between cooperative and forced process-tree termination. */
  graceMs?: number
}

export const Config: z<Config> = z.object({
  maxOutputBytes: z.number().step(1).min(1024).default(DEFAULT_MAX_OUTPUT_BYTES),
  graceMs: z.number().step(1).min(0).default(DEFAULT_GRACE_MS),
})

interface ResolvedConfig {
  maxOutputBytes: number
  graceMs: number
}

interface GitRun {
  stdout: string
  stderr: string
  exitCode: number
  truncated: boolean
}

/** One path record from Git's NUL-delimited porcelain status. */
export interface GitStatusEntry {
  index: string
  worktree: string
  path: string
  originalPath?: string
}

/** Bounded repository state returned by the `git_status` tool. */
export interface GitStatusValue {
  root: string
  branch: string | null
  head: string | null
  clean: boolean
  changes: GitStatusEntry[]
}

function resolveConfig(config: Config): ResolvedConfig {
  const maxOutputBytes = config.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES
  const graceMs = config.graceMs ?? DEFAULT_GRACE_MS
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1024) {
    throw new TypeError('tool-git: maxOutputBytes must be a safe integer of at least 1024')
  }
  if (!Number.isSafeInteger(graceMs) || graceMs < 0) {
    throw new TypeError('tool-git: graceMs must be a non-negative safe integer')
  }
  return { maxOutputBytes, graceMs }
}

function executionCwd(exec: ToolExecution): string {
  return exec.agent?.session.header.cwd ?? process.cwd()
}

async function settle(handle: SubprocessHandle): Promise<{
  outcome: SubprocessOutcome
  stdout: string
  stderr: string
  truncated: boolean
}> {
  const outcome = await handle.done
  const stdout = handle.collected.stdout?.readFrom(0)
  const stderr = handle.collected.stderr?.readFrom(0)
  if (stdout === undefined || stderr === undefined) {
    throw new HarnessError('Git process did not expose collected output', 'GIT_PROCESS_FAILED')
  }
  return {
    outcome,
    stdout: stdout.text,
    stderr: stderr.text,
    truncated: stdout.lossy || stderr.lossy,
  }
}

async function runGit(
  ctx: Context,
  exec: ToolExecution,
  argv: readonly string[],
  config: ResolvedConfig,
  options: { allowExitOne?: boolean } = {},
): Promise<GitRun> {
  exec.signal.throwIfAborted()
  const git = await ctx.subprocess.resolveExecutable('git', undefined, exec.signal)
  let settled: Awaited<ReturnType<typeof settle>>
  try {
    const policy = ctx.get('sandboxPolicy')?.resolve(
      exec.agent === undefined ? {} : { session: exec.agent.session },
    )
    settled = await settle(ctx.subprocess.spawn({
      argv: [git, '--literal-pathspecs', ...argv],
      cwd: executionCwd(exec),
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: config.maxOutputBytes },
        stderr: { maxBytes: config.maxOutputBytes },
      },
      graceMs: config.graceMs,
      signal: exec.signal,
      ...policy === undefined ? {} : { sandbox: policy },
    }))
  } catch (error: unknown) {
    if (exec.signal.aborted) throw new HarnessError('Git command was cancelled', 'GIT_ABORTED', { cause: error })
    throw new HarnessError('Git command could not start', 'GIT_PROCESS_FAILED', { cause: error })
  }
  if (exec.signal.aborted || settled.outcome.signal !== null || settled.outcome.exitCode === null) {
    throw new HarnessError('Git command was cancelled', 'GIT_ABORTED')
  }
  const exitCode = settled.outcome.exitCode
  if (exitCode !== 0 && !(options.allowExitOne === true && exitCode === 1)) {
    const detail = settled.stderr.trim() || settled.stdout.trim() || `exit ${exitCode}`
    throw new HarnessError(`Git command failed: ${detail}`, 'GIT_COMMAND_FAILED')
  }
  return { stdout: settled.stdout, stderr: settled.stderr, exitCode, truncated: settled.truncated }
}

/**
 * Parse `git status --porcelain=v1 -z` without treating paths as whitespace-delimited text.
 * @param text - complete NUL-delimited porcelain output.
 * @returns status entries in Git's reported order.
 */
export function parsePorcelainV1Z(text: string): GitStatusEntry[] {
  const records = text.split('\0')
  const entries: GitStatusEntry[] = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record === undefined || record.length === 0) continue
    if (record.length < 4 || record[2] !== ' ') {
      throw new HarnessError('Git returned an invalid porcelain status record', 'GIT_STATUS_INVALID')
    }
    const status = record.slice(0, 2)
    const path = record.slice(3)
    const renamed = status.includes('R') || status.includes('C')
    const originalPath = renamed ? records[index + 1] : undefined
    if (renamed) index += 1
    if (path.length === 0 || (renamed && (originalPath === undefined || originalPath.length === 0))) {
      throw new HarnessError('Git returned an incomplete porcelain status record', 'GIT_STATUS_INVALID')
    }
    entries.push({
      index: status[0] as string,
      worktree: status[1] as string,
      path,
      ...originalPath === undefined ? {} : { originalPath },
    })
  }
  return entries
}

async function gitStatus(ctx: Context, exec: ToolRunContext, config: ResolvedConfig): Promise<GitStatusValue> {
  const [root, branch, head, status] = await Promise.all([
    runGit(ctx, exec, ['rev-parse', '--show-toplevel'], config),
    runGit(ctx, exec, ['branch', '--show-current'], config),
    runGit(ctx, exec, ['rev-parse', '--verify', '--quiet', '--short', 'HEAD'], config, { allowExitOne: true }),
    runGit(ctx, exec, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], config),
  ])
  if (root.truncated || branch.truncated || head.truncated || status.truncated) {
    throw new HarnessError('Git status exceeded the configured output bound', 'GIT_OUTPUT_OVERFLOW')
  }
  const changes = parsePorcelainV1Z(status.stdout)
  return {
    root: root.stdout.trim(),
    branch: branch.stdout.trim() || null,
    head: head.exitCode === 0 ? head.stdout.trim() || null : null,
    clean: changes.length === 0,
    changes,
  }
}

function validatePaths(paths: readonly string[]): string[] {
  if (paths.length === 0) throw new HarnessError('At least one explicit path is required', 'GIT_PATHS_REQUIRED')
  return paths.map((path) => {
    if (path.length === 0 || path !== path.trim() || path.includes('\0')) {
      throw new HarnessError('Git paths must be non-empty, trimmed strings without NUL bytes', 'GIT_PATH_INVALID')
    }
    return path
  })
}

const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

function present(title: string, rawInput?: unknown): GenericCallView {
  return { card: 'generic', title, kind: 'other', ...rawInput === undefined ? {} : { rawInput } }
}

/** Register the four narrow Git workflow tools and the unconditional commit approval gate. */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  ctx.systemPrompt.section({
    name: 'tool:git',
    order: 112,
    text: 'Use git_status and git_diff to inspect repository state. Stage only explicit paths with git_stage. '
      + 'git_commit commits only the existing index and always requires a fresh human approval. Never claim a commit was made unless git_commit succeeded. '
      + 'No push, force-push, reset, rebase, checkout, or branch-deletion tool is provided.',
  })

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (exec.name !== 'git_commit') return next()
    const downstream = await next()
    if (downstream.kind !== 'allow') return downstream
    const args = exec.arguments as { message?: unknown }
    const message = typeof args.message === 'string' ? args.message.trim() : ''
    return {
      kind: 'ask',
      reason: message.length === 0
        ? 'Create a Git commit from the currently staged changes'
        : `Create a Git commit from the currently staged changes: ${message}`,
    }
  })

  ctx.tools.register(defineTool({
    name: 'git_status',
    effect: 'observe',
    description: 'Read the repository root, branch, HEAD, and staged/unstaged/untracked paths without changing Git state.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          root: { type: 'string', required: true },
          branch: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
          head: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
          clean: { type: 'boolean', required: true },
          changes: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                index: { type: 'string', required: true },
                worktree: { type: 'string', required: true },
                path: { type: 'string', required: true },
                originalPath: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    isConcurrencySafe: () => true,
    execute: (_args, exec) => gitStatus(ctx, exec, resolved),
    presentCall: () => present('Read Git status'),
  }))

  ctx.tools.register(defineTool({
    name: 'git_diff',
    effect: 'observe',
    description: 'Read a bounded working-tree or staged diff, optionally limited to explicit paths.',
    parameters: {
      staged: { type: 'boolean', description: 'When true, compare the index to HEAD; otherwise read unstaged changes.' },
      paths: { type: 'array', items: { type: 'string' }, description: 'Optional explicit repository-relative paths.' },
      context_lines: { type: 'number', description: 'Diff context lines, from 0 through 20. Defaults to 3.' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const contextLines = args.context_lines ?? 3
      if (!Number.isSafeInteger(contextLines) || contextLines < 0 || contextLines > 20) {
        throw new HarnessError('context_lines must be a safe integer from 0 through 20', 'GIT_DIFF_INVALID')
      }
      const paths = args.paths === undefined ? [] : validatePaths(args.paths)
      const result = await runGit(ctx, exec, [
        'diff', '--no-ext-diff', '--no-color', `--unified=${contextLines}`,
        ...args.staged === true ? ['--cached'] : [],
        ...paths.length === 0 ? [] : ['--', ...paths],
      ], resolved)
      const marker = result.truncated ? '\n\n[diff truncated at the configured output bound]' : ''
      return (result.stdout || '(no diff)') + marker
    },
    presentCall: args => present(args.staged === true ? 'Read staged Git diff' : 'Read Git diff', args.paths),
  }))

  ctx.tools.register(defineTool({
    name: 'git_stage',
    effect: 'mutate',
    description: 'Stage or unstage only the explicit repository paths supplied by the caller.',
    parameters: {
      action: { type: 'string', required: true, enum: ['stage', 'unstage'], description: 'stage | unstage' },
      paths: { type: 'array', required: true, items: { type: 'string' }, description: 'Explicit repository-relative paths; an empty list is rejected.' },
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      const paths = validatePaths(args.paths)
      const argv = args.action === 'stage'
        ? ['add', '--', ...paths]
        : ['restore', '--staged', '--', ...paths]
      const result = await runGit(ctx, exec, argv, resolved)
      if (result.truncated) throw new HarnessError('Git staging output exceeded the configured bound', 'GIT_OUTPUT_OVERFLOW')
      return `${args.action === 'stage' ? 'Staged' : 'Unstaged'} ${paths.length} path(s).`
    },
    presentCall: args => present(args.action === 'stage' ? 'Stage Git paths' : 'Unstage Git paths', args.paths),
  }))

  ctx.tools.register(defineTool({
    name: 'git_commit',
    effect: 'mutate',
    description: 'Create one commit from the existing staged index after a fresh human approval. Does not stage files or contact a remote.',
    parameters: {
      message: { type: 'string', required: true, description: 'Non-blank commit subject and optional body.' },
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      if (args.message.length === 0 || args.message !== args.message.trim() || args.message.includes('\0')) {
        throw new HarnessError('Commit message must be non-blank, trimmed, and contain no NUL bytes', 'GIT_COMMIT_INVALID')
      }
      const result = await runGit(ctx, exec, ['commit', '--message', args.message], resolved)
      if (result.truncated) throw new HarnessError('Git commit output exceeded the configured bound', 'GIT_OUTPUT_OVERFLOW')
      return (result.stdout + result.stderr).trim()
    },
    presentCall: args => present('Create Git commit', args.message),
  }))
}
