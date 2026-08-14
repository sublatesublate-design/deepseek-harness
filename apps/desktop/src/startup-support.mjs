/** Shared diagnostics and self-contained documents for desktop startup. */

const COPY = {
  en: {
    appName: 'DeepSeek Desktop',
    startingLabel: 'Starting local service',
    startingTitle: 'Preparing your workspace',
    startingBody: 'The desktop app is starting its private local service. This usually takes a few seconds.',
    retryingLabel: 'Restarting local service',
    retryingTitle: 'Trying again',
    retryingBody: 'The previous service is being stopped before a clean restart.',
    failedLabel: 'Service unavailable',
    failedTitle: 'The local service could not start',
    retry: 'Retry service',
    retrying: 'Retrying…',
    showLog: 'Show log file',
    logSummary: 'View recent service output',
    noLogs: 'No service output was captured.',
    omitted: '[earlier output omitted]',
    unreachable: 'No service is accepting connections yet.',
    httpError: status => `The service home page returned HTTP ${status}.`,
    unexpectedService: 'Another application is using this address, or the Web build is incomplete.',
    authMissing: 'The service does not provide the desktop authentication endpoint. Rebuild the desktop artifacts and try again.',
    authRejected: status => `The service rejected the desktop credential with HTTP ${status}. Another desktop service may already own this address.`,
    authNotEnforced: status => `The service accepted an unauthenticated control request with HTTP ${status}. It cannot be opened safely.`,
  },
  'zh-CN': {
    appName: 'DeepSeek Desktop',
    startingLabel: '正在启动本地服务',
    startingTitle: '正在准备工作区',
    startingBody: '桌面端正在启动专用的本地服务，通常只需几秒钟。',
    retryingLabel: '正在重启本地服务',
    retryingTitle: '正在重新尝试',
    retryingBody: '桌面端会先等待旧服务完全退出，再进行一次干净启动。',
    failedLabel: '服务暂不可用',
    failedTitle: '本地服务启动失败',
    retry: '重试服务',
    retrying: '正在重试…',
    showLog: '打开日志位置',
    logSummary: '查看最近的服务输出',
    noLogs: '没有捕获到服务输出。',
    omitted: '[较早的输出已省略]',
    unreachable: '本地服务尚未接受连接。',
    httpError: status => `服务首页返回了 HTTP ${status}。`,
    unexpectedService: '该地址正被其他应用占用，或 Web 构建产物不完整。',
    authMissing: '服务缺少桌面端认证接口。请重新构建桌面端产物后再试。',
    authRejected: status => `服务以 HTTP ${status} 拒绝了桌面端凭据，可能已有另一个桌面服务占用该地址。`,
    authNotEnforced: status => `服务以 HTTP ${status} 接受了未认证的控制请求，桌面端无法安全连接。`,
  },
}

/** Bounded tail buffer used by the failure page. */
export class BoundedLog {
  constructor(maxCharacters = 64 * 1024) {
    this.maxCharacters = maxCharacters
    this.value = ''
  }

  append(text) {
    this.value += String(text)
    if (this.value.length > this.maxCharacters) {
      const marker = '[earlier output omitted]\n'
      this.value = `${marker}${this.value.slice(-(this.maxCharacters - marker.length))}`
    }
  }

  read() {
    return this.value
  }
}

