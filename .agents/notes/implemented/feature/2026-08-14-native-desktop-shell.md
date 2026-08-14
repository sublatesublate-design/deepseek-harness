# Agent Note: Native desktop shell over the Web profile

Status: implemented

English | [中文](2026-08-14-native-desktop-shell.zh.md)

## Problem

The browser application already owns the complete user workflow, but launching it from a terminal leaves window lifecycle, focus, desktop chrome, and external-link behavior to a general-purpose browser. A desktop application needs native window behavior without creating another renderer that can drift from the plugin-composed Web profile.

## Decision

**The desktop application wraps the shipped Web profile.** `apps/desktop` resolves the workspace CLI as an application dependency and starts the loopback `dsh web` process through Electron's embedded Node mode on desktop-specific port 3081, then loads it in one Electron `BrowserWindow`. This process path works on Windows and macOS without selecting `node.exe` or `node` by platform. Keeping the managed default separate from the browser command's port 3080 prevents accidental reuse of another installed build. `DSH_DESKTOP_URL` selects an explicitly managed local development server and `DSH_DESKTOP_PORT` changes the managed port. The root `pnpm desktop` entry follows the [desktop source build cache](2026-08-14-desktop-source-build-cache.md), so a fast launch still rejects stale or incomplete ignored artifacts.

**The managed API requires a per-process random credential.** The desktop process generates 256 random bits, passes the token to the Host through `DSH_CONTROL_TOKEN`, and injects `x-dsh-control-token` into the window's HTTP requests and WebSocket handshakes. The token never enters the renderer's URL or application boot data, and its credential-shaped environment name is removed from agent subprocess environments by the shared scrubber. Readiness probes require an authorized `/api/auth-probe` response and an anonymous 401, so an unauthenticated process already occupying 3081 is not adopted. Ordinary `dsh web` remains compatible when no token is configured; an explicit `DSH_DESKTOP_URL` can pair with `DSH_DESKTOP_CONTROL_TOKEN`.

**The web renderer opts into desktop chrome through URL state.** The Electron window loads `?desktop=1&platform=<platform>`. The web entry mounts one fixed drag region and reduces the application root by its height only for that mode. Ordinary browser URLs retain the existing full-height layout and DOM.

**The native process owns native policy.** The renderer uses context isolation and Chromium sandboxing with Node integration disabled. New windows open in the operating system browser, page permission requests are denied, one process owns the application instance, and normal window bounds persist under Electron's user-data directory. Saved coordinates are discarded when less than a useful portion intersects a current display. The source launcher leaves Electron's GUI process visible on Windows while hiding build and service consoles. Startup navigation, application navigation, and second-instance activation restore and present the native window. Windows receives a stable application ID and title-bar overlay; macOS receives inset traffic lights, its standard application menu, Dock activation behavior, and a Dock icon.

**Startup state remains inside the native window.** The window loads a localized progress document before the Host readiness wait and remains visible through failure. Readiness distinguishes connection refusal, HTTP failure, an unexpected document, a missing authentication endpoint, a rejected credential, and missing anonymous enforcement. A failed launch renders an escaped recovery document with a concise diagnosis, a collapsed bounded output tail, the persistent log path, and actions to retry the owned service or reveal the log file. The active log rotates one prior run after the single-instance lock is acquired, so a rejected second launch cannot erase the owner's diagnostics.

**The source launcher owns only the process it starts and waits for quiescence.** Retry and application quit detach output listeners, terminate the complete owned process tree on Windows or escalate from `SIGTERM` to `SIGKILL` elsewhere, and await the child's close before rebinding or completing quit. An explicitly configured development URL remains externally owned. The built-artifact smoke starts the real Electron, CLI, authenticated API, and Web path with isolated temporary user data, then verifies that quit releases its temporary port and removes that data.

## Alternatives considered

**Build a second React desktop renderer.** Rejected because sessions, settings, tools, approvals, workspaces, and plugin-contributed UI would need duplicate integration and could diverge from browser behavior.

**Load the Web build from `file://`.** Rejected because the browser application depends on the Host API and runtime-injected boot manifest; static files alone cannot provide a functioning Harness session.

**Require users to start `dsh web` manually.** Rejected because a native launcher owns a usable cold-start path. An explicit development URL remains available without weakening the authenticated managed default.

**Trust timestamps or an incomplete changed-file list.** Rejected because the CLI, both compilation faces, generated client bundles, Web assets, and Electron entry form one runnable artifact set. The [desktop source build cache](2026-08-14-desktop-source-build-cache.md) instead fingerprints an explicit runtime-input set from Git blob ids and dirty contents, validates artifact sentinels, and fails closed when it cannot establish freshness.

**Trust every process on loopback.** Rejected because a model-controlled shell or unrelated same-user process could call the Host API directly. Random per-process authentication makes possession of the desktop credential distinct from network reachability.

**Grant Electron renderer access to Node.js.** Rejected because the page already reaches privileged operations through the loopback-pinned Host API. Node integration would create a second, broader privilege path.

## Consequences

The desktop and browser applications share one product implementation, while Electron adds platform-aware native chrome, display-safe saved bounds, single-instance focus, controlled external navigation, an authenticated local control plane, structured startup recovery, and process-tree ownership through shutdown. Source launch pays the complete relevant build cost only when its recorded inputs require it. The launcher supports Windows and macOS and requires the Node.js toolchain. Product onboarding, updates, signing, and distributable installers remain separate release work.
