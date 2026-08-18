/**
 * Mount the native-window drag region when the web client runs inside the
 * desktop shell. The browser entry stays unchanged for ordinary URLs.
 */

const DESKTOP_PARAM = 'desktop'
const PLATFORM_PARAM = 'platform'

/** Add the desktop-only title bar once and mark the document for shell CSS. */
export function mountDesktopChrome(search = window.location.search): void {
  const params = new URLSearchParams(search)
  if (params.get(DESKTOP_PARAM) !== '1') return

  if (params.get('petOnly') === '1') {
    document.body.dataset.dshPetOnly = 'true'
    return
  }

  document.body.dataset.dshDesktop = 'true'
  const platform = params.get(PLATFORM_PARAM)
  if (platform !== null) document.body.dataset.dshDesktopPlatform = platform
  if (document.querySelector('[data-dsh-desktop-titlebar]') !== null) return

  const titlebar = document.createElement('header')
  titlebar.className = 'dsh-desktop-titlebar'
  titlebar.dataset.dshDesktopTitlebar = 'true'
  titlebar.setAttribute('aria-label', 'Application title bar')
  titlebar.innerHTML = `
    <div class="dsh-desktop-brand">
      <img src="/favicon.svg" alt="" width="17" height="17">
      <span>DeepSeek Desktop</span>
    </div>
    <span class="dsh-desktop-edition">Developer Preview</span>
  `
  document.body.prepend(titlebar)
}
