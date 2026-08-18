// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeepSeekWhale, type DeepSeekWhaleProps } from '../src/client/DeepSeekWhale.tsx'

function hook<T>(value: T) {
  return (selector: (snapshot: T) => unknown) => selector(value)
}

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    removed: false,
    openState: 'open',
    promptError: null,
    lastAgentError: null,
    pending: [],
    running: false,
    ...overrides,
  }
}

function environment(overrides: Record<string, unknown> = {}) {
  return {
    pointer: null,
    width: window.innerWidth,
    height: window.innerHeight,
    reducedMotion: false,
    ...overrides,
  }
}

function props(
  session = conversation(),
  summary: Record<string, unknown> | undefined = { running: false },
  petEnvironment = environment(),
  desktopDrag = { begin: vi.fn(), move: vi.fn(), end: vi.fn() },
): DeepSeekWhaleProps {
  return {
    usePetSession: hook(session),
    usePetEnvironment: hook(petEnvironment),
    useSessions: hook(summary === undefined
      ? { current: undefined, byId: {} }
      : { current: 'session', byId: { session: summary } }),
    desktopDrag,
    t: (key: string, params?: Record<string, unknown>) => key === 'label'
      ? `whale: ${String(params?.state)}`
      : `${key}${params === undefined ? '' : ` ${Object.values(params).join(' ')}`}`,
  } as unknown as DeepSeekWhaleProps
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DeepSeek whale', () => {
  it('renders authoritative running and waiting states ahead of the greeting gesture', () => {
    const running = render(<DeepSeekWhale {...props(conversation({ running: true }))} />)
    expect(running.getByRole('button').dataset.petState).toBe('running')
    running.unmount()

    const waiting = render(<DeepSeekWhale {...props(conversation({ running: true, pending: [{}] }))} />)
    expect(waiting.getByRole('button').dataset.petState).toBe('waiting')
  })

  it('keeps the running state while the whale is dragged', () => {
    const view = render(<DeepSeekWhale {...props(conversation({ running: true }))} />)
    const pet = view.getByRole('button') as HTMLButtonElement & {
      setPointerCapture(pointerId: number): void
      hasPointerCapture(pointerId: number): boolean
      releasePointerCapture(pointerId: number): void
    }
    let captured: number | undefined
    pet.setPointerCapture = (pointerId) => { captured = pointerId }
    pet.hasPointerCapture = pointerId => captured === pointerId
    pet.releasePointerCapture = () => { captured = undefined }

    fireEvent.pointerDown(pet, { pointerId: 7, clientX: 500, clientY: 400 })
    fireEvent.pointerMove(pet, { pointerId: 7, clientX: 540, clientY: 400 })
    expect(pet.dataset.petState).toBe('running')
  })

  it('waves on mount, looks at a nearby pointer, and jumps when clicked', () => {
    const view = render(<DeepSeekWhale {...props()} />)
    const pet = view.getByRole('button')
    expect(pet.dataset.petState).toBe('waving')

    act(() => { vi.advanceTimersByTime(1_300) })
    view.rerender(<DeepSeekWhale {...props(
      conversation(),
      { running: false },
      environment({ pointer: { x: window.innerWidth - 60, y: window.innerHeight - 260 } }),
    )} />)
    expect(pet.dataset.petState).toBe('look')

    fireEvent.click(pet)
    expect(pet.dataset.petState).toBe('jumping')
    fireEvent.click(pet)
    act(() => { vi.advanceTimersByTime(900) })
    expect(pet.dataset.petState).toBe('look')
  })

  it('uses directional travel rows while dragging and clamps its position', () => {
    const view = render(<DeepSeekWhale {...props()} />)
    const pet = view.getByRole('button') as HTMLButtonElement & {
      setPointerCapture(pointerId: number): void
      hasPointerCapture(pointerId: number): boolean
      releasePointerCapture(pointerId: number): void
    }
    let captured: number | undefined
    pet.setPointerCapture = (pointerId) => { captured = pointerId }
    pet.hasPointerCapture = pointerId => captured === pointerId
    pet.releasePointerCapture = () => { captured = undefined }

    fireEvent.pointerMove(pet, { pointerId: 4, clientX: 900, clientY: 600 })
    fireEvent.pointerDown(pet, { pointerId: 4, clientX: 900, clientY: 600 })
    fireEvent.pointerMove(pet, { pointerId: 4, clientX: 900, clientY: 600 })
    fireEvent.pointerMove(pet, { pointerId: 4, clientX: 940, clientY: 620 })
    expect(pet.dataset.petState).toBe('running-right')
    expect(Number.parseFloat(pet.style.left)).toBeLessThanOrEqual(window.innerWidth - 136)

    fireEvent.pointerMove(pet, { pointerId: 4, clientX: 880, clientY: 620 })
    expect(pet.dataset.petState).toBe('running-left')
    fireEvent.pointerUp(pet, { pointerId: 4, clientX: 880, clientY: 620 })
    expect(pet.dataset.petState).toBe('waving')
    fireEvent.pointerUp(pet, { pointerId: 4, clientX: 880, clientY: 620 })
    fireEvent.click(pet)
  })

  it('delegates standalone-window drag lifecycle to the desktop bridge', () => {
    const desktopDrag = { begin: vi.fn(), move: vi.fn(), end: vi.fn() }
    const view = render(<DeepSeekWhale {...props(conversation(), { running: false }, environment(), desktopDrag)} />)
    const pet = view.getByRole('button') as HTMLButtonElement & {
      setPointerCapture(pointerId: number): void
      hasPointerCapture(pointerId: number): boolean
      releasePointerCapture(pointerId: number): void
    }
    let captured: number | undefined
    pet.setPointerCapture = (pointerId) => { captured = pointerId }
    pet.hasPointerCapture = pointerId => captured === pointerId
    pet.releasePointerCapture = () => { captured = undefined }

    fireEvent.pointerDown(pet, { pointerId: 8, clientX: 500, clientY: 400 })
    fireEvent.pointerMove(pet, { pointerId: 8, clientX: 540, clientY: 420 })
    fireEvent.pointerUp(pet, { pointerId: 8, clientX: 540, clientY: 420 })
    expect(desktopDrag.begin).toHaveBeenCalledOnce()
    expect(desktopDrag.move).toHaveBeenCalledOnce()
    expect(desktopDrag.end).toHaveBeenCalledOnce()
  })

  it('shows review after work settles and completes its non-looping failure row', () => {
    const view = render(<DeepSeekWhale {...props(conversation({ running: true }))} />)
    const pet = view.getByRole('button')
    act(() => { vi.advanceTimersByTime(1_300) })
    view.rerender(<DeepSeekWhale {...props(
      conversation(),
      { running: false },
      environment({ pointer: { x: window.innerWidth - 60, y: window.innerHeight - 260 } }),
    )} />)
    expect(pet.dataset.petState).toBe('review')
    act(() => { vi.advanceTimersByTime(1_800) })
    expect(pet.dataset.petState).toBe('look')

    view.rerender(<DeepSeekWhale {...props(conversation({ lastAgentError: 'boom' }))} />)
    expect(pet.dataset.petState).toBe('failed')
    act(() => { vi.advanceTimersByTime(4_000) })
    expect(pet.dataset.petFrame).toBe('7')
    fireEvent.click(pet)
    expect(pet.dataset.petState).toBe('failed')
  })

  it('keeps a reduced-motion idle frame and handles absent selection plus distant pointers', () => {
    const view = render(<DeepSeekWhale {...props(
      conversation(),
      undefined,
      environment({ reducedMotion: true, pointer: { x: 0, y: 0 } }),
    )} />)
    const pet = view.getByRole('button')
    act(() => { vi.advanceTimersByTime(1_300) })
    expect(pet.dataset.petState).toBe('idle')
    expect(pet.dataset.petFrame).toBe('0')

    view.rerender(<DeepSeekWhale {...({
      ...props(conversation(), undefined, environment({ reducedMotion: true })),
      useSessions: hook({ current: undefined, byId: {} }),
    } as unknown as DeepSeekWhaleProps)} />)
    expect(pet.dataset.petState).toBe('idle')

    view.rerender(<DeepSeekWhale {...({
      ...props(conversation(), undefined, environment({ reducedMotion: true })),
      useSessions: hook({ current: 'missing', byId: {} }),
    } as unknown as DeepSeekWhaleProps)} />)
    expect(pet.dataset.petState).toBe('idle')
  })

  it('clears active review and jump timers when the component unmounts', () => {
    const review = render(<DeepSeekWhale {...props(conversation({ running: true }))} />)
    review.rerender(<DeepSeekWhale {...props()} />)
    expect(review.getByRole('button').dataset.petState).toBe('review')
    review.unmount()

    const jumping = render(<DeepSeekWhale {...props()} />)
    act(() => { vi.advanceTimersByTime(1_300) })
    fireEvent.click(jumping.getByRole('button'))
    jumping.unmount()
  })

  it('renders speech bubbles for tool calls, thinking, and errors in real time', () => {
    const reading = render(<DeepSeekWhale {...props(conversation({
      running: true,
      runningCalls: [{ name: 'view_file', argsRaw: JSON.stringify({ TargetFile: 'src/main.ts' }) }],
    }))} />)
    expect(reading.getByRole('status').textContent).toContain('main.ts')
    reading.unmount()

    const writing = render(<DeepSeekWhale {...props(conversation({
      running: true,
      runningCalls: [{ name: 'write_to_file', argsRaw: JSON.stringify({ TargetFile: 'Pet.tsx' }) }],
    }))} />)
    expect(writing.getByRole('status').textContent).toContain('Pet.tsx')
    writing.unmount()

    const command = render(<DeepSeekWhale {...props(conversation({
      running: true,
      runningCalls: [{ name: 'run_command', argsRaw: JSON.stringify({ CommandLine: 'pnpm test' }) }],
    }))} />)
    expect(command.getByRole('status').textContent).toContain('pnpm test')
    command.unmount()

    const git = render(<DeepSeekWhale {...props(conversation({
      running: true,
      runningCalls: [{ name: 'git_status' }],
    }))} />)
    expect(git.getByRole('status').textContent).toContain('speech.tool.git')
    git.unmount()

    const thinking = render(<DeepSeekWhale {...props(conversation({
      running: true,
      partial: { blocks: [{ kind: 'reasoning', text: 'analyzing project structure' }] },
    }))} />)
    expect(thinking.getByRole('status').textContent).toContain('speech.thinking')
    expect(thinking.getByRole('status').textContent).not.toContain('analyzing project structure')
    thinking.unmount()

    const textStream = render(<DeepSeekWhale {...props(conversation({
      running: true,
      partial: { blocks: [{ kind: 'text', text: 'writing response code' }] },
    }))} />)
    expect(textStream.getByRole('status').textContent).toContain('writing response code')
    textStream.unmount()

    const err = render(<DeepSeekWhale {...props(conversation({
      lastAgentError: 'something broke',
    }))} />)
    expect(err.getByRole('status').textContent).toContain('something broke')
    err.unmount()
  })
})
