import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { PetEnvironmentSnapshot } from './environment.ts'

/** Browser facts injected into the root-scoped pet entry. */
export interface PetInjected {
  hooks: {
    petSession: HostObservable<ConversationSnapshot | undefined>
    petEnvironment: HostObservable<PetEnvironmentSnapshot>
  }
  /** Desktop-only bridge; browser profiles receive no-op callbacks. */
  desktopDrag: {
    begin: () => void
    move: () => void
    end: () => void
  }
}
