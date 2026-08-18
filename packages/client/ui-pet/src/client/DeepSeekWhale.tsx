import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import atlas from './assets/deepseek-whale.webp'
import type { PetInjected } from './contract.ts'
import type { PetEnvironmentSnapshot, Point } from './environment.ts'
import type { PetKey } from './locales.ts'
import { petFrame, pointerDirection, sessionActivity, type PetActivity } from './pet-model.ts'
import { PetBubble } from './PetBubble.tsx'
import { resolvePetSpeech } from './pet-speech.ts'
import css from './DeepSeekWhale.module.css'

/** Full props supplied by the shell overlay and pet session source. */
export type DeepSeekWhaleProps = PropsRuntime<'shell.overlay'> & InjectFace<PetInjected> & PropsLocale<'pet'>

const PET_WIDTH = 120
const PET_HEIGHT = 130
const EDGE = 16
const LOOK_DISTANCE = 360

function clampPoint(point: Point, viewport: Pick<PetEnvironmentSnapshot, 'width' | 'height'>): Point {
  return {
    x: Math.min(Math.max(EDGE, point.x), Math.max(EDGE, viewport.width - PET_WIDTH - EDGE)),
    y: Math.min(Math.max(EDGE, point.y), Math.max(EDGE, viewport.height - PET_HEIGHT - EDGE)),
  }
}

function initialPoint(viewport: Pick<PetEnvironmentSnapshot, 'width' | 'height'>): Point {
  return clampPoint({ x: viewport.width - PET_WIDTH - 28, y: viewport.height - PET_HEIGHT - 24 }, viewport)
}

const STATE_KEYS = {
  idle: 'state.idle',
  'running-right': 'state.runningRight',
  'running-left': 'state.runningLeft',
  waving: 'state.waving',
  jumping: 'state.jumping',
  failed: 'state.failed',
  waiting: 'state.waiting',
  running: 'state.running',
  review: 'state.review',
} as const satisfies Record<PetActivity, PetKey>

/** Render the draggable DeepSeek whale and map Harness session truth to the v2 atlas. */
export function DeepSeekWhale({ useSessions, usePetSession, usePetEnvironment, desktopDrag, t }: DeepSeekWhaleProps) {
  const session = usePetSession(snapshot => snapshot)
  const environment = usePetEnvironment(snapshot => snapshot)
  const summary = useSessions((state) => {
    const current = state.current
    if (current === undefined) return undefined
    return state.byId[current]
  })
  const steady = sessionActivity(session, summary)
  const [position, setPosition] = useState(() => initialPoint(environment))
  const [gesture, setGesture] = useState<Extract<PetActivity, 'waving' | 'jumping'> | null>('waving')
  const [reviewing, setReviewing] = useState(false)
  const [dragDirection, setDragDirection] = useState<Extract<PetActivity, 'running-left' | 'running-right'> | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const previousSteady = useRef(steady)
  const dragOffset = useRef<Point>({ x: 0, y: 0 })
  const lastDragX = useRef(0)
  const dragged = useRef(false)
  const gestureTimer = useRef<number | null>(null)
  const visiblePosition = clampPoint(position, environment)

  useEffect(() => {
    const timer = window.setTimeout(() => { setGesture(null) }, 1_300)
    return () => { window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (previousSteady.current === 'running' && steady === 'idle') {
      setReviewing(true)
      const timer = window.setTimeout(() => { setReviewing(false) }, 1_800)
      previousSteady.current = steady
      return () => { window.clearTimeout(timer) }
    }
    previousSteady.current = steady
  }, [steady])

  const direction = useMemo(() => {
    const pointer = environment.pointer
    if (pointer === null || steady !== 'idle' || gesture !== null || reviewing || dragDirection !== null) return undefined
    const dx = pointer.x - (visiblePosition.x + PET_WIDTH / 2)
    const dy = pointer.y - (visiblePosition.y + PET_HEIGHT / 2)
    const distance = Math.hypot(dx, dy)
    return distance >= 42 && distance <= LOOK_DISTANCE ? pointerDirection(dx, dy) : undefined
  }, [dragDirection, environment.pointer, gesture, reviewing, steady, visiblePosition.x, visiblePosition.y])

  const activity: PetActivity = steady === 'failed' || steady === 'waiting' || steady === 'running'
    ? steady
    : dragDirection ?? (reviewing ? 'review' : gesture ?? 'idle')
  const frame = petFrame(activity, direction)

  useEffect(() => {
    setFrameIndex(0)
    if (environment.reducedMotion || frame.frames < 2) return
    const timer = window.setInterval(() => {
      setFrameIndex(current => frame.loop
        ? (current + 1) % frame.frames
        : Math.min(current + 1, frame.frames - 1))
    }, frame.intervalMs)
    return () => { window.clearInterval(timer) }
  }, [environment.reducedMotion, frame.frames, frame.intervalMs, frame.loop, frame.row])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    desktopDrag.begin()
    dragOffset.current = { x: event.clientX - visiblePosition.x, y: event.clientY - visiblePosition.y }
    lastDragX.current = event.clientX
    dragged.current = false
  }, [desktopDrag, visiblePosition.x, visiblePosition.y])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    desktopDrag.move()
    const deltaX = event.clientX - lastDragX.current
    if (Math.abs(deltaX) > 1) setDragDirection(deltaX < 0 ? 'running-left' : 'running-right')
    lastDragX.current = event.clientX
    dragged.current = true
    setPosition(clampPoint({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    }, environment))
  }, [desktopDrag, environment])

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    desktopDrag.end()
    setDragDirection(null)
  }, [desktopDrag])

  const onClick = useCallback(() => {
    if (dragged.current || steady !== 'idle') {
      dragged.current = false
      return
    }
    if (gestureTimer.current !== null) window.clearTimeout(gestureTimer.current)
    setGesture('jumping')
    gestureTimer.current = window.setTimeout(() => {
      gestureTimer.current = null
      setGesture(null)
    }, 900)
  }, [steady])

  useEffect(() => () => {
    if (gestureTimer.current !== null) window.clearTimeout(gestureTimer.current)
  }, [])

  const column = frame.column + frameIndex
  const looking = direction !== undefined
  const label = t('label', { state: t(looking ? 'state.looking' : STATE_KEYS[activity]) })
  const speech = resolvePetSpeech(session, summary, activity, reviewing)
  const speechText = speech.rawText ?? t(speech.key, speech.params)
  const style = {
    left: visiblePosition.x,
    top: visiblePosition.y,
    '--pet-atlas': `url(${JSON.stringify(atlas)})`,
    '--pet-x': `${column * 100 / 7}%`,
    '--pet-y': `${frame.row * 10}%`,
  } as CSSProperties

  return (
    <button
      type="button"
      className={css.pet}
      style={style}
      aria-label={label}
      title={label}
      data-pet-embedded="true"
      data-pet-state={looking ? 'look' : activity}
      data-pet-direction={direction}
      data-pet-frame={frameIndex}
      data-dragging={dragDirection !== null || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <PetBubble text={speechText} active={steady === 'running'} />
      <span className={css.sprite} aria-hidden />
    </button>
  )
}
