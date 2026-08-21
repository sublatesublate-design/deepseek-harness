/** Main-renderer navigation policy for the desktop shell. */

/**
 * Apply the main-window navigation policy.
 * @param {{ preventDefault(): void }} event - Electron navigation event.
 * @param {string} url - Requested destination.
 * @param {{
 *   origin: string,
 *   retry(): void,
 *   openLog(): void,
 *   openExternal(url: string): void,
 * }} actions - Trusted origin and native actions.
 * @returns {void}
 */
export function handleDesktopNavigation(event, url, actions) {
  if (url === 'dsh-desktop://retry') {
    event.preventDefault()
    actions.retry()
    return
  }
  if (url === 'dsh-desktop://open-log') {
    event.preventDefault()
    actions.openLog()
    return
  }

  let target
  try {
    target = new URL(url)
  } catch (_malformedNavigationUrl) {
    event.preventDefault()
    return
  }
  if (target.origin === actions.origin) return

  event.preventDefault()
  if (target.protocol === 'http:' || target.protocol === 'https:') {
    actions.openExternal(target.href)
  }
}
