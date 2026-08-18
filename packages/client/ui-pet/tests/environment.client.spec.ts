// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { petEnvironment } from '../src/client/environment.ts'

describe('pet environment', () => {
  it('publishes pointer, viewport, and motion changes only while observed', () => {
    let motionListener: (() => void) | undefined
    let reduced = false
    const removeMotion = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        get matches() { return reduced },
        addEventListener: (_type: string, listener: () => void) => { motionListener = listener },
        removeEventListener: removeMotion,
      }),
    })
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 600 })
    const environment = petEnvironment()
    expect(environment.getSnapshot()).toEqual({
      pointer: null,
      width: 800,
      height: 600,
      reducedMotion: false,
    })

    const first = vi.fn()
    const second = vi.fn()
    const offFirst = environment.subscribe(first)
    const offSecond = environment.subscribe(second)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 70 }))
    expect(environment.getSnapshot().pointer).toEqual({ x: 40, y: 70 })

    window.innerWidth = 640
    window.innerHeight = 480
    window.dispatchEvent(new Event('resize'))
    expect(environment.getSnapshot()).toMatchObject({ width: 640, height: 480 })

    reduced = true
    motionListener?.()
    expect(environment.getSnapshot().reducedMotion).toBe(true)
    expect(first).toHaveBeenCalledTimes(3)
    expect(second).toHaveBeenCalledTimes(3)

    offFirst()
    expect(removeMotion).not.toHaveBeenCalled()
    offSecond()
    expect(removeMotion).toHaveBeenCalledOnce()
  })
})
