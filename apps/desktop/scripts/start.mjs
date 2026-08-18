/** Quiet source launcher that rebuilds only when relevant inputs changed. */

import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { electronSpawnOptions } from './launch-support.mjs'
import { BUILD_STATE_VERSION, computeSourceFingerprint, rebuildReason } from './source-state.mjs'

const desktopRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const repositoryRoot = dirname(dirname(desktopRoot))
const cacheDirectory = join(repositoryRoot, '.cache', 'deepseek-desktop')
const statePath = join(cacheDirectory, 'build-state.json')
const buildLogPath = join(cacheDirectory, 'build.log')
const BUILD_INPUTS = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'tsconfig.base.json',
  'tsconfig.host.json',
  'tsconfig.client.json',
  'tsdown.config.ts',
  'apps/cli/package.json',
  'apps/cli/tsconfig.json',
  'apps/cli/tsdown.config.ts',
  'apps/cli/src',
  'apps/cli/config',
  'apps/desktop/package.json',
  'apps/desktop/tsdown.config.ts',
  'apps/desktop/src',
  'apps/desktop/scripts',
  'apps/desktop/assets',
  'apps/web/package.json',
  'apps/web/tsconfig.json',
  'apps/web/vite.config.ts',
  'apps/web/index.html',
  'apps/web/src',
  'apps/web/public',
  ':(glob)packages/*/*/package.json',
  ':(glob)packages/*/*/tsconfig*.json',
  ':(glob)packages/*/*/tsdown.config.ts',
  ':(glob)packages/*/*/src/**',
  'native',
  'vendor',
]
const REQUIRED_ARTIFACTS = [
  'apps/cli/lib/bin.js',
  'apps/desktop/lib/main.js',
  'apps/desktop/lib/pet-preload.cjs',
  'apps/web/dist/index.html',
  'packages/client/connection/lib/index.js',
]
const zh = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('zh')
const copy = zh
  ? {
      current: 'DeepSeek Desktop：构建已是最新，正在启动。',
      first: 'DeepSeek Desktop：首次运行，正在构建。',
      changed: 'DeepSeek Desktop：检测到相关源码变化，正在构建。',
      missing: 'DeepSeek Desktop：构建产物缺失，正在重新构建。',
      complete: seconds => `DeepSeek Desktop：构建完成（${seconds} 秒），正在启动。`,
      changedDuringBuild: 'DeepSeek Desktop：构建期间源码发生变化，正在重新构建。',
      failed: 'DeepSeek Desktop：构建失败。',
      log: `完整构建日志：${buildLogPath}`,
    }
  : {
      current: 'DeepSeek Desktop: build is current; starting.',
      first: 'DeepSeek Desktop: first launch; building.',
      changed: 'DeepSeek Desktop: relevant source changed; building.',
      missing: 'DeepSeek Desktop: build output is missing; rebuilding.',
      complete: seconds => `DeepSeek Desktop: build completed in ${seconds}s; starting.`,
      changedDuringBuild: 'DeepSeek Desktop: source changed during the build; rebuilding.',
      failed: 'DeepSeek Desktop: build failed.',
      log: `Full build log: ${buildLogPath}`,
    }

function readState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return undefined
  }
}

function appendTail(current, chunk, maximum = 48 * 1024) {
  return `${current}${String(chunk)}`.slice(-maximum)
}

function packageManagerCommand(args) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath !== undefined) return { command: process.execPath, args: [npmExecPath, ...args] }
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', ['pnpm', ...args].join(' ')],
    }
  }
  return { command: 'pnpm', args }
}

async function runBuild() {
  mkdirSync(cacheDirectory, { recursive: true })
  const log = createWriteStream(buildLogPath, { flags: 'w' })
  const invocation = packageManagerCommand(['run', 'build:desktop'])
  const child = spawn(invocation.command, invocation.args, {
    cwd: repositoryRoot,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let tail = ''
  child.stdout.on('data', chunk => { log.write(chunk); tail = appendTail(tail, chunk) })
  child.stderr.on('data', chunk => { log.write(chunk); tail = appendTail(tail, chunk) })
  const outcome = await new Promise(resolve => {
    child.once('error', error => resolve({ error }))
    child.once('close', code => resolve({ code }))
  })
  await new Promise(resolve => log.end(resolve))
  if ('error' in outcome) throw outcome.error
  if (outcome.code !== 0) {
    console.error(tail.trimEnd())
    throw new Error(`build exited with code ${String(outcome.code)}`)
  }
}

async function launchElectron() {
  const require = createRequire(import.meta.url)
  const electronPath = require('electron')
  const child = spawn(electronPath, ['.'], electronSpawnOptions({
    cwd: desktopRoot,
    environment: process.env,
  }))
  const outcome = await new Promise(resolve => {
    child.once('error', error => resolve({ error }))
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
  if ('error' in outcome) throw outcome.error
  if (outcome.signal !== null) process.kill(process.pid, outcome.signal)
  process.exitCode = outcome.code ?? 1
}

try {
  const fingerprint = computeSourceFingerprint({ repositoryRoot, pathspecs: BUILD_INPUTS })
  const artifactsPresent = REQUIRED_ARTIFACTS.every(path => existsSync(join(repositoryRoot, ...path.split('/'))))
  const reason = rebuildReason({ state: readState(), fingerprint, artifactsPresent })
  if (reason === undefined) {
    console.log(copy.current)
  } else {
    console.log(reason === 'first-run' ? copy.first : reason === 'source-changed' ? copy.changed : copy.missing)
    const startedAt = Date.now()
    let buildFingerprint = fingerprint
    let completedFingerprint
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await runBuild()
      completedFingerprint = computeSourceFingerprint({ repositoryRoot, pathspecs: BUILD_INPUTS })
      if (completedFingerprint === buildFingerprint) break
      if (attempt === 3) throw new Error('source kept changing during three consecutive builds')
      console.log(copy.changedDuringBuild)
      buildFingerprint = completedFingerprint
    }
    writeFileSync(statePath, `${JSON.stringify({ version: BUILD_STATE_VERSION, fingerprint: completedFingerprint })}\n`, 'utf8')
    console.log(copy.complete(((Date.now() - startedAt) / 1_000).toFixed(1)))
  }
  if (!process.argv.includes('--prepare-only')) await launchElectron()
} catch (error) {
  console.error(copy.failed)
  console.error(error instanceof Error ? error.message : error)
  if (existsSync(buildLogPath)) console.error(copy.log)
  process.exitCode = 1
}
