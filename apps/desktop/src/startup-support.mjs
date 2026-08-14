/** Pure helpers for the native startup and recovery surface. */

/** Bounded tail buffer used by the failure page. */
export class BoundedLog {
  constructor(maxCharacters = 64 * 1024) {
    this.maxCharacters = maxCharacters
    this.value = ''
  }

  append(text) {
    this.value += String(text)
    if (this.value.length > this.maxCharacters) {
      this.value = `[earlier output omitted]\n${this.value.slice(-(this.maxCharacters - 25))}`
    }
  }

  read() {
    return this.value
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Render one self-contained, sandbox-safe native startup failure document. */
export function renderStartupFailure({ message, logs, logPath, retrying = false }) {
  const logText = logs.trim().length === 0 ? 'No service output was captured.' : logs.trimEnd()
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeepSeek Harness — Startup failed</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 720px; min-height: 100vh; background: #f4f6f8; color: #171a1d; }
    main { width: min(900px, calc(100vw - 96px)); margin: 0 auto; padding: 92px 0 64px; }
    .eyebrow { display: flex; align-items: center; gap: 9px; margin-bottom: 20px; color: #9a5416; font-size: 12px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #d97706; box-shadow: 0 0 0 5px rgba(217,119,6,.12); }
    h1 { max-width: 620px; margin: 0; font-size: 34px; line-height: 1.15; letter-spacing: -.035em; }
    .summary { max-width: 720px; margin: 16px 0 0; color: #5d646b; font-size: 15px; line-height: 1.65; overflow-wrap: anywhere; }
    .actions { display: flex; align-items: center; gap: 10px; margin-top: 28px; }
    a { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; border-radius: 8px; padding: 0 14px; color: inherit; font-size: 13px; font-weight: 600; text-decoration: none; transition: transform 120ms ease, background 120ms ease; }
    a:hover { transform: translateY(-1px); }
    .primary { background: #171a1d; color: #fff; pointer-events: ${retrying ? 'none' : 'auto'}; opacity: ${retrying ? '.56' : '1'}; }
    .secondary { border: 1px solid #d7dce0; background: #fff; }
    .log-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; margin-top: 54px; padding-bottom: 10px; border-bottom: 1px solid #d9dde1; }
    .log-heading h2 { margin: 0; font-size: 13px; letter-spacing: -.01em; }
    .path { min-width: 0; overflow: hidden; color: #7a8188; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    pre { max-height: 310px; margin: 0; overflow: auto; padding: 18px 2px; color: #4d555c; font: 11px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    @media (prefers-reduced-motion: no-preference) { main { animation: enter 220ms ease-out both; } @keyframes enter { from { opacity: 0; transform: translateY(6px); } } }
    @media (prefers-color-scheme: dark) { body { background: #151719; color: #f0f2f3; } .summary, pre { color: #aeb4ba; } .secondary { border-color: #3b4045; background: #202326; } .primary { background: #f0f2f3; color: #151719; } .log-heading { border-color: #34383c; } }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow"><span class="dot"></span>Service unavailable</div>
    <h1>Harness could not start its local service.</h1>
    <p class="summary">${escapeHtml(message)}</p>
    <nav class="actions" aria-label="Recovery actions">
      <a class="primary" href="dsh-desktop://retry">${retrying ? 'Retrying…' : 'Retry service'}</a>
      <a class="secondary" href="dsh-desktop://open-log">Show log file</a>
    </nav>
    <section aria-labelledby="service-log">
      <div class="log-heading"><h2 id="service-log">Recent service output</h2><span class="path" title="${escapeHtml(logPath)}">${escapeHtml(logPath)}</span></div>
      <pre>${escapeHtml(logText)}</pre>
    </section>
  </main>
</body>
</html>`
}
