# DeepSeek Desktop

English | [中文](README.zh.md)

DeepSeek Desktop is a community fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) for developers who want to use a coding agent in a native desktop window on Windows and macOS. It retains the upstream “everything is a plugin” architecture powered by [Cordis](https://github.com/cordiverse/cordis), while adding desktop operation, engineering workflows, bounded project memory, and failure recovery.

This project is not an official DeepSeek AI desktop product. The current features live on the `deepseek-desktop` branch and remain a developer preview with no compatibility guarantee.

## Features in this branch

### Native desktop application

- The Electron shell reuses the Harness Web UI, sessions, model settings, tools, and workspaces instead of maintaining a second client.
- The desktop starts a managed service on `127.0.0.1:3081` and generates a random 256-bit control credential for each process. HTTP, RPC, and WebSocket requests require authentication; the credential never enters the URL, page boot data, or logs.
- When service startup fails, the window shows the cause, a bounded recent log, the full log location, and a retry action instead of leaving only a terminal error or blank window.
- The source launcher includes Windows and macOS window behavior, single-instance focus, persisted bounds, system menus, platform title bars, and application icons.

### Coding-agent engineering workflows

- Adds `git_status`, `git_diff`, `git_stage`, and `git_commit`. Staging requires explicit paths, commits use only the existing index, and every commit requires fresh human approval.
- Adds bounded project memory. Entry bodies live in `.dsh-project-memory.json` at the repository root, while startup injects only a small index; the agent must search and explicitly read relevant entries so persistent memory does not continuously fill the context.
- Tool definitions can declare an `observe`, `interact`, `mutate`, or `orchestrate` effect level for Host permission and recovery policy without leaking scheduler metadata to the model.

### Plugin containment and trust

- Optional plugins can activate in a dedicated Cordis child Fiber. Import or activation failures are contained and recorded so sibling plugins can continue starting; the plugin inventory presents diagnostics and retry.
- Plugins remain trusted local code running inside the Harness process, with access to that process's filesystem, network, environment, and process authority. A child Fiber contains supported lifecycle failures; it is **not a security sandbox**.

### Crash recovery and approval

- When the assistant requested a tool but no durable `tool/call` exists, recovery records `TOOL_NOT_STARTED`, allowing execution when still needed.
- When a durable call exists without a tool result, recovery records `TOOL_OUTCOME_UNKNOWN`; the system does not blindly retry an operation that may already have produced side effects.
- An unanswered approval at crash time expires only with an interrupted turn. It is never replayed, inferred as granted, or fabricated as a human decision.

## Current limitations

- This is a source-run developer preview. It does not produce Windows or macOS installers and does not provide code signing, automatic updates, or a release channel.
- The Windows path has been exercised locally. The macOS launcher and window paths are implemented but still require runtime and packaging acceptance on real Mac hardware.
- Plugin process isolation, capability grants, and resource quotas are not implemented, so install and enable only plugins you trust.
- The built-in Git tools do not provide push, force-push, reset, rebase, checkout, remote configuration, or branch deletion; those high-impact operations still require a separately authorized Shell workflow.

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
