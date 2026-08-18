import { describe, expect, it, vi } from 'vitest'
import { currentPetSession } from '../src/client/current-session.ts'

function observable<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    source: {
      getSnapshot: () => value,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    set(next: T) {
      value = next
      for (const listener of listeners) listener()
    },
    listeners,
  }
}

describe('current pet session', () => {
  it('switches the inner conversation subscription with the selected provide bundle', () => {
    const first = observable({ running: false })
    const second = observable({ running: true })
    const current = observable({ hooks: { session: first.source } })
    const source = currentPetSession({ currentProvideInfo: current.source } as never)
    const listener = vi.fn()
    const off = source.subscribe(listener)

    expect(source.getSnapshot()).toEqual({ running: false })
    first.set({ running: true })
    expect(listener).toHaveBeenCalledTimes(1)

    current.set({ hooks: { session: second.source } })
    expect(source.getSnapshot()).toEqual({ running: true })
    expect(first.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(1)

    off()
    expect(second.listeners.size).toBe(0)
  })

  it('uses an absent snapshot and no-op inner disposer when no session is current', () => {
    const current = observable({ hooks: {} })
    const source = currentPetSession({ currentProvideInfo: current.source } as never)
    const listener = vi.fn()
    const off = source.subscribe(listener)
    expect(source.getSnapshot()).toBeUndefined()
    current.set({ hooks: {} })
    expect(listener).toHaveBeenCalledOnce()
    off()
  })
})
