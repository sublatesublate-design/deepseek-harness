import { describe, expect, it } from 'vitest'
import { parseMemoryStore, renderMemoryIndex } from '../src/index.ts'

const config = {
  maxEntries: 10,
  maxEntryChars: 1_000,
  maxStoreBytes: 10_000,
  maxIndexEntries: 10,
  maxIndexBytes: 1_000,
  maxSearchResults: 5,
  maxSearchBytes: 2_000,
}

describe('project memory store', () => {
  it('renders only title metadata into the startup index', () => {
    const store = parseMemoryStore(JSON.stringify({
      version: 1,
      entries: [{
        id: '1234abcd',
        kind: 'decision',
        title: 'Use SQLite',
        content: 'SECRET BODY MUST STAY OUT OF THE INDEX',
        tags: ['storage'],
        status: 'active',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
      }],
    }), config)
    const index = renderMemoryIndex(store, config)
    expect(index).toContain('Use SQLite')
    expect(index).not.toContain('SECRET BODY')
  })

  it('rejects duplicate ids', () => {
    const entry = {
      id: '1234abcd', kind: 'fact', title: 'One', content: 'Body', tags: [], status: 'active',
      createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z',
    }
    expect(() => parseMemoryStore(JSON.stringify({ version: 1, entries: [entry, { ...entry, title: 'Two' }] }), config))
      .toThrow(/duplicate/u)
  })

  it('keeps the startup index within its byte cap even when entries are omitted', () => {
    const store = parseMemoryStore(JSON.stringify({
      version: 1,
      entries: Array.from({ length: 4 }, (_, index) => ({
        id: `1234abc${index}`,
        kind: 'fact',
        title: `A deliberately long project-memory title ${index}`,
        content: 'Body stays on disk.',
        tags: ['bounded-index'],
        status: 'active',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: `2026-08-14T00:00:0${index}.000Z`,
      })),
    }), config)
    const maxIndexBytes = 220
    const index = renderMemoryIndex(store, { ...config, maxIndexBytes })
    expect(Buffer.byteLength(index!, 'utf8')).toBeLessThanOrEqual(maxIndexBytes)
    expect(index).not.toContain('Body stays on disk.')
  })
})
