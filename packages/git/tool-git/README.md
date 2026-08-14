# `@deepseek-ai/dsh-tool-git`

English | [中文](README.zh.md)

Bounded model-facing Git workflow tools for local coding agents.

The package registers `git_status`, `git_diff`, `git_stage`, and `git_commit`. Commands use `ctx.subprocess` with fixed argv vectors, collected-output bounds, cancellation, and no shell interpolation. Staging requires explicit paths. Commits use only the existing index and always return `ask` from `tools/pre-execute`, so a fresh approval decision is required even when ordinary file mutations are already allowed.

The package deliberately has no tools for push, force-push, reset, rebase, checkout, branch deletion, or remote configuration. Those operations remain available only through separately governed shell access.

## Model Experience

### System prompt and tool schemas

#### What the model sees

A fixed policy tells the model to inspect before staging, use explicit paths, and treat a successful `git_commit` result as the only evidence that a commit exists. Four generated [Git tool schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-git) describe the bounded workflow.

##### Git workflow policy

```markdown
Use git_status and git_diff to inspect repository state. Stage only explicit paths with git_stage. git_commit commits only the existing index and always requires a fresh human approval. Never claim a commit was made unless git_commit succeeded. No push, force-push, reset, rebase, checkout, or branch-deletion tool is provided.
```

#### Token effect

Small fixed prompt and schema cost while the package is visible.

#### KV Cache effect

Prefix-stable while the plugin scope, configuration, and schemas remain unchanged.

### Git results and approval decisions

#### What the model sees

`git_status` returns structured root, branch, HEAD, cleanliness, and two-column path states. `git_diff` returns bounded plain patches with an explicit truncation marker. Stage and commit calls return compact confirmations or Git's own bounded diagnostic. Invalid paths, output overflow, cancellation, and nonzero exits become typed errors. Commit rejection or a missing approval channel is reported before Git starts.

#### Token effect

Data-dependent and bounded independently for stdout and stderr by `maxOutputBytes`.

#### KV Cache effect

Calls and results append after the reusable request prefix. Approval decisions add session events but do not rewrite earlier prompt content.

## Known Limitations and Deferred Work

- The workflow does not expose branches, remotes, stash, reset, rebase, checkout, or push.
- Diff truncation is explicit but has no spill-file continuation; callers narrow by path.
- Repository-specific hooks and signing configuration may still make an approved commit fail.
