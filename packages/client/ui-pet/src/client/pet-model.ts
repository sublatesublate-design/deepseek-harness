import type { ConversationSnapshot, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'

/** The nine atlas animation states carried by the pet. */
export type PetActivity =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'

/** A rendered atlas frame, including the sixteen pointer directions. */
export interface PetFrame {
  readonly row: number
  readonly column: number
  readonly frames: number
  readonly intervalMs: number
  readonly loop: boolean
}

const ACTIVITY_FRAMES = {
  idle: { row: 0, frames: 7, intervalMs: 220, loop: true },
  'running-right': { row: 1, frames: 8, intervalMs: 100, loop: true },
  'running-left': { row: 2, frames: 8, intervalMs: 100, loop: true },
  waving: { row: 3, frames: 4, intervalMs: 180, loop: true },
  jumping: { row: 4, frames: 5, intervalMs: 140, loop: true },
  failed: { row: 5, frames: 8, intervalMs: 240, loop: false },
  waiting: { row: 6, frames: 6, intervalMs: 220, loop: true },
  running: { row: 7, frames: 6, intervalMs: 150, loop: true },
  review: { row: 8, frames: 6, intervalMs: 220, loop: true },
} as const satisfies Record<PetActivity, Omit<PetFrame, 'column'>>

/**
 * Resolve the authoritative session-driven animation with error and interaction priority.
 * @param session - selected conversation snapshot, when materialized.
 * @param summary - selected list row, which remains available during session materialization.
 * @returns the stable activity before local pointer gestures are applied.
 */
export function sessionActivity(
  session: ConversationSnapshot | undefined,
  summary: SessionSummary | undefined,
): Extract<PetActivity, 'idle' | 'failed' | 'waiting' | 'running'> {
  if (session?.removed === true
    || session?.openState === 'error'
    || session?.promptError !== null && session?.promptError !== undefined
    || session?.lastAgentError !== null && session?.lastAgentError !== undefined) return 'failed'
  if ((session?.pending.length ?? 0) > 0 || summary?.pendingInteraction !== undefined) return 'waiting'
  if (session?.running === true || summary?.running === true) return 'running'
  return 'idle'
}

/**
 * Convert a pointer vector into the atlas's clockwise 22.5-degree direction index.
 * Zero is up, four is right, eight is down, and twelve is left.
 * @param dx - horizontal pointer offset from the pet center.
 * @param dy - vertical pointer offset from the pet center.
 * @returns an integer in [0, 15].
 */
export function pointerDirection(dx: number, dy: number): number {
  const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
  return Math.round(degrees / 22.5) % 16
}

/**
 * Resolve one animation or directional frame description.
 * @param activity - ordinary animation state.
 * @param direction - optional pointer direction in [0, 15].
 * @returns atlas row, starting column, frame count, cadence, and looping policy.
 */
export function petFrame(activity: PetActivity, direction?: number): PetFrame {
  if (direction !== undefined) {
    const normalized = ((Math.trunc(direction) % 16) + 16) % 16
    return {
      row: normalized < 8 ? 9 : 10,
      column: normalized < 8 ? normalized : normalized - 8,
      frames: 1,
      intervalMs: 0,
      loop: false,
    }
  }
  return { ...ACTIVITY_FRAMES[activity], column: 0 }
}
