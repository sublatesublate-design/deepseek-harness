import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/** Browser-space coordinate used for pointer and pet placement. */
export interface Point {
  readonly x: number
  readonly y: number
}

/** Browser facts that affect pet presentation. */
export interface PetEnvironmentSnapshot {
  readonly pointer: Point | null
  readonly width: number
  readonly height: number
  readonly reducedMotion: boolean
}

/**
 * Build the pet's registrant-private browser observable.
 * @returns one identity-stable source for pointer, viewport, and motion preference.
 */
export function petEnvironment(): HostObservable<PetEnvironmentSnapshot> {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let snapshot: PetEnvironmentSnapshot = {
    pointer: null,
    width: window.innerWidth,
    height: window.innerHeight,
    reducedMotion: media.matches,
  }
  const listeners = new Set<() => void>()
  let detach: (() => void) | undefined

  const publish = (next: PetEnvironmentSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const attach = (): (() => void) => {
    const onPointerMove = (event: PointerEvent): void => {
      publish({ ...snapshot, pointer: { x: event.clientX, y: event.clientY } })
    }
    const onResize = (): void => {
      publish({ ...snapshot, width: window.innerWidth, height: window.innerHeight })
    }
    const onMotion = (): void => {
      publish({ ...snapshot, reducedMotion: media.matches })
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('resize', onResize)
    media.addEventListener('change', onMotion)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
      media.removeEventListener('change', onMotion)
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      detach ??= attach()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          detach?.()
          detach = undefined
        }
      }
    },
  }
}
