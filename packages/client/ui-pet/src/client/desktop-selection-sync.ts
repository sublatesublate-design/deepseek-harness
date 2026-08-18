import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'

const CHANNEL_NAME = 'dsh-desktop-pet-selection'

interface SelectionMessage {
  kind: 'request' | 'selection'
  sessionId?: unknown
}

function isSelectionMessage(value: unknown): value is SelectionMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return message.kind === 'request' || message.kind === 'selection'
}

function isPetOnly(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('desktop') === '1' && params.get('petOnly') === '1'
}

/**
 * Synchronize the selected session between the desktop's main and pet renderers.
 * The pet renderer keeps its own live Session object; only the selection crosses
 * the window boundary, so subsequent stream updates remain authoritative.
 * @param sessions - renderer-local session service.
 * @param search - location query used to identify desktop windows.
 * @returns disposer for the channel and session-list subscription.
 */
export function installDesktopSelectionSync(
  sessions: ISessions,
  search = window.location.search,
): () => void {
  const params = new URLSearchParams(search)
  if (params.get('desktop') !== '1' || typeof BroadcastChannel === 'undefined') return () => {}

  const petOnly = isPetOnly(search)
  const channel = new BroadcastChannel(CHANNEL_NAME)
  let pending: string | null | undefined

  const publish = (): void => {
    if (petOnly) return
    const current = sessions.list.getSnapshot().current
    channel.postMessage({ kind: 'selection', sessionId: current })
  }

  const reconcile = (): void => {
    if (!petOnly || pending === undefined) return
    if (pending === null) {
      if (sessions.list.getSnapshot().current !== undefined) sessions.clear()
      pending = undefined
      return
    }
    const state = sessions.list.getSnapshot()
    const candidate = pending as Parameters<ISessions['open']>[0]
    if (state.byId[candidate] === undefined) return
    if (state.current !== candidate) sessions.open(candidate)
    pending = undefined
  }

  const onMessage = (event: MessageEvent<unknown>): void => {
    if (!isSelectionMessage(event.data)) return
    if (event.data.kind === 'request') {
      publish()
      return
    }
    if (!petOnly) return
    if (event.data.sessionId === undefined) pending = null
    else if (typeof event.data.sessionId === 'string') pending = event.data.sessionId
    else return
    reconcile()
  }

  channel.addEventListener('message', onMessage)
  const offList = sessions.list.subscribe(() => {
    if (petOnly) reconcile()
    else publish()
  })

  if (petOnly) channel.postMessage({ kind: 'request' })
  else publish()

  return () => {
    offList()
    channel.removeEventListener('message', onMessage)
    channel.close()
  }
}
