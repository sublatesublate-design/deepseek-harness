/** DeepSeek whale pet browser plugin. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { PetInjected } from './contract.ts'
import { currentPetSession } from './current-session.ts'
import { installDesktopSelectionSync } from './desktop-selection-sync.ts'
import { DeepSeekWhale } from './DeepSeekWhale.tsx'
import { petEnvironment } from './environment.ts'
import { en, NS, zh } from './locales.ts'

/** Required services for the global overlay and selected-session projection. */
export const inject = ['slots', 'sessions', 'locale']

const NOOP_DRAG: PetInjected['desktopDrag'] = {
  begin: () => {},
  move: () => {},
  end: () => {},
}

function desktopDragBridge(): PetInjected['desktopDrag'] {
  const bridge = (globalThis as typeof globalThis & {
    dshDesktopPet?: PetInjected['desktopDrag']
  }).dshDesktopPet
  return bridge ?? NOOP_DRAG
}

/** Register the pet dictionaries and the additive shell overlay entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-pet: dictionaries')
  ctx.effect(() => installDesktopSelectionSync(ctx.sessions), 'ui-pet: desktop selection sync')
  const petSession = currentPetSession(ctx.sessions)
  const environment = petEnvironment()
  const desktopDrag = desktopDragBridge()
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'deepseek-whale',
    order: 90,
    locale: NS,
    inject: (): PetInjected => ({
      hooks: { petSession, petEnvironment: environment },
      desktopDrag,
    }),
  }, DeepSeekWhale))
}
