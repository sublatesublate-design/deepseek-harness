import type { ConversationSnapshot, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

function sessionSource(sessions: ISessions): HostObservable<ConversationSnapshot> | undefined {
  return sessions.currentProvideInfo.getSnapshot().hooks.session as HostObservable<ConversationSnapshot> | undefined
}

/**
 * Project the selected session's changing snapshot through one root-scoped observable.
 * @param sessions - runtime session service.
 * @returns an observable that switches its inner subscription with selection.
 */
export function currentPetSession(sessions: ISessions): HostObservable<ConversationSnapshot | undefined> {
  return {
    getSnapshot: () => sessionSource(sessions)?.getSnapshot(),
    subscribe(listener) {
      let offSession = sessionSource(sessions)?.subscribe(listener) ?? (() => {})
      const offCurrent = sessions.currentProvideInfo.subscribe(() => {
        offSession()
        offSession = sessionSource(sessions)?.subscribe(listener) ?? (() => {})
        listener()
      })
      return () => {
        offSession()
        offCurrent()
      }
    },
  }
}
