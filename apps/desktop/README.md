# DeepSeek Harness Desktop

English | [中文](README.zh.md)

The desktop application opens the shipped Web profile in a secure Electron window. It reuses the same Cordis composition, sessions, model settings, tools, workspace picker, and local API rather than maintaining a second client implementation.

## Run from source

Install and build the repository once, then launch the desktop window:

```sh
pnpm install
pnpm run build
pnpm desktop
```

The launcher starts its managed service at `http://127.0.0.1:3081`. The desktop-specific default avoids colliding with the browser command's port 3080. Each desktop process generates a 256-bit control token, passes it to the managed Host without placing it in the command line or URL, and injects it into the window's HTTP and WebSocket API requests. Readiness requires the matching credential boundary, so an unrelated or unauthenticated process already using port 3081 is reported as a startup failure instead of being reused.

Set `DSH_DESKTOP_PORT` to change the managed server port. `DSH_DESKTOP_URL` selects an explicitly managed local development server; set `DSH_DESKTOP_CONTROL_TOKEN` as well when that server requires the same API header.

## Platforms

The source launcher supports Windows and macOS. It starts the CLI through Electron's embedded Node runtime, so the launched desktop process does not depend on a platform-specific `node` executable name. Windows uses a title-bar overlay and stable application ID; macOS uses inset traffic lights, the standard application menu, Dock behavior, and the same branded application icon.

## Desktop behavior

The application uses one native window with a compact draggable title bar, persisted normal bounds, single-instance focus, external-browser handoff for new windows, denied browser permissions, context isolation, renderer sandboxing, and no Node.js access in the page. If the local service fails to start, the same window shows the failure, a bounded tail of service output, the current log-file location, and actions to retry or reveal the log file. Logs are written to `logs/desktop.log` under Electron's DeepSeek Harness user-data directory.

## Known limitations and deferred work

This developer-preview package runs from a built repository checkout and does not produce installers. Windows behavior is exercised locally; the macOS branch still needs execution on macOS hardware before release work begins. Product onboarding, updates, signing, and distributable packaging remain outside this source-run preview.
