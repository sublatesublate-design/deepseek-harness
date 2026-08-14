import { describe, expect, it } from 'vitest'
import { parsePorcelainV1Z } from '../src/index.ts'

describe('parsePorcelainV1Z', () => {
  it('preserves whitespace and parses rename records', () => {
    expect(parsePorcelainV1Z(' M file with spaces.ts\0R  new.ts\0old.ts\0?? fresh.txt\0')).toEqual([
      { index: ' ', worktree: 'M', path: 'file with spaces.ts' },
      { index: 'R', worktree: ' ', path: 'new.ts', originalPath: 'old.ts' },
      { index: '?', worktree: '?', path: 'fresh.txt' },
    ])
  })
})
