// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { mountDesktopChrome } from '../src/desktop-chrome.ts'

afterEach(() => {
  document.body.replaceChildren()
  delete document.body.dataset.dshDesktop
  delete document.body.dataset.dshDesktopPlatform
})

describe('desktop chrome', () => {
  it('leaves an ordinary browser document unchanged', () => {
    mountDesktopChrome('')
    expect(document.body.dataset.dshDesktop).toBeUndefined()
    expect(document.querySelector('[data-dsh-desktop-titlebar]')).toBeNull()
  })

  it('mounts one platform-aware native drag region', () => {
    mountDesktopChrome('?desktop=1&platform=win32')
    mountDesktopChrome('?desktop=1&platform=win32')

    expect(document.body.dataset.dshDesktop).toBe('true')
    expect(document.body.dataset.dshDesktopPlatform).toBe('win32')
    expect(document.querySelectorAll('[data-dsh-desktop-titlebar]')).toHaveLength(1)
    expect(document.querySelector('.dsh-desktop-brand')?.textContent).toContain('DeepSeek Desktop')
    expect(document.querySelector('[data-dsh-desktop-titlebar]')?.outerHTML).toMatchInlineSnapshot(`
      "<header class="dsh-desktop-titlebar" data-dsh-desktop-titlebar="true" aria-label="Application title bar">
          <div class="dsh-desktop-brand">
            <img src="/favicon.svg" alt="" width="17" height="17">
            <span>DeepSeek Desktop</span>
          </div>
          <span class="dsh-desktop-edition">Developer Preview</span>
        </header>"
    `)
  })

  it('marks standalone desktop pet window without mounting titlebar', () => {
    mountDesktopChrome('?desktop=1&petOnly=1')
    expect(document.body.dataset.dshPetOnly).toBe('true')
    expect(document.body.dataset.dshDesktop).toBeUndefined()
    expect(document.querySelector('[data-dsh-desktop-titlebar]')).toBeNull()
  })
})
