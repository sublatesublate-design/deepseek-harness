# `@deepseek-ai/dsh-tool-project-memory`

English | [中文](README.zh.md)

Bounded, repository-scoped memory for coding agents.

The package stores generated state in `.dsh-project-memory.json` at the Git root, or at the session working directory when no Git root is available. The file is regular UTF-8 JSON, rejects symbolic links, has strict entry and byte caps, and is updated through the shared `fs/write-intent` gate with a compare-and-set version. Teams may commit it as shared project knowledge or ignore it for local recall.

At the first eligible step of a session, the package injects only a small index containing active entry ids, kinds, titles, and tags. Entry bodies never enter context automatically. `memory_search` returns bounded snippets, `memory_read` retrieves one exact entry, `memory_write` creates or replaces an entry, and `memory_archive` preserves superseded history without returning it in ordinary searches.

Memory is a recall layer, not authority. Required rules belong in `AGENTS.md` or checked-in documentation. Suitable entries are durable decisions, conventions, pitfalls, and environment facts. Transcripts, logs, secrets, source dumps, temporary paths, and cheap-to-rediscover facts do not belong in memory.

## Model Experience

### System prompt and startup index

#### What the model sees

A fixed policy distinguishes required instructions from fallible recall and states what not to store. Once per session, the first eligible step may append a bounded snapshot containing only active ids, kinds, titles, and tags. A missing or empty store adds no snapshot.

##### Project-memory policy

```markdown
Project memory is a bounded recall layer, not an authority source. AGENTS.md and checked-in documentation remain authoritative. Search memory when prior decisions, conventions, pitfalls, or environment facts may matter; read only relevant entries. Write concise durable facts, not transcripts, logs, secrets, source code, temporary paths, or facts that are cheap to rediscover. Update an existing entry instead of creating a duplicate, and archive entries that are no longer true.
```

#### Token effect

Fixed policy cost plus at most `maxIndexBytes` of data-dependent startup metadata; entry bodies are excluded.

#### KV Cache effect

The fixed system section is prefix-stable. The one-time snapshot appends to the first request and changes only when the bounded active index changes between sessions.

### Memory schemas and results

#### What the model sees

Four generated [project-memory tool schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-project-memory) expose bounded search, exact read, create-or-replace, and archive. Search returns ranked metadata and short snippets; read returns one exact entry. Mutations return the affected durable entry. Malformed, oversized, symlinked, stale, duplicate-title, and missing-id states become typed errors with a concrete recovery path. Index-loading failures are logged and contained.

#### Token effect

Fixed schema cost plus bounded per-call results. Search is capped by `maxSearchResults` and `maxSearchBytes`; exact entries are capped by `maxEntryChars` plus a small envelope.

#### KV Cache effect

Tool calls and results append after the reusable prefix. Writes change the next session's startup index but do not rewrite the current session's frozen snapshot.

## Known Limitations and Deferred Work

- Retrieval is lexical rather than embedding-based; callers should use titles and tags that match likely task language.
- The JSON file is project-scoped generated state, but the team must choose whether to commit or ignore it.
- Entries have timestamps and archive state but no authorship, confidence score, or automatic contradiction detection.
- A damaged store is contained at startup, but memory tools fail until a human repairs or removes it.
