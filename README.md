# DeepSeek Desktop

English | [中文](README.zh.md)

DeepSeek Desktop is a community fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) for developers who want to use a coding agent in a native desktop window on Windows and macOS. It retains the upstream “everything is a plugin” architecture powered by [Cordis](https://github.com/cordiverse/cordis), while adding desktop operation, engineering workflows, bounded project memory, failure recovery, and local security protections.

This project is not an official DeepSeek AI desktop product. The current features live on the `deepseek-desktop` branch and remain a developer preview with no compatibility guarantee.

## Why this fork exists

The original Harness experience is browser-first. I wanted a version that is easier to keep running as an engineering workspace, with stronger local process control, safer project operations, clearer recovery behavior, and visible live status.

## What changed

- **Native Desktop application:** Electron reuses the Harness Web UI, sessions, model settings, tools, workspaces, and plugin composition instead of creating a second client. The managed service runs on `127.0.0.1:3081` with a fresh 256-bit control credential for each process; HTTP, RPC, and WebSocket requests require authentication, and the credential never enters URLs, page boot data, or logs. Windows and macOS launchers add single-instance focus, saved bounds, native menus, platform title bars, and application icons. Startup failures show the cause, a bounded log tail, the full log path, and a retry action.
- **Coding-agent engineering workflow:** `git_status`, `git_diff`, `git_stage`, and `git_commit` require explicit paths and fresh human approval. Tool effect levels (`observe`, `interact`, `mutate`, and `orchestrate`) give the host a clear permission and recovery policy.
- **Bounded project memory:** Entry bodies live in `.dsh-project-memory.json` at the repository root, while startup injects only a small index; the agent must search and explicitly read relevant entries so persistent memory does not continuously fill the context. Memory is a recall layer, not an authority source. Keep durable decisions, conventions, pitfalls, and environment facts; do not store transcripts, secrets, or facts that are cheap to rediscover.
- **Plugin fault containment:** Optional plugins run in a dedicated Cordis child Fiber. Import or activation failures are recorded and isolated so sibling plugins can continue; the inventory exposes diagnostics and retry. Plugins remain trusted local code, not a security sandbox.
- **Crash recovery and approval safety:** Missing durable tool calls recover as `TOOL_NOT_STARTED`; calls without results recover as `TOOL_OUTCOME_UNKNOWN` instead of blindly repeating a possibly side-effecting operation. An unanswered approval expires only with an interrupted turn and is never replayed or inferred as granted.
- **Eleven local security fixes:** These protections are independent. They cover permission, network, plugins, sessions, configuration, Git, subprocesses, paths, and model output.
  - Switching `/permission` to a preset whose approval is `never` requires confirmation; the switch is refused when the question service is missing or the answer is not Yes.
  - `/api` rejects a proven non-loopback peer when bound to `0.0.0.0`; a wildcard bind requires explicit `allowNonLoopback`.
  - Dynamic plugins cannot read an unguarded host Context through `exec.agent.ctx`.
  - One session cannot settle another session's plugin-run approval.
  - User patches under the workspace or the platform temp directory cannot use `!!js`; trusted home and profile patches may still interpolate environment variables.
  - `dsh plugin` activates a newly installed bundle only after an explicit TTY yes; a non-TTY install names the bundles and leaves them inactive.
  - `git commit`, `git push`, and `git reset --hard` require human approval.
  - Subprocess confinement is per-call and fail-closed when a confined spawn has no sandbox service.
  - Model-visible tool paths use POSIX separators so Windows backslashes do not enter the context.
  - `str_replace_editor` first matches the original text so mixed-EOL files stay unique, then restores the majority line ending of the first 4 KiB.
  - A tool-call `id` or `name` of `null` is treated as absent and does not overwrite an already accumulated name.
- **Live whale companion:** A transparent Desktop window follows the active session and reflects thinking, tool calls, approvals, errors, and completed answers. High-frequency reasoning is reduced to a stable thinking state, while tool targets and answer tails remain bounded summaries.

The purpose is not to add a decorative pet to a browser page. It is to make Harness a desktop AI coding environment that can stay open for a project, recall bounded project facts across sessions, refuse to continue when a local protection cannot hold, recover clearly from failures, and keep high-impact actions visible to the human operator.

## Features in this branch

### Native desktop application

- The Electron shell reuses the Harness Web UI, sessions, model settings, tools, and workspaces instead of maintaining a second client.
- The desktop starts a managed service on `127.0.0.1:3081` and generates a random 256-bit control credential for each process. HTTP, RPC, and WebSocket requests require authentication; the credential never enters the URL, page boot data, or logs.
- When service startup fails, the window shows the cause, a bounded recent log, the full log location, and a retry action instead of leaving only a terminal error or blank window.
- The source launcher includes Windows and macOS window behavior, single-instance focus, persisted bounds, system menus, platform title bars, and application icons.

### Coding-agent engineering workflows

- Adds `git_status`, `git_diff`, `git_stage`, and `git_commit`. Staging requires explicit paths, commits use only the existing index, and every commit requires fresh human approval.
- Tool definitions can declare an `observe`, `interact`, `mutate`, or `orchestrate` effect level for Host permission and recovery policy without leaking scheduler metadata to the model.

### Bounded project memory

- Entry bodies live in `.dsh-project-memory.json` at the Git root; if no Git root exists, the session working directory is used.
- Startup injects only the id, type, title, and tags of active entries. Entry bodies do not enter context automatically.
- `memory_search` returns a bounded summary, `memory_read` reads one explicit entry, `memory_write` creates or replaces an entry, and `memory_archive` hides stale content from ordinary search.
- Memory is a capacity-limited recall layer, not an authority source. Rules that must be followed still belong in `AGENTS.md` or checked-in documentation. Keep durable decisions, conventions, pitfalls, and environment facts; do not store transcripts, secrets, or facts that are cheap to rediscover.

### Plugin containment and trust

- Optional plugins can activate in a dedicated Cordis child Fiber. Import or activation failures are contained and recorded so sibling plugins can continue starting; the plugin inventory presents diagnostics and retry.
- Plugins remain trusted local code running inside the Harness process, with access to that process's filesystem, network, environment, and process authority. A child Fiber contains supported lifecycle failures; it is **not a security sandbox**.

### Crash recovery and approval

- When the assistant requested a tool but no durable `tool/call` exists, recovery records `TOOL_NOT_STARTED`, allowing execution when still needed.
- When a durable call exists without a tool result, recovery records `TOOL_OUTCOME_UNKNOWN`; the system does not blindly retry an operation that may already have produced side effects.
- An unanswered approval at crash time expires only with an interrupted turn. It is never replayed, inferred as granted, or fabricated as a human decision.

### Local security fixes

- Switching `/permission` to a preset whose approval is `never` asks the user first. The switch is refused when the question service is missing or the answer is not Yes.
- `/api` HTTP and WebSocket handlers reject a proven non-loopback peer when bound to `0.0.0.0`. A missing peer address is not treated as remote; a wildcard bind also requires `allowNonLoopback: true`.
- A dynamic plugin `execute` sees only a read-only façade. Reading `exec.ctx` or `exec.agent.ctx` throws and cannot bypass the host guard.
- A plugin-run approval must belong to the current agent. One session cannot settle another session's unanswered run request.
- User patches under the task workspace or the platform temp directory parse without `!!js`. Home and profile patches outside those roots may still interpolate environment variables; `--patch` overlays stay trusted.
- `dsh plugin` activates a newly installed bundle only after an explicit TTY yes. A non-TTY install names the bundles and leaves them inactive.
- `git commit`, `git push`, and `git reset --hard` ask the operator through pre-execute approval.
- Subprocess confinement is per-call. A request that is not `danger-full-access` is confined; a missing sandbox service throws. Unmarked trusted spawns stay unconfined.
- Model-visible tool paths use POSIX separators. Error text that names a backend path keeps the backend spelling.
- `str_replace_editor` first matches the original text so mixed-EOL files stay unique. If that misses, it matches after LF normalization and restores the majority line ending of the first 4 KiB.
- A tool-call `id` or `name` of `null` is treated as absent and does not overwrite an already accumulated name.

## Current limitations

- This is a source-run developer preview. It does not produce Windows or macOS installers and does not provide code signing, automatic updates, or a release channel.
- The Windows path has been exercised locally. The macOS launcher and window paths are implemented but still require runtime and packaging acceptance on real Mac hardware.
- Plugin process isolation, capability grants, and resource quotas are not implemented, so install and enable only plugins you trust.
- The built-in Git tools do not provide push, force-push, reset, rebase, checkout, remote configuration, or branch deletion; those high-impact operations still require a separately authorized Shell workflow.

## Download and install

The fastest way to try the Desktop and whale companion together is to use this Fork's `deepseek-desktop` branch. You need Git, pnpm, and Node.js 22.19 or later.

```sh
git clone --branch deepseek-desktop https://github.com/sublatesublate-design/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm desktop
```

The Desktop window starts its local service on `http://127.0.0.1:3081`. The browser-only mode is available with `pnpm dsh web` and uses `http://127.0.0.1:3080`.

The whale plugin is already included in this Desktop branch. If you only want the plugin source, download the independent community repository at [deepseek-whale-pet](https://github.com/sublatesublate-design/deepseek-whale-pet). It is designed to be copied into a DSH workspace and is not a standalone application or one-click npm package.

## Run

### Run from source

Install a Node.js version compatible with 22.19 or later, pnpm, and Git:

```sh
git clone --branch deepseek-desktop https://github.com/sublatesublate-design/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm desktop
```

The desktop application uses `http://127.0.0.1:3081` by default. To use only the browser UI, run:

```sh
pnpm dsh web
```

The browser UI uses `http://127.0.0.1:3080` by default.

## Detailed documentation

- [Desktop application runtime, security, and platform limits](apps/desktop/README.md)
- [Git workflow tools](packages/git/tool-git/README.md)
- [Bounded project memory](packages/context/tool-project-memory/README.md)
- [Plugin activation fault containment](packages/boot/plugin-fault-boundary/README.md)
- [Approval and crash-recovery semantics](packages/interaction/user-approval/README.md)

## Upstream, development, and license

The upstream project and original design are maintained at [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness). Before contributing, read the [development guide](docs/development.md), [architecture documentation](docs/architecture.md), and [AGENTS.md](AGENTS.md).

This fork retains the upstream [MIT license](LICENSE). Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
