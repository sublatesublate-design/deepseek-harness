/// <reference types="node" />

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BUILD_STATE_VERSION, computeSourceFingerprint, rebuildReason } from '../scripts/source-state.mjs'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-source-state-'))
  roots.push(root)
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'app.js'), 'export const value = 1\n')
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  execFileSync('git', ['add', 'src/app.js'], { cwd: root })
  return root
}

describe('desktop source build state', () => {
  it('changes when a dirty input changes again but ignores paths outside the input set', () => {
    const root = repository()
    const options = { repositoryRoot: root, pathspecs: ['src'] }
    const original = computeSourceFingerprint(options)

    writeFileSync(join(root, 'README.md'), 'unrelated\n')
    expect(computeSourceFingerprint(options)).toBe(original)

    writeFileSync(join(root, 'src', 'app.js'), 'export const value = 2\n')
    const firstEdit = computeSourceFingerprint(options)
    expect(firstEdit).not.toBe(original)

    writeFileSync(join(root, 'src', 'app.js'), 'export const value = 3\n')
    expect(computeSourceFingerprint(options)).not.toBe(firstEdit)
  })

  it('builds for missing state, changed source, or missing artifacts', () => {
    const current = { version: BUILD_STATE_VERSION, fingerprint: 'current' }
    expect(rebuildReason({ state: undefined, fingerprint: 'current', artifactsPresent: true })).toBe('first-run')
    expect(rebuildReason({ state: current, fingerprint: 'changed', artifactsPresent: true })).toBe('source-changed')
    expect(rebuildReason({ state: current, fingerprint: 'current', artifactsPresent: false })).toBe('artifacts-missing')
    expect(rebuildReason({ state: current, fingerprint: 'current', artifactsPresent: true })).toBeUndefined()
  })
})
