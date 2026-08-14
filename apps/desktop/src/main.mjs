/** Native desktop process for the existing Harness web composition. */

import { app, BrowserWindow, Menu, screen, shell } from 'electron'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BoundedLog,
  describeReadiness,
  probeHarnessService,
  renderStartupFailure,
  renderStartupProgress,
  restoreWindowBounds,
} from './startup-support.mjs'

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
const smokeTest = process.argv.includes('--dsh-desktop-smoke')
const startupLog = new BoundedLog()
let harnessProcess
let harnessProcessDone
let removeHarnessOutputListeners
let mainWindow
let launchInFlight = false
let locale = 'en'
let quitInFlight = false
let shutdownComplete = false

app.setName('DeepSeek Desktop')
const smokeUserData = smokeTest ? process.env.DSH_DESKTOP_SMOKE_USER_DATA : undefined
if (smokeTest && (smokeUserData === undefined || !isAbsolute(smokeUserData))) {
  throw new Error('DSH_DESKTOP_SMOKE_USER_DATA must be an absolute path during a desktop smoke test')
}
app.setPath('userData', smokeUserData ?? join(app.getPath('appData'), 'DeepSeek Desktop'))
const logDirectory = join(app.getPath('userData'), 'logs')
const logFile = join(logDirectory, 'desktop.log')
const previousLogFile = join(logDirectory, 'desktop.previous.log')
if (process.platform === 'win32') app.setAppUserModelId('ai.deepseek.desktop')

function initializeLog() {
  mkdirSync(logDirectory, { recursive: true })
  try {
    if (existsSync(logFile)) {
      rmSync(previousLogFile, { force: true })
      renameSync(logFile, previousLogFile)
    }
    writeFileSync(logFile, '', 'utf8')
  } catch (error) {
    console.warn(`dsh desktop: could not rotate ${logFile}`, error)
  }
}

function recordLog(source, value) {
  const line = `[${new Date().toISOString()}] [${source}] ${String(value)}`
  startupLog.append(line.endsWith('\n') ? line : `${line}\n`)
  try {
    appendFileSync(logFile, line.endsWith('\n') ? line : `${line}\n`, 'utf8')
  } catch (error) {
    console.warn(`dsh desktop: could not append ${logFile}`, error)
  }
}

