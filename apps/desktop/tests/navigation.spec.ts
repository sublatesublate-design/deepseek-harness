import { describe, expect, it, vi } from 'vitest'
import { handleDesktopNavigation } from '../src/navigation-policy.mjs'

function runNavigation(url: string) {
  const retry = vi.fn()
  const openLog = vi.fn()
  const openExternal = vi.fn()
  const event = { preventDefault: vi.fn() }
  handleDesktopNavigation(event, url, {
    origin: 'http://127.0.0.1:3081',
    retry,
    openLog,
    openExternal,
  })
  return { event, retry, openLog, openExternal }
}

describe('Electron main-window navigation policy', () => {
  it.each([
    'http://127.0.0.1:3081/',
    'http://127.0.0.1:3081/?desktop=1',
    'http://127.0.0.1:3081/api/auth-probe',
  ])('allows the trusted origin: %s', (url) => {
    const result = runNavigation(url)
    expect(result.event.preventDefault).not.toHaveBeenCalled()
    expect(result.openExternal).not.toHaveBeenCalled()
  })

  it.each([
    ['http://127.0.0.1:3081.evil.example/', undefined],
    ['file:///etc/passwd', undefined],
    ['data:text/html,hi', undefined],
    ['not a URL', undefined],
    ['http://127.0.0.1:3081@evil.example/', 'http://127.0.0.1:3081@evil.example/'],
    ['https://evil.com/', 'https://evil.com/'],
    ['http://evil.com/', 'http://evil.com/'],
  ])('denies an untrusted destination: %s', (url, external) => {
    const result = runNavigation(url)
    expect(result.event.preventDefault).toHaveBeenCalledOnce()
    if (external === undefined) {
      expect(result.openExternal).not.toHaveBeenCalled()
    } else {
      expect(result.openExternal).toHaveBeenCalledWith(external)
    }
  })

  it('dispatches only the exact native recovery URLs', () => {
    const retry = runNavigation('dsh-desktop://retry')
    expect(retry.event.preventDefault).toHaveBeenCalledOnce()
    expect(retry.retry).toHaveBeenCalledOnce()
    expect(retry.openLog).not.toHaveBeenCalled()

    const openLog = runNavigation('dsh-desktop://open-log')
    expect(openLog.event.preventDefault).toHaveBeenCalledOnce()
    expect(openLog.openLog).toHaveBeenCalledOnce()
    expect(openLog.retry).not.toHaveBeenCalled()

    const nearMiss = runNavigation('dsh-desktop://retry/')
    expect(nearMiss.event.preventDefault).toHaveBeenCalledOnce()
    expect(nearMiss.retry).not.toHaveBeenCalled()
    expect(nearMiss.openExternal).not.toHaveBeenCalled()
  })
})
