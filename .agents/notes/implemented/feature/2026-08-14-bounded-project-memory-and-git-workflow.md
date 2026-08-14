# Agent Note: Bounded project memory and controlled Git workflow

Status: implemented

English | [中文](2026-08-14-bounded-project-memory-and-git-workflow.zh.md)

## Problem

General shell access can run Git, but it gives the model no narrow workflow contract and does not distinguish a repository observation from a durable commit. Project instructions can carry stable rules, but using them as an ever-growing task diary consumes request context and mixes authority with fallible recall.

## Decision

**Git is a small native workflow surface.** The standard, code, and Cordis presets expose status, bounded diff, explicit-path stage or unstage, and staged-only commit tools. Git runs through the subprocess seam with fixed argument vectors and bounded collected output. The surface omits remote mutation and history rewriting.

**A commit always needs a fresh approval.** The Git plugin returns `ask` from `tools/pre-execute` for every `git_commit` call. The approval covers one exact call; ordinary permission to edit or stage files does not grant permission to create repository history.

**Project memory is separate from instructions and conversation compaction.** Generated state lives in `.dsh-project-memory.json` at the Git root, or the session directory outside a repository. A regular-file check rejects symbolic links. Reads validate the full schema and configured caps; writes pass through the shared `fs/write-intent` gate and use compare-and-set publication. Teams decide whether to commit or ignore the file.

**Only a bounded index enters context automatically.** The first eligible step receives active entry ids, kinds, titles, and tags. Bodies remain on disk until `memory_search` or `memory_read` retrieves relevant material. Search result count, snippets, entry size, store size, and startup-index size all have hard limits. Updates replace an exact id, while archive preserves superseded history.

## Alternatives considered

**Inject the complete memory file on every request.** Rejected because cost and attention usage grow with the store, unrelated entries compete with the current task, and prompt-cache savings do not recover context capacity.

**Put project memories in `AGENTS.md`.** Rejected because required instructions and helpful recollections have different authority and retention rules. `AGENTS.md` remains the source for rules that must always apply.

**Add embeddings and a vector database immediately.** Deferred because lexical retrieval over a strictly bounded local store is inspectable, portable, and sufficient to establish the lifecycle. Semantic indexing can later replace the search implementation without changing the instruction/memory boundary.

## Consequences

Coding agents can inspect and prepare repository changes without reaching first for an unrestricted shell, while users retain an independent commit boundary. Cross-session project knowledge survives without making the whole store permanent prompt baggage. Memory remains fallible generated state: it must not contain secrets, does not override checked-in instructions, and should be updated or archived when reality changes.
