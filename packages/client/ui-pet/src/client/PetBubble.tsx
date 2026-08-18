import css from './PetBubble.module.css'

export interface PetBubbleProps {
  readonly text: string
  readonly active?: boolean
}

/**
 * Speech bubble rendered above the whale pet to broadcast DeepSeek agent status in real time.
 * @param props - rendered text and active pulse indicator.
 * @returns speech bubble element.
 */
export function PetBubble({ text, active }: PetBubbleProps) {
  if (!text) return null

  return (
    <div className={css.bubble} role="status" aria-live="polite">
      <span className={css.text}>{text}</span>
      {active ? <span className={css.pulse} aria-hidden /> : null}
      <span className={css.tailBorder} aria-hidden />
      <span className={css.tail} aria-hidden />
    </div>
  )
}
