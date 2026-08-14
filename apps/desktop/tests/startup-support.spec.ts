import { describe, expect, it, vi } from 'vitest'
import {
  BoundedLog,
  describeReadiness,
  probeHarnessService,
  renderStartupFailure,
  renderStartupProgress,
  restoreWindowBounds,
} from '../src/startup-support.mjs'

function response(status: number, body = ''): Response {
  return new Response(status === 204 ? null : body, { status })
}

describe('desktop startup recovery support', () => {
  it('retains a bounded diagnostic tail', () => {
    const log = new BoundedLog(64)
    log.append('a'.repeat(80))
    expect(log.read()).toContain('earlier output omitted')
    expect(log.read()).not.toContain('a'.repeat(64))
    expect(log.read().length).toBeLessThanOrEqual(64)
  })

  it('renders a localized progress document before the service is ready', () => {
    const html = renderStartupProgress({ locale: 'zh-CN' })
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('DeepSeek Desktop')
    expect(html).toContain('正在准备工作区')
    expect(html).toContain('class="dot pulse"')
  })

  it('escapes diagnostics and keeps logs collapsed behind native recovery actions', () => {
    const html = renderStartupFailure({
      message: '<script>alert(1)</script>',
      logs: 'failure <details>',
      logPath: 'C:\\DeepSeek Desktop\\desktop.log',
      locale: 'zh-CN',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('dsh-desktop://retry')
    expect(html).toContain('dsh-desktop://open-log')
    expect(html).toContain('<details>')
    expect(html).not.toContain('<details open>')
  })

  it('requires the expected document and both sides of desktop authentication', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(200, '<title>DeepSeek Harness</title>'))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(401))

    await expect(probeHarnessService({
      origin: 'http://127.0.0.1:3081',
      controlToken: 'secret',
      request,
    })).resolves.toEqual({ kind: 'ready' })
    expect(request).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:3081/api/auth-probe', expect.objectContaining({
      headers: { 'x-dsh-control-token': 'secret' },
    }))
  })

  it.each([
    [response(503), { kind: 'http-error', status: 503 }],
    [response(200, '<title>Something else</title>'), { kind: 'unexpected-service' }],
  ])('classifies an incompatible home response', async (home, expected) => {
    await expect(probeHarnessService({
      origin: 'http://127.0.0.1:3081',
      controlToken: 'secret',
      request: vi.fn().mockResolvedValue(home),
    })).resolves.toEqual(expected)
  })

  it.each([
    [404, { kind: 'auth-missing' }],
    [403, { kind: 'auth-rejected', status: 403 }],
  ])('classifies an authorized probe response with status %i', async (status, expected) => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(200, '<title>DeepSeek Harness</title>'))
      .mockResolvedValueOnce(response(status))
    await expect(probeHarnessService({
      origin: 'http://127.0.0.1:3081',
      controlToken: 'secret',
      request,
    })).resolves.toEqual(expected)
  })

  it('rejects a service that accepts the anonymous authentication probe', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(200, '<title>DeepSeek Harness</title>'))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(204))
    const result = await probeHarnessService({
      origin: 'http://127.0.0.1:3081',
      controlToken: 'secret',
      request,
    })
    expect(result).toEqual({ kind: 'auth-not-enforced', status: 204 })
    expect(describeReadiness(result, 'zh-CN')).toContain('未认证')
  })

  it('classifies connection failures without exposing them as compatible services', async () => {
    await expect(probeHarnessService({
      origin: 'http://127.0.0.1:3081',
      request: vi.fn().mockRejectedValue(new Error('connection refused')),
    })).resolves.toEqual({ kind: 'unreachable', detail: 'connection refused' })
  })

  it('drops saved coordinates that no longer intersect a current display', () => {
    const workAreas = [{ x: 0, y: 0, width: 1920, height: 1080 }]
    expect(restoreWindowBounds({ width: 1200, height: 800, x: 140, y: 90 }, workAreas)).toEqual({
      width: 1200,
      height: 800,
      x: 140,
      y: 90,
    })
    expect(restoreWindowBounds({ width: 1200, height: 800, x: 4000, y: 90 }, workAreas)).toEqual({
      width: 1200,
      height: 800,
    })
  })
})
