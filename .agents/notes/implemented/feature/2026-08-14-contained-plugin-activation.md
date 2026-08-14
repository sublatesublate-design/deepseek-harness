# Agent Note: Opt-in containment for optional plugin activation

Status: implemented

English | [中文](2026-08-14-contained-plugin-activation.zh.md)

## Problem

The Loader intentionally treats a composition update as a transaction. That is correct for required services, but an experimental or third-party plugin can therefore prevent an otherwise usable application from starting. Silently weakening every row would hide missing core services and make a partially initialized process look healthy.

## Decision

**Containment is explicit at the composition boundary.** The base profile mounts one `pluginFaults` registry, while a plugin opts in only by using `@deepseek-ai/dsh-plugin-fault-boundary/boundary` as its Loader row and naming the target under `config.plugin`. Ordinary rows retain fail-loud Loader behavior.

**The wrapper owns a child Fiber.** It resolves the target through the owning Loader tree, mounts it below the wrapper, and catches import or activation failure. A failed child is disposed while the wrapper remains active, so sibling rows can settle. Retry is serialized, disposes any previous child, and repeats the same import-and-activate path.

**Diagnostics are bounded and recovery is narrow.** The Host log receives the failure context. The registry exposes a single-line message capped at 500 characters, lifecycle phase, and retry availability. The plugin inventory Remote projects the target instead of the wrapper and permits only retry of a currently failed live boundary. The Web Settings row displays that state without exposing transport errors.

**Plugins remain trusted local code.** A plugin shares the Harness process's filesystem, network, environment, native-module, and process-control authority. The Settings inventory states this rule before the catalog. A child Fiber is a lifecycle failure boundary, not a capability or security boundary.

## Alternatives considered

**Make every Loader row best-effort.** Rejected because required services and their dependents would remain pending or fail later, obscuring the first actionable boot error.

**Modify the vendored Loader transaction.** Rejected because containment is a product policy, not a generic Loader semantic, and an explicit wrapper keeps the vendored lifecycle contract intact.

**Treat the child Fiber as a sandbox.** Rejected because a Fiber controls lifecycle ownership but does not restrict Node.js authority; presenting it as isolation would create a false security boundary.

**Run each plugin in another process.** Not selected for this architecture because Cordis plugins share in-process services and contexts. A real process boundary requires a service protocol, explicit capabilities, serialization rules, resource limits, and supervision. That would be a separate plugin runtime rather than an extension of this activation wrapper.

## Consequences

Optional plugins can fail without taking down the application, and users can inspect and retry them from the existing Plugins settings surface. Core composition remains strict. The deployment assumes plugin code and updates are trusted. Infinite loops, native crashes, process exits, deliberate misuse of Host authority, and arbitrary unhandled asynchronous failures after activation remain outside the boundary's guarantee.
