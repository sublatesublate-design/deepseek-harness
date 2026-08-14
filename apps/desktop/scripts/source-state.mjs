/** Source fingerprint and cache-state rules for the desktop launcher. */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'

export const BUILD_STATE_VERSION = 1

/**
 * Hash tracked blob ids plus the contents of dirty and untracked build inputs.
 * @param {{ repositoryRoot: string, pathspecs: string[] }} options Git checkout and relevant pathspecs.
 * @returns {string} Stable SHA-256 fingerprint for the current build inputs.
 */
export function computeSourceFingerprint({ repositoryRoot, pathspecs }) {
  const git = args => execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  const index = git(['ls-files', '-s', '-z', '--', ...pathspecs])
  const status = git([
    'status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all', '--', ...pathspecs,
  ])
  const hash = createHash('sha256').update('deepseek-desktop-source-v1\0').update(index).update(status)

  for (const record of status.toString('utf8').split('\0')) {
    if (record.length < 4) continue
    const repositoryPath = record.slice(3)
    const absolutePath = join(repositoryRoot, ...repositoryPath.split('/'))
    try {
      const stat = lstatSync(absolutePath)
      hash.update(repositoryPath).update('\0')
      if (stat.isSymbolicLink()) {
        hash.update('link\0').update(readlinkSync(absolutePath))
      } else if (stat.isFile()) {
        hash.update('file\0').update(readFileSync(absolutePath))
      } else {
        hash.update(`other:${String(stat.mode)}\0`)
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      hash.update(`missing:${repositoryPath}\0`)
    }
  }
  return hash.digest('hex')
}

/**
 * Decide whether the launcher must rebuild before opening Electron.
 * @param {{ state: unknown, fingerprint: string, artifactsPresent: boolean }} options Cached and live state.
 * @returns {'first-run' | 'source-changed' | 'artifacts-missing' | undefined} Rebuild reason, or undefined for a fast launch.
 */
export function rebuildReason({ state, fingerprint, artifactsPresent }) {
  if (!artifactsPresent) return 'artifacts-missing'
  if (typeof state !== 'object' || state === null || state.version !== BUILD_STATE_VERSION) return 'first-run'
  if (state.fingerprint !== fingerprint) return 'source-changed'
  return undefined
}
