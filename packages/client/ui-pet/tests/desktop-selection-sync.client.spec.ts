// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installDesktopSelectionSync } from '../src/client/desktop-selection-sync.ts'

interface FakeChannel {
  readonly sent: unknown[]
  readonly listeners: Set<(event: MessageEvent<unknown>) => void>
  receive(value: unknown): void
  close: ReturnType<typeof vi.fn>
}

function channelClass() {
  const channels: FakeChannel[] = []
  class TestChannel implements FakeChannel {
    readonly sent: unknown[] = []
    readonly listeners = new Set<(event: MessageEvent<unknown>) => void>()
    readonly close = vi.fn()

    constructor() { channels.push(this) }
    postMessage(value: unknown): void { this.sent.push(value) }
    addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void { this.listeners.add(listener) }
    removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void { this.listeners.delete(listener) }
    receive(value: unknown): void {
      for (const listener of this.listeners) listener({ data: value } as MessageEvent<unknown>)
    }
  }
  return { TestChannel, channels }
}

function sessions() {
  let state = { current: undefined as string | undefined, byId: {} as Record<string, object> }
  const listeners = new Set<() => void>()
  return {
    list: {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
    open: vi.fn((id: string) => { state = { ...state, current: id } }),
    clear: vi.fn(() => { state = { ...state, current: undefined } }),
    set(next: typeof state) { state = next; for (const listener of listeners) listener() },
  }
}

afterEach(() => { vi.unstubAllGlobals() })

describe('desktop pet selection sync', () => {
  it('lets the pet renderer request and adopt the main window selection', () => {
    const { TestChannel, channels } = channelClass()
    vi.stubGlobal('BroadcastChannel', TestChannel)
    const pet = sessions()
    const off = installDesktopSelectionSync(pet as never, '?desktop=1&petOnly=1')
    const channel = channels[0]!
    expect(channel.sent).toEqual([{ kind: 'request' }])

    channel.receive({ kind: 'selection', sessionId: 'session-1' })
    expect(pet.open).not.toHaveBeenCalled()
    pet.set({ current: undefined, byId: { 'session-1': {} } })
    expect(pet.open).toHaveBeenCalledWith('session-1')
    off()
    expect(channel.close).toHaveBeenCalledOnce()
  })

  it('publishes current selection from the main renderer and ignores malformed input', () => {
    const { TestChannel, channels } = channelClass()
    vi.stubGlobal('BroadcastChannel', TestChannel)
    const main = sessions()
    main.set({ current: 'session-2', byId: { 'session-2': {} } })
    const off = installDesktopSelectionSync(main as never, '?desktop=1')
    const channel = channels[0]!
    expect(channel.sent).toContainEqual({ kind: 'selection', sessionId: 'session-2' })
    channel.receive({ kind: 'selection', sessionId: 42 })
    expect(main.open).not.toHaveBeenCalled()
    off()
  })
})