function copyFor(locale) {
  return locale === 'zh-CN' ? COPY['zh-CN'] : COPY.en
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function shellStyles() {
  return `
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 680px; min-height: 100vh; background: #f5f6f7; color: #17191c; }
    main { width: min(840px, calc(100vw - 96px)); margin: 0 auto; padding: clamp(72px, 11vh, 116px) 0 64px; }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 52px; color: #25282c; font-size: 14px; font-weight: 680; letter-spacing: -.01em; }
    .mark { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 8px; background: #12324a; color: #e5f6ff; font-size: 13px; }
    .eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; color: #66717a; font-size: 12px; font-weight: 650; letter-spacing: .05em; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #2b7fa9; box-shadow: 0 0 0 5px rgba(43,127,169,.12); }
    h1 { max-width: 620px; margin: 0; font-size: clamp(32px, 4vw, 44px); line-height: 1.08; letter-spacing: -.045em; }
    .summary { max-width: 680px; margin: 18px 0 0; color: #626a72; font-size: 15px; line-height: 1.65; overflow-wrap: anywhere; }
    .actions { display: flex; align-items: center; gap: 10px; margin-top: 30px; }
    a { display: inline-flex; min-height: 38px; align-items: center; justify-content: center; border-radius: 9px; padding: 0 15px; color: inherit; font-size: 13px; font-weight: 650; text-decoration: none; transition: transform 120ms ease, background 120ms ease; }
    a:hover { transform: translateY(-1px); }
    .primary { background: #173d56; color: #fff; }
    .secondary { border: 1px solid #d7dce0; background: #fff; }
    details { margin-top: 48px; border-top: 1px solid #d9dde1; }
    summary { padding: 14px 0; color: #59616a; cursor: pointer; font-size: 12px; font-weight: 650; list-style-position: inside; }
    .path { display: block; overflow: hidden; padding: 2px 0 10px; color: #858b91; font: 11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
    pre { max-height: 300px; margin: 0; overflow: auto; padding: 12px 0; color: #4d555c; font: 11px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .pulse { animation: pulse 1.3s ease-in-out infinite; }
    @media (prefers-reduced-motion: no-preference) { main { animation: enter 220ms ease-out both; } @keyframes enter { from { opacity: 0; transform: translateY(6px); } } @keyframes pulse { 50% { opacity: .38; transform: scale(.82); } } }
    @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
    @media (prefers-color-scheme: dark) { body { background: #151719; color: #f0f2f3; } .brand { color: #f0f2f3; } .summary, pre { color: #aeb4ba; } .secondary { border-color: #3b4045; background: #202326; } .primary { background: #dff4ff; color: #112b3a; } details { border-color: #34383c; } summary { color: #b8bec3; } }
  `
}

function documentShell({ locale, label, title, body, content = '', pulse = false }) {
  const copy = copyFor(locale)
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(copy.appName)} — ${escapeHtml(title)}</title>
  <style>${shellStyles()}</style>
</head>
<body>
  <main>
    <div class="brand"><span class="mark">DS</span>${escapeHtml(copy.appName)}</div>
    <div class="eyebrow"><span class="dot${pulse ? ' pulse' : ''}"></span>${escapeHtml(label)}</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="summary">${escapeHtml(body)}</p>
    ${content}
  </main>
</body>
</html>`
}

/** Render the first visible document while the local service starts. */
export function renderStartupProgress({ locale = 'en', retrying = false } = {}) {
  const copy = copyFor(locale)
  return documentShell({
    locale,
    label: retrying ? copy.retryingLabel : copy.startingLabel,
    title: retrying ? copy.retryingTitle : copy.startingTitle,
    body: retrying ? copy.retryingBody : copy.startingBody,
    pulse: true,
  })
}

/** Render one self-contained, sandbox-safe native startup failure document. */
export function renderStartupFailure({ message, logs, logPath, retrying = false, locale = 'en' }) {
  const copy = copyFor(locale)
  const logText = logs.trim().length === 0 ? copy.noLogs : logs.trimEnd()
  const content = `
    <nav class="actions" aria-label="Recovery actions">
      <a class="primary" href="dsh-desktop://retry"${retrying ? ' aria-disabled="true"' : ''}>${retrying ? copy.retrying : copy.retry}</a>
      <a class="secondary" href="dsh-desktop://open-log">${copy.showLog}</a>
    </nav>
    <details>
      <summary>${copy.logSummary}</summary>
      <span class="path" title="${escapeHtml(logPath)}">${escapeHtml(logPath)}</span>
      <pre>${escapeHtml(logText)}</pre>
    </details>`
  return documentShell({ locale, label: copy.failedLabel, title: copy.failedTitle, body: message, content })
}

/** Probe the document identity and optional desktop credential behavior. */
export async function probeHarnessService({ origin, controlToken, request = fetch, timeout = 1_000 }) {
  const options = () => ({ signal: AbortSignal.timeout(timeout) })
  try {
    const response = await request(origin, options())
    if (!response.ok) return { kind: 'http-error', status: response.status }
    if (!(await response.text()).includes('<title>DeepSeek Harness</title>')) return { kind: 'unexpected-service' }
    if (controlToken === undefined) return { kind: 'ready' }

    const probe = `${origin}/api/auth-probe`
    const authorized = await request(probe, {
      ...options(),
      headers: { 'x-dsh-control-token': controlToken },
    })
    if (authorized.status === 404) return { kind: 'auth-missing' }
    if (authorized.status !== 204) return { kind: 'auth-rejected', status: authorized.status }

    const anonymous = await request(probe, options())
    if (anonymous.status !== 401) return { kind: 'auth-not-enforced', status: anonymous.status }
    return { kind: 'ready' }
  } catch (error) {
    return { kind: 'unreachable', detail: error instanceof Error ? error.message : String(error) }
  }
}

/** Turn a readiness result into a stable, user-facing diagnostic. */
export function describeReadiness(result, locale = 'en') {
  const copy = copyFor(locale)
  switch (result.kind) {
    case 'ready': return ''
    case 'unreachable': return copy.unreachable
    case 'http-error': return copy.httpError(result.status)
    case 'unexpected-service': return copy.unexpectedService
    case 'auth-missing': return copy.authMissing
    case 'auth-rejected': return copy.authRejected(result.status)
    case 'auth-not-enforced': return copy.authNotEnforced(result.status)
    default: throw new Error(`Unknown readiness result: ${JSON.stringify(result)}`)
  }
}

/** Restore saved bounds only when a useful portion remains on a current display. */
export function restoreWindowBounds(saved, workAreas) {
  if (typeof saved !== 'object' || saved === null) return undefined
  const { width, height, x, y } = saved
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 980 || height < 680) return undefined
  const size = { width, height }
  if (!Number.isInteger(x) || !Number.isInteger(y)) return size
  const visible = workAreas.some(area => {
    const overlapWidth = Math.min(x + width, area.x + area.width) - Math.max(x, area.x)
    const overlapHeight = Math.min(y + height, area.y + area.height) - Math.max(y, area.y)
    return overlapWidth >= 120 && overlapHeight >= 80
  })
  return visible ? { ...size, x, y } : size
}
