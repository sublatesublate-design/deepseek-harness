/**
 * Model-facing path spelling for tool output. Windows backslashes become `/`
 * so read/edit/write envelopes stay host-stable. Error paths that name a
 * backend target keep that target's own `displayPath`.
 * @module @deepseek-ai/dsh-tool-fs/src/display-path
 */

/**
 * Rewrite a display path to POSIX separators for model-visible text.
 * @param path - the backend-resolved `displayPath`.
 * @returns the same path with every `\` replaced by `/`.
 */
export function posixDisplayPath(path: string): string {
  return path.replace(/\\/g, '/')
}
