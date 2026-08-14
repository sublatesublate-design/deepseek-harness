/** Native desktop process for the existing Harness web composition. */

import { app, BrowserWindow, Menu, shell } from 'electron'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BoundedLog, renderStartupFailure } from './startup-support.mjs'

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))
const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const iconPath = join(desktopRoot, 'assets', 'icon.png')
const require = createRequire(import.meta.url)
const cliRoot = dirname(require.resolve('@deepseek-ai/dsh/package.json'))
const cliEntry = join(cliRoot, 'lib', 'bin.js')
const port = Number(process.env.DSH_DESKTOP_PORT ?? '3081')
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`DSH_DESKTOP_PORT must be an integer from 1 to 65535, got ${JSON.stringify(process.env.DSH_DESKTOP_PORT)}`)
}
const configuredUrl = process.env.DSH_DESKTOP_URL
const desktopUrl = new URL(configuredUrl ?? `http://127.0.0.1:${String(port)}`)
const loopbackHostname = desktopUrl.hostname === 'localhost'
  || desktopUrl.hostname === '[::1]'
  || /^127(?:\.\d{1,3}){3}$/.test(desktopUrl.hostname)
if (desktopUrl.protocol !== 'http:' || !loopbackHostname || desktopUrl.username !== '' || desktopUrl.password !== '') {
  throw new Error('DSH_DESKTOP_URL must be an unauthenticated http:// loopback URL')
}
const origin = desktopUrl.origin
const controlToken = configuredUrl === undefined
  ? randomBytes(32).toString('base64url')
  : process.env.DSH_DESKTOP_CONTROL_TOKEN
const platformQuery = encodeURIComponent(process.platform)
const CONTROL_TOKEN_HEADER = 'x-dsh-control-token'
const startupLog = new BoundedLog()
let harnessProcess
let mainWindow
let launchInFlight = false

app.setName('DeepSeek Harness')
app.setPath('userData', join(app.getPath('appData'), 'DeepSeek Harness'))
const logDirectory = join(app.getPath('userData'), 'logs')
const logFile = join(logDirectory, 'desktop.log')
mkdirSync(logDirectory, { recursive: true })
writeFileSync(logFile, '', 'utf8')
if (process.platform === 'win32') app.setAppUserModelId('ai.deepseek.harness')

function recordLog(source, value) {
  const line = `[${new Date().toISOString()}] [${source}] ${String(value)}`
  startupLog.append(line.endsWith('\n') ? line : `${line}\n`)
  try {
    appendFileSync(logFile, line.endsWith('\n') ? line : `${line}\n`, 'utf8')
  } catch (error) {
    console.warn(`dsh desktop: could not append ${logFile}`, error)
  }
}

recordLog('desktop', `booting ${origin}`)

/** Read saved bounds without making corrupt state a startup failure. */
function readWindowState() {
  const stateFile = join(app.getPath('userData'), 'window-state.json')
  if (!existsSync(stateFile)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const { width, height, x, y } = parsed
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 980 || height < 680) return undefined
    return { width, height, ...(Number.isInteger(x) && Number.isInteger(y) ? { x, y } : {}) }
  } catch {
    return undefined
  }
}

/** Persist only normal window bounds; maximized state restores through Electron. */
function saveWindowState(window) {
  if (window.isDestroyed() || window.isMinimized()) return
  const stateFile = join(app.getPath('userData'), 'window-state.json')
  try {
    writeFileSync(stateFile, `${JSON.stringify(window.getNormalBounds())}\n`, 'utf8')
  } catch (error) {
    recordLog('desktop', `could not save window state at ${stateFile}: ${String(error)}`)
  }
}

/** Probe both the Web document and, for managed Desktop, its credential boundary. */
async function serverIsReady() {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) })
    if (!response.ok || !(await response.text()).includes('<title>DeepSeek Harness</title>')) return false
    if (controlToken === undefined) return true
    const probe = `${origin}/api/auth-probe`
    const authorized = await fetch(probe, {
      headers: { [CONTROL_TOKEN_HEADER]: controlToken },
      signal: AbortSignal.timeout(1_000),
    })
    if (authorized.status !== 204) return false
    const anonymous = await fetch(probe, { signal: AbortSignal.timeout(1_000) })
    return anonymous.status === 401
  } catch {
    return false
  }
}

