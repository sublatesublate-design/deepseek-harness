import { describe, expect, it } from 'vitest'
import { petFrame, pointerDirection, sessionActivity } from '../src/client/pet-model.ts'

function session(overrides: Record<string, unknown> = {}) {
  return {
    removed: false,
    openState: 'open',
    promptError: null,
    lastAgentError: null,
    pending: [],
    running: false,
    ...overrides,
  } as never
}

describe('pet model', () => {
  it('uses failure, interaction, and running priority from session truth', () => {
    expect(sessionActivity(session({ running: true, pending: [{}], lastAgentError: 'failed' }), undefined)).toBe('failed')
    expect(sessionActivity(session({ removed: true }), undefined)).toBe('failed')
    expect(sessionActivity(session({ openState: 'error' }), undefined)).toBe('failed')
    expect(sessionActivity(session({ promptError: {} }), undefined)).toBe('failed')
    expect(sessionActivity(session({ running: true, pending: [{}] }), undefined)).toBe('waiting')
    expect(sessionActivity(session({ running: true }), undefined)).toBe('running')
    expect(sessionActivity(session(), undefined)).toBe('idle')
  })

  it('falls back to the selected list row while the session source is absent', () => {
    expect(sessionActivity(undefined, { running: true } as never)).toBe('running')
    expect(sessionActivity(undefined, { running: false, pendingInteraction: {} } as never)).toBe('waiting')
  })

  it('maps cardinal pointer vectors to the sixteen clockwise cells', () => {
    expect(pointerDirection(0, -10)).toBe(0)
    expect(pointerDirection(10, 0)).toBe(4)
    expect(pointerDirection(0, 10)).toBe(8)
    expect(pointerDirection(-10, 0)).toBe(12)
    expect(petFrame('idle', 0)).toMatchObject({ row: 9, column: 0, frames: 1 })
    expect(petFrame('idle', 15)).toMatchObject({ row: 10, column: 7, frames: 1 })
  })

  it('describes every standard atlas row without addressing unused cells', () => {
    expect(petFrame('idle')).toMatchObject({ row: 0, frames: 7 })
    expect(petFrame('waving')).toMatchObject({ row: 3, frames: 4 })
    expect(petFrame('jumping')).toMatchObject({ row: 4, frames: 5 })
    expect(petFrame('waiting')).toMatchObject({ row: 6, frames: 6 })
    expect(petFrame('review')).toMatchObject({ row: 8, frames: 6 })
  })
})