/** Read saved bounds without making corrupt state a startup failure. */
function readWindowState() {
  const stateFile = join(app.getPath('userData'), 'window-state.json')
  if (!existsSync(stateFile)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8'))
    const workAreas = screen.getAllDisplays().map(display => display.workArea)
    return restoreWindowBounds(parsed, workAreas)
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

class DesktopStartupError extends Error {
  constructor(english, chinese) {
    super(english)
    this.chinese = chinese
  }

  localizedMessage(selectedLocale) {
    return selectedLocale === 'zh-CN' ? this.chinese : this.message
  }
}

function readinessFailure(result, context) {
  const englishDetail = describeReadiness(result, 'en')
  const chineseDetail = describeReadiness(result, 'zh-CN')
  if (context === 'configured') {
    return new DesktopStartupError(
      `The configured local service at ${origin} is unavailable. ${englishDetail}`,
      `配置的本地服务 ${origin} 不可用。${chineseDetail}`,
    )
  }
  if (context === 'occupied') {
    return new DesktopStartupError(
      `DeepSeek Desktop cannot use ${origin}. ${englishDetail}`,
      `DeepSeek Desktop 无法使用 ${origin}。${chineseDetail}`,
    )
  }
  return new DesktopStartupError(
    `The local service did not become ready at ${origin}. ${englishDetail}`,
    `本地服务未能在 ${origin} 就绪。${chineseDetail}`,
  )
}

async function currentReadiness() {
  return probeHarnessService({ origin, controlToken })
}

function processIsRunning(child) {
  return child !== undefined && child.exitCode === null && child.signalCode === null
}

function attachHarnessProcess(child) {
  let launchError
  const stdoutListener = chunk => { process.stdout.write(chunk); recordLog('service', chunk) }
  const stderrListener = chunk => { process.stderr.write(chunk); recordLog('service', chunk) }
  child.stdout?.on('data', stdoutListener)
  child.stderr?.on('data', stderrListener)
  child.once('error', error => { launchError = error })
  harnessProcessDone = new Promise(resolve => {
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
  removeHarnessOutputListeners = () => {
    child.stdout?.off('data', stdoutListener)
    child.stderr?.off('data', stderrListener)
  }
  return () => launchError
}

/** Start the bundled CLI through Electron's Node mode unless the configured Host is ready. */
async function ensureHarnessServer() {
  let readiness = await currentReadiness()
  if (readiness.kind === 'ready') return
  if (configuredUrl !== undefined) throw readinessFailure(readiness, 'configured')
  if (readiness.kind !== 'unreachable') throw readinessFailure(readiness, 'occupied')
  if (processIsRunning(harnessProcess)) {
    throw new DesktopStartupError(
      `The local service process is still running but unavailable at ${origin}.`,
      `本地服务进程仍在运行，但 ${origin} 无法访问。`,
    )
  }

  harnessProcess = spawn(process.execPath, [
    cliEntry, 'web', '--host', '127.0.0.1', '--port', String(port),
  ], {
    cwd: app.isPackaged ? app.getPath('home') : repositoryRoot,
    env: { ...process.env, DSH_CONTROL_TOKEN: controlToken, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const getLaunchError = attachHarnessProcess(harnessProcess)
  const deadline = Date.now() + 60_000
  let previousDiagnostic = ''
  while (Date.now() < deadline) {
    const launchError = getLaunchError()
    if (launchError !== undefined) throw launchError
    if (harnessProcess.exitCode !== null) {
      throw new DesktopStartupError(
        `The local service exited with code ${String(harnessProcess.exitCode)}.`,
        `本地服务已退出，退出码为 ${String(harnessProcess.exitCode)}。`,
      )
    }
    if (harnessProcess.signalCode !== null) {
      throw new DesktopStartupError(
        `The local service exited from signal ${harnessProcess.signalCode}.`,
        `本地服务因信号 ${harnessProcess.signalCode} 退出。`,
      )
    }

    readiness = await currentReadiness()
    if (readiness.kind === 'ready') return
    const diagnostic = describeReadiness(readiness, 'en')
    if (diagnostic !== previousDiagnostic) {
      recordLog('readiness', `${readiness.kind}: ${diagnostic}`)
      previousDiagnostic = diagnostic
    }
    if (!['unreachable', 'http-error'].includes(readiness.kind)) throw readinessFailure(readiness, 'startup')
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw readinessFailure(readiness, 'startup')
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

function localDocument(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

/** Restore and present the native window after navigation or instance activation. */
function presentWindow(window, reason) {
  if (smokeTest || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  recordLog('window', `${reason}: visible=${String(window.isVisible())}, focused=${String(window.isFocused())}`)
}

async function showStartupProgress(window, retrying = false) {
  await window.loadURL(localDocument(renderStartupProgress({ locale, retrying })))
  presentWindow(window, retrying ? 'retry progress presented' : 'startup progress presented')
}

async function showStartupFailure(window, error) {
  const message = error instanceof DesktopStartupError
    ? error.localizedMessage(locale)
    : error instanceof Error ? error.message : String(error)
  recordLog('desktop', `startup failed: ${error instanceof Error ? error.message : String(error)}`)
  const html = renderStartupFailure({ message, logs: startupLog.read(), logPath: logFile, locale })
  await window.loadURL(localDocument(html))
  presentWindow(window, 'startup failure presented')
}

/** Start or reload the local app while retaining the native recovery window on failure. */
async function loadApplication(window, restart = false) {
  if (launchInFlight || window.isDestroyed()) return false
  launchInFlight = true
  try {
    await showStartupProgress(window, restart)
    if (restart && configuredUrl === undefined) await stopHarnessServerAndWait()
    await ensureHarnessServer()
    await window.loadURL(`${origin}/?desktop=1&platform=${platformQuery}`)
    presentWindow(window, 'application presented')
    return true
  } catch (error) {
    await showStartupFailure(window, error)
    return false
  } finally {
    launchInFlight = false
  }
}

/** Create the native window before service startup so progress and failures remain visible. */
async function createWindow() {
  const saved = readWindowState()
  const window = new BrowserWindow({
    width: saved?.width ?? 1440,
    height: saved?.height ?? 920,
    ...(saved?.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 980,
    minHeight: 680,
    show: false,
    title: 'DeepSeek Desktop',
    icon: iconPath,
    backgroundColor: '#f5f6f7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 14, y: 13 } }
      : { titleBarOverlay: { color: '#f5f6f7', symbolColor: '#61666b', height: 42 } }),
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
      void loadApplication(window, true)
      return
    }
    if (url === 'dsh-desktop://open-log') {
      event.preventDefault()
      shell.showItemInFolder(logFile)
    }
  })
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.on('close', event => {
    saveWindowState(window)
    if (process.platform !== 'darwin' && !shutdownComplete && processIsRunning(harnessProcess)) {
      event.preventDefault()
      app.quit()
    }
  })
  const loaded = await loadApplication(window)
  if (smokeTest) {
    if (!loaded) throw new Error('Desktop smoke test did not reach the Web application.')
    console.log('DSH_DESKTOP_SMOKE_READY')
    app.quit()
  }
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

function waitForExit(done, timeout) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeout)
    void done.then(() => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

function runTaskkill(pid) {
  return new Promise(resolve => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    killer.once('error', error => resolve({ error }))
    killer.once('close', code => resolve({ code }))
  })
}

/** Stop the owned process tree and return only after the child has closed. */
async function stopHarnessServerAndWait() {
  const child = harnessProcess
  const done = harnessProcessDone
  if (child === undefined || done === undefined || !processIsRunning(child)) {
    harnessProcess = undefined
    harnessProcessDone = undefined
    removeHarnessOutputListeners?.()
    removeHarnessOutputListeners = undefined
    return
  }

  removeHarnessOutputListeners?.()
  removeHarnessOutputListeners = undefined
  if (process.platform === 'win32') {
    const outcome = await runTaskkill(child.pid)
    if ('error' in outcome) recordLog('desktop', `taskkill failed to start: ${String(outcome.error)}`)
  } else {
    child.kill('SIGTERM')
  }

  let exited = await waitForExit(done, 5_000)
  if (!exited && process.platform !== 'win32') {
    child.kill('SIGKILL')
    exited = await waitForExit(done, 5_000)
  }
  if (!exited && process.platform === 'win32') {
    await runTaskkill(child.pid)
    exited = await waitForExit(done, 5_000)
  }
  if (!exited) throw new Error(`The owned local service process ${String(child.pid)} did not exit.`)

  if (harnessProcess === child) {
    harnessProcess = undefined
    harnessProcessDone = undefined
  }
}

const ownsInstance = app.requestSingleInstanceLock()
if (!ownsInstance) {
  app.quit()
} else {
  initializeLog()
  recordLog('desktop', `booting ${origin}`)
  recordLog('desktop', 'single-instance lock acquired')
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    presentWindow(mainWindow, 'second instance activated')
  })
  void app.whenReady().then(async () => {
    locale = app.getLocale().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
    recordLog('desktop', `Electron ready (${locale})`)
    installApplicationMenu()
    if (process.platform === 'darwin') app.dock.setIcon(iconPath)
    await createWindow()
  }).catch((error) => {
    recordLog('desktop', `native window failed: ${String(error)}`)
    if (smokeTest) process.exitCode = 1
    app.quit()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', event => {
    if (shutdownComplete || configuredUrl !== undefined || !processIsRunning(harnessProcess)) return
    event.preventDefault()
    if (quitInFlight) return
    quitInFlight = true
    void stopHarnessServerAndWait().then(() => {
      shutdownComplete = true
      app.quit()
    }).catch(error => {
      recordLog('desktop', `shutdown failed: ${String(error)}`)
      quitInFlight = false
      if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
        void showStartupFailure(mainWindow, new DesktopStartupError(
          `DeepSeek Desktop could not stop its local service. ${String(error)}`,
          `DeepSeek Desktop 无法停止本地服务。${String(error)}`,
        ))
      }
    })
  })
}