/** Start the bundled CLI through Electron's Node mode unless the configured Host is ready. */
async function ensureHarnessServer() {
  if (await serverIsReady()) return
  if (configuredUrl !== undefined) {
    throw new Error(`The configured Harness service is not ready at ${origin}.`)
  }
  if (harnessProcess !== undefined && harnessProcess.exitCode === null && harnessProcess.signalCode === null) {
    throw new Error(`The Harness service at ${origin} is still unavailable after its startup timeout.`)
  }

  harnessProcess = spawn(process.execPath, [
    cliEntry, 'web', '--host', '127.0.0.1', '--port', String(port),
  ], {
    cwd: app.isPackaged ? app.getPath('home') : repositoryRoot,
    env: { ...process.env, DSH_CONTROL_TOKEN: controlToken, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let launchError
  harnessProcess.once('error', (error) => { launchError = error })
  harnessProcess.stdout?.on('data', (chunk) => { process.stdout.write(chunk); recordLog('service', chunk) })
  harnessProcess.stderr?.on('data', (chunk) => { process.stderr.write(chunk); recordLog('service', chunk) })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (launchError !== undefined) throw launchError
    if (harnessProcess.exitCode !== null) throw new Error(`Harness service exited with code ${String(harnessProcess.exitCode)}.`)
    if (harnessProcess.signalCode !== null) throw new Error(`Harness service exited from signal ${harnessProcess.signalCode}.`)
    if (await serverIsReady()) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Harness service did not become ready at ${origin}.`)
}

function installControlCredential(window) {
  if (controlToken === undefined) return
  const websocketOrigin = origin.replace(/^http/, 'ws')
  window.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: [`${origin}/*`, `${websocketOrigin}/*`] },
    (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, [CONTROL_TOKEN_HEADER]: controlToken } })
    },
  )
}

async function showStartupFailure(window, error, retrying = false) {
  const message = error instanceof Error ? error.message : String(error)
  if (!retrying) recordLog('desktop', `startup failed: ${message}`)
  const html = renderStartupFailure({ message, logs: startupLog.read(), logPath: logFile, retrying })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

/** Start or reload the local app while retaining the native recovery window on failure. */
async function loadApplication(window, restart = false) {
  if (launchInFlight || window.isDestroyed()) return
  launchInFlight = true
  try {
    if (restart && configuredUrl === undefined) await stopHarnessServerAndWait()
    await ensureHarnessServer()
    await window.loadURL(`${origin}/?desktop=1&platform=${platformQuery}`)
  } catch (error) {
    await showStartupFailure(window, error)
  } finally {
    launchInFlight = false
  }
}

/** Create the native window before service startup so failures remain actionable. */
async function createWindow() {
  const saved = readWindowState()
  const window = new BrowserWindow({
    width: saved?.width ?? 1440,
    height: saved?.height ?? 920,
    ...(saved?.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 980,
    minHeight: 680,
    show: false,
    title: 'DeepSeek Harness',
    icon: iconPath,
    backgroundColor: '#f4f6f8',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 14, y: 13 } }
      : { titleBarOverlay: { color: '#f4f6f8', symbolColor: '#61666b', height: 42 } }),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  mainWindow = window
  installControlCredential(window)
  window.webContents.setWindowOpenHandler(({ url }) => {
    const protocol = new URL(url).protocol
    if (protocol === 'https:' || protocol === 'http:') void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url === 'dsh-desktop://retry') {
      event.preventDefault()
      void showStartupFailure(window, new Error('Starting the local Harness service…'), true)
        .then(() => loadApplication(window, true))
      return
    }
    if (url === 'dsh-desktop://open-log') {
      event.preventDefault()
      shell.showItemInFolder(logFile)
    }
  })
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.once('ready-to-show', () => window.show())
  window.on('close', () => saveWindowState(window))
  await loadApplication(window)
}

/** Preserve the standard macOS application shortcuts while Windows uses the in-page chrome. */
function installApplicationMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]))
}

function stopHarnessServer() {
  if (harnessProcess?.pid === undefined || harnessProcess.exitCode !== null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(harnessProcess.pid), '/t', '/f'], { windowsHide: true })
  } else {
    harnessProcess.kill('SIGTERM')
  }
  harnessProcess = undefined
}

/** Restart waits briefly for the owned process so the next bind does not race teardown. */
async function stopHarnessServerAndWait() {
  const child = harnessProcess
  if (child?.pid === undefined || child.exitCode !== null) {
    harnessProcess = undefined
    return
  }
  const exited = new Promise(resolve => child.once('exit', resolve))
  stopHarnessServer()
  await Promise.race([
    exited,
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ])
}

const ownsInstance = app.requestSingleInstanceLock()
recordLog('desktop', `single-instance lock ${ownsInstance ? 'acquired' : 'held by another process'}`)
if (!ownsInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  void app.whenReady().then(async () => {
    recordLog('desktop', 'Electron ready')
    installApplicationMenu()
    if (process.platform === 'darwin') app.dock.setIcon(iconPath)
    await createWindow()
  }).catch((error) => {
    recordLog('desktop', `native window failed: ${String(error)}`)
    app.quit()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', stopHarnessServer)
}
