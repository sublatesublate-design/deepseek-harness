import { describe, expect, it } from 'vitest'
import { BoundedLog, renderStartupFailure } from '../src/startup-support.mjs'

describe('desktop startup recovery support', () => {
  it('retains a bounded diagnostic tail', () => {
    const log = new BoundedLog(64)
    log.append('a'.repeat(80))
    expect(log.read()).toContain('earlier output omitted')
    expect(log.read()).not.toContain('a'.repeat(64))
    expect(log.read().length).toBeLessThanOrEqual(64)
  })

  it('escapes diagnostics and exposes only native recovery actions', () => {
    const html = renderStartupFailure({
      message: '<script>alert(1)</script>',
      logs: 'failure <details>',
      logPath: 'C:\\Harness\\desktop.log',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('dsh-desktop://retry')
    expect(html).toContain('dsh-desktop://open-log')
  })
})
