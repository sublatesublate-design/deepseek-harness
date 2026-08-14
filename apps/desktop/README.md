# DeepSeek Desktop

English | [中文](README.zh.md)

DeepSeek Desktop opens the shipped DeepSeek Harness Web profile in a secure Electron window. It reuses the same Cordis composition, sessions, model settings, tools, workspace picker, and local API rather than maintaining a second client implementation.

## Run from source

Install the repository, then launch the desktop window:

```sh
pnpm install
pnpm desktop
```

`pnpm desktop` builds the Host, Client, Web, and Electron entry artifacts on its first run, when relevant tracked or uncommitted source changes, or when a required artifact is missing. Otherwise it starts Electron directly and prints one status line. Successful build state and the quiet build log live under `.cache/deepseek-desktop/`; a failed build prints its recent output and the complete log path. `pnpm run build:desktop` remains the explicit full-build command. The launcher then starts its managed service at `http://127.0.0.1:3081`; the desktop-specific default avoids colliding with the browser command's port 3080. Each desktop process generates a 256-bit control token, passes it to the managed Host without placing it in the command line or URL, and injects it into the window's HTTP and WebSocket API requests. Readiness requires the expected Web document, an authorized control probe, and an anonymous 401, so an unrelated, stale, or unauthenticated process already using port 3081 is reported precisely instead of being reused.

Set `DSH_DESKTOP_PORT` to change the managed server port. `DSH_DESKTOP_URL` selects an explicitly managed local development server; set `DSH_DESKTOP_CONTROL_TOKEN` as well when that server requires the same API header.

## Platforms

The source launcher supports Windows and macOS. It starts the CLI through Electron's embedded Node runtime, so the launched desktop process does not depend on a platform-specific `node` executable name. Windows uses a title-bar overlay and stable application ID; macOS uses inset traffic lights, the standard application menu, Dock behavior, and the same branded application icon. Saved window coordinates are restored only when the window still intersects a current display.

## Desktop behavior

The application uses one native window with a compact draggable title bar, persisted normal bounds, single-instance focus, external-browser handoff for new windows, denied browser permissions, context isolation, renderer sandboxing, and no Node.js access in the page. The source launcher permits Electron to present a Windows GUI while keeping build and service consoles hidden. A localized startup document appears immediately while the service starts, and the window is restored and presented again after application navigation or a second launch. Failure diagnostics distinguish an unreachable address, an incompatible service, an incomplete build, and authentication failures; the same window offers retry, a collapsible bounded output tail, and the current log location. Retry and application quit wait for the owned process tree to close before proceeding. Logs are written to `logs/desktop.log`, with the prior run retained as `logs/desktop.previous.log`, under Electron's DeepSeek Desktop user-data directory.

After building, `pnpm test:desktop:built` starts the real Electron entry, managed CLI, authenticated API, and Web application with a temporary user-data directory and loopback port. The smoke exits only after the Web application loads, verifies that shutdown released the port, and removes its isolated data.

## Known limitations and deferred work

This developer-preview package runs from a repository checkout and does not produce installers. Windows behavior is exercised locally; the macOS branch still needs execution on macOS hardware before release work begins. Product onboarding, updates, signing, and distributable packaging remain outside this source-run preview.
