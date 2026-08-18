import type { ConversationSnapshot, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { PetActivity } from './pet-model.ts'
import type { PetKey } from './locales.ts'

/** Localized speech selection and its optional bounded live-text fallback. */
export interface ResolvedSpeech {
  key: PetKey
  params?: Record<string, unknown> | undefined
  rawText?: string | undefined
}

/** Safely extract human-readable tool target details (file name, command, query). */
function extractToolTarget(argsRaw: string): string | null {
  try {
    const parsed = JSON.parse(argsRaw) as Record<string, unknown>
    if (typeof parsed === 'object' && parsed !== null) {
      const file = parsed.TargetFile ?? parsed.AbsolutePath ?? parsed.SearchPath ?? parsed.DirectoryPath ?? parsed.file ?? parsed.path
      if (typeof file === 'string') {
        const normalized = file.replace(/\\/g, '/')
        const parts = normalized.split('/')
        return parts[parts.length - 1] || file
      }
      const cmd = parsed.CommandLine ?? parsed.command ?? parsed.cmd
      if (typeof cmd === 'string') {
        const trimmed = cmd.trim()
        return trimmed.length > 28 ? `${trimmed.slice(0, 25)}...` : trimmed
      }
      const query = parsed.Query ?? parsed.query
      if (typeof query === 'string') {
        const trimmed = query.trim()
        return `"${trimmed.length > 20 ? `${trimmed.slice(0, 17)}...` : trimmed}"`
      }
    }
  } catch {
    // ignore malformed args JSON
  }
  return null
}

/** Extract the active trailing sentence or snippet from streaming text. */
function extractActiveTextSnippet(text: string, maxLen = 42): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)
  const lastLine = lines[lines.length - 1] ?? ''
  if (lastLine.length <= maxLen) {
    return lastLine
  }
  return `...${lastLine.slice(-maxLen)}`
}

/**
 * Resolve localized speech key or real-time streaming content from session truth.
 * @param session - active conversation snapshot.
 * @param summary - session summary from list.
 * @param activity - current pet animation activity.
 * @param reviewing - whether the turn has just settled and is in review.
 * @returns translation key, params, or raw streaming speech text.
 */
export function resolvePetSpeech(
  session: ConversationSnapshot | undefined,
  summary: SessionSummary | undefined,
  activity: PetActivity,
  reviewing: boolean,
): ResolvedSpeech {
  // 1. Error / Failure state
  if (
    session?.removed === true
    || session?.openState === 'error'
    || (session?.promptError !== null && session?.promptError !== undefined)
    || (session?.lastAgentError !== null && session?.lastAgentError !== undefined)
  ) {
    const errorMsg = session?.lastAgentError || session?.promptError?.error?.message
    if (typeof errorMsg === 'string' && errorMsg.trim().length > 0) {
      const clean = errorMsg.replace(/^(Error:\s*)+/, '').trim()
      const snippet = clean.length > 35 ? `${clean.slice(0, 32)}...` : clean
      return { key: 'speech.errorDetail', params: { detail: snippet } }
    }
    return { key: 'speech.error' }
  }

  // 2. Pending approval / user question
  if ((session?.pending?.length ?? 0) > 0 || summary?.pendingInteraction !== undefined) {
    return { key: 'speech.waitingApproval' }
  }

  // 3. Just settled (review mode)
  if (reviewing) {
    return { key: 'speech.review' }
  }

  // 4. Running tools or model generation (real-time streaming synchronization)
  if (session?.running === true || summary?.running === true || activity === 'running') {
    const runningCall = session?.runningCalls?.[0]
    if (runningCall !== undefined) {
      const name = runningCall.name
      const target = extractToolTarget(runningCall.argsRaw)

      if (name.includes('view') || name.includes('read')) {
        return {
          key: target ? 'speech.tool.readingDetail' : 'speech.tool.reading',
          params: target ? { target } : undefined,
        }
      }
      if (name.includes('write') || name.includes('replace') || name.includes('edit')) {
        return {
          key: target ? 'speech.tool.writingDetail' : 'speech.tool.writing',
          params: target ? { target } : undefined,
        }
      }
      if (name.includes('command') || name.includes('bash') || name.includes('shell')) {
        return {
          key: target ? 'speech.tool.commandDetail' : 'speech.tool.command',
          params: target ? { target } : undefined,
        }
      }
      if (name.includes('search') || name.includes('grep') || name.includes('find') || name.includes('list')) {
        return {
          key: target ? 'speech.tool.searchDetail' : 'speech.tool.search',
          params: target ? { target } : undefined,
        }
      }
      if (name.startsWith('git_')) {
        return {
          key: target ? 'speech.tool.gitDetail' : 'speech.tool.git',
          params: target ? { target } : undefined,
        }
      }
      if (name.startsWith('web_')) {
        return {
          key: target ? 'speech.tool.webDetail' : 'speech.tool.web',
          params: target ? { target } : undefined,
        }
      }
      return {
        key: target ? 'speech.tool.genericDetail' : 'speech.tool.generic',
        params: target ? { tool: name, target } : { tool: name },
      }
    }

    const blocks = session?.partial?.blocks ?? []
    // Reasoning is high-frequency model-internal content; expose only its
    // stable activity label rather than echoing the reasoning transcript.
    const reasoningBlock = blocks.find(b => b.kind === 'reasoning' && b.text.trim().length > 0)
    if (reasoningBlock !== undefined && reasoningBlock.kind === 'reasoning') {
      return { key: 'speech.thinking' }
    }

    // Check streaming text blocks
    const textBlock = blocks.find(b => b.kind === 'text' && b.text.trim().length > 0)
    if (textBlock !== undefined && textBlock.kind === 'text') {
      const snippet = extractActiveTextSnippet(textBlock.text)
      if (snippet) {
        return { key: 'speech.generatingDetail', params: { text: snippet } }
      }
      return { key: 'speech.generating' }
    }

    return { key: 'speech.running' }
  }

  // 5. Interactive gestures
  if (activity === 'jumping') {
    return { key: 'speech.jumping' }
  }
  if (activity === 'waving') {
    return { key: 'speech.waving' }
  }

  // 6. Default idle state
  return { key: 'speech.idle' }
}
