# Agent Note: Session-aware DeepSeek whale pet

Status: implemented

English | [中文](2026-08-14-deepseek-whale-pet.zh.md)

## Problem

DeepSeek Harness exposes the agent's running, waiting, failure, and completion lifecycle in its browser client, but the application has no compact ambient indicator that stays visible across conversation and details surfaces. Reusing a pet installed in Codex would put a Harness feature behind another product's private filesystem and runtime state, while a decorative animation disconnected from Harness truth would misreport activity.

## Decision

**The whale is a Harness client plugin.** `@deepseek-ai/dsh-client-ui-pet` contributes one additive `shell.overlay` entry, so Web and Desktop profiles share the same component without adding another React root or modifying the layout owner. The Web bundle composes the package explicitly; removing that graph entry removes the feature.

**Harness session state owns task animation.** The root-scoped entry projects the current session's conversation observable and combines it with the selected session summary. Failure outranks a blocking approval or question, which outranks active work. A running-to-idle transition produces a bounded review gesture before ordinary idle. These states outrank greeting, click, and pointer gestures so the pet does not hide a task state.

**Local gestures use the remaining sprite-version-2 rows.** The first mount waves, an idle click jumps, and dragging uses the left or right travel row according to horizontal motion. A nearby pointer selects one of sixteen clockwise look cells; the direction index uses up as zero and advances in 22.5-degree steps. The control is keyboard-focusable, localized, viewport-clamped, and static under reduced-motion preference.

**Desktop movement uses a narrow preload bridge.** The transparent companion window leaves the whale button in the normal pointer-event path and asks the Electron main process to move the native window during a drag. The `petOnly` document filters the shared overlay slot to the whale entry, and a desktop-only `BroadcastChannel` synchronizes the selected session from the main renderer before the pet renderer consumes its own live stream. A failed companion load destroys that window so a later toggle can retry. Dynamic speech uses locale keys with parameters rather than hardcoded language-specific prefixes; high-frequency reasoning blocks resolve to a stable thinking label instead of displaying model-internal text, while tool targets and response tails remain bounded.

**The validated atlas ships inside the plugin bundle.** The package owns the 8-by-11 WebP source. The shared client-bundle preset converts imported PNG and WebP assets to watched data-URL modules, keeping dynamically fetched plugins self-contained instead of adding an application-global static route.

## Alternatives considered

**Install or read the pet through Codex.** Rejected because DeepSeek Harness must not depend on another product's user configuration, renderer, or private pet directory.

**Render the whale directly from the Web application entry.** Rejected because the entry is a boot kernel, while product UI belongs in a removable plugin and the layout already provides the additive `shell.overlay` slot.

**Animate only from pointer interaction.** Rejected because a mascot that keeps playing while the agent waits for approval or fails would lose the status value that justifies its persistent placement.

**Serve the atlas from a Web-only public directory.** Rejected because the plugin would cease to be self-contained and alternative compositions would need an undocumented matching static route. Inline raster modules increase the fetched plugin bundle but preserve one artifact and loader lifecycle.

## Consequences

The default Web and Desktop profiles show one DeepSeek-blue whale that covers all nine standard animation states and sixteen look directions. Its state follows the currently selected Harness session, while drag, click, and native companion-window movement remain non-model-visible. The plugin adds about two megabytes to its uncompressed client bundle because the validated atlas is base64 encoded; it adds no Host RPC, session event, prompt content, or durable format. Pet selection, visibility settings, persistent position, alternate atlas registration, and package-level asset chunking remain available extensions rather than hidden defaults.
