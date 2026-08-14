# Agent Note: Desktop source build cache

Status: implemented

English | [中文](2026-08-14-desktop-source-build-cache.zh.md)

## Problem

The desktop source entry must not combine current source with stale ignored build output, but rebuilding every workspace package before every launch floods the terminal and makes an unchanged launch pay the complete build cost. File modification times alone cannot establish freshness across Git checkout, generated Client bundles, or copied Web assets.

## Decision

**The launcher fingerprints an explicit runtime-input set.** `apps/desktop/scripts/start.mjs` hashes Git index entries for the root build configuration, CLI, Desktop, Web, package sources, native sources, and vendored runtime, then adds the contents of every dirty or untracked input. Repeated edits to an already-dirty file therefore change the fingerprint. Documentation and tests outside that set do not force a runtime build.

**Fast launch requires both matching state and artifact sentinels.** `.cache/deepseek-desktop/build-state.json` records a versioned successful fingerprint. The launcher rebuilds on missing or invalid state, a different fingerprint, or a missing CLI, Electron, Web, or Client-connection sentinel. An algorithm or input-set change increments the state version. Failure to read Git state is a launch failure rather than permission to reuse output of unknown provenance.

**Only a stable successful build updates state.** The launcher runs the existing `build:desktop` composition with output redirected to `.cache/deepseek-desktop/build.log`. It records state only after a zero exit and an unchanged post-build fingerprint. Source changes during a build trigger another build, bounded at three attempts. Failure prints the recent output and complete log path; success and fast launch print concise status.

**Electron starts without another package-manager layer.** After preparation, the launcher resolves the workspace Electron executable and starts it directly. This avoids package-manager configuration and optional-platform warnings during an ordinary unchanged launch. `pnpm run build:desktop` remains the explicit full-build command and does not claim cache freshness on its own.

## Alternatives considered

**Rebuild before every launch.** Rejected because it is correct but makes unchanged startup slow and emits thousands of lines unrelated to operating the desktop application.

**Compare modification times.** Rejected because checkout operations can preserve or reorder times, generated output has multiple owners, and clock granularity differs across filesystems.

**Check only that the Electron entry exists.** Rejected because the CLI, Web assets, or a generated Client half can remain stale while Electron itself is current.

## Consequences

An unchanged launch performs Git metadata and dirty-content hashing, then starts Electron with one launcher status line. Relevant source edits and missing sentinels still pay the full build cost. Maintainers must add new runtime source roots and critical artifact owners to the input and sentinel lists; the state version invalidates older decisions when those rules change. The cache is disposable ignored data and never substitutes for release or CI builds.
