/** Built-artifact smoke for the real Electron → CLI → Web startup path. */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const builtEntry = join(desktopRoot, 'lib', 'main.js')
const sourceEntries = [
  join(desktopRoot, 'src', 'main.mjs'),
  join(desktopRoot, 'src', 'startup-support.mjs'),
]
if (!existsSync(builtEntry)) throw new Error(`Missing built desktop entry: ${builtEntry}`)
const builtTime = statSync(builtEntry).mtimeMs
const staleSource = sourceEntries.find(source => statSync(source).mtimeMs > builtTime)
if (staleSource !== undefined) {
  throw new Error(`Desktop build is stale: ${staleSource} is newer than ${builtEntry}`)
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address !== 'object' || address === null) {
        server.close()
        reject(new Error('Could not allocate a loopback port.'))
        return
      }
      server.close(error => error === undefined ? resolve(address.port) : reject(error))
    })
  })
}

function assertPortReleased(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => server.close(error => error === undefined ? resolve() : reject(error)))
  })
}

function terminateTree(child) {
  if (child.pid === undefined) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
  } else {
    child.kill('SIGKILL')
  }
}

const port = await reservePort()
const smokeUserData = mkdtempSync(join(tmpdir(), 'dsh-desktop-smoke-'))
process.once('exit', () => rmSync(smokeUserData, { recursive: true, force: true }))
const require = createRequire(import.meta.url)
const electronPath = require('electron')
const child = spawn(electronPath, ['.', '--dsh-desktop-smoke'], {
  cwd: desktopRoot,
  env: {
    ...process.env,
    DSH_DESKTOP_PORT: String(port),
    DSH_DESKTOP_SMOKE_USER_DATA: smokeUserData,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
let stdout = ''
let stderr = ''
child.stdout.on('data', chunk => { stdout = `${stdout}${String(chunk)}`.slice(-128 * 1024) })
child.stderr.on('data', chunk => { stderr = `${stderr}${String(chunk)}`.slice(-128 * 1024) })

let timeoutHandle
const outcome = await Promise.race([
  new Promise(resolve => {
    child.once('error', error => resolve({ error }))
    child.once('close', (code, signal) => resolve({ code, signal }))
  }),
  new Promise(resolve => { timeoutHandle = setTimeout(() => resolve({ timeout: true }), 90_000) }),
])
clearTimeout(timeoutHandle)
if ('timeout' in outcome) {
  terminateTree(child)
  throw new Error(`Desktop smoke timed out.\nstdout:\n${stdout}\nstderr:\n${stderr}`)
}
if ('error' in outcome) throw outcome.error
if (outcome.code !== 0 || !stdout.includes('DSH_DESKTOP_SMOKE_READY')) {
  throw new Error(`Desktop smoke failed with code ${String(outcome.code)} and signal ${String(outcome.signal)}.\nstdout:\n${stdout}\nstderr:\n${stderr}`)
}
await assertPortReleased(port)
rmSync(smokeUserData, { recursive: true, force: true })
if (existsSync(smokeUserData)) throw new Error(`Desktop smoke data was not removed: ${smokeUserData}`)
console.log(`Desktop built startup reached the Web application and released port ${String(port)}.`)
