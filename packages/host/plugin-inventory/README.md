# @deepseek-ai/dsh-host-plugin-inventory

English | [中文](README.zh.md)

Host projection of the current Cordis Loader tree. `PluginInventoryGateway` registers the `pluginInventory` service and publishes generated direct Remotes for `pluginInventory/list` and `pluginInventory/retry`. Every list call reads `ctx.loader.entries()` directly, skips structural group rows, and returns the remaining entries in Loader order with their entry id, module specifier, effective enablement, current root Fiber phase, and failure policy.

The phase is `pending`, `loading`, `active`, `failed`, or `unloading`; it is `null` when the entry has no live root Fiber. Ordinary rows report the `fatal` policy. A live [`plugin-fault-boundary`](../../boot/plugin-fault-boundary/) row is projected as its target module with the `contained` policy, its bounded diagnostic, and whether retry is currently available. Retry delegates only to that boundary; it cannot mutate ordinary Loader rows. The snapshot is intentionally point-in-time: Loader and the boundary registry remain the lifecycle authorities, while this package owns no cache, history, provenance model, or event stream.

The service is Remote-only and deliberately declares no same-process Cordis `Context` merge. Client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

## Model Experience

None, as this Host-only inventory projection registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Point-in-time state only** — the result contains no durable failure history or subscription; a missing ordinary root Fiber is reported as `null`, regardless of why no live root exists.
- **Narrow recovery only** — the service cannot enable, disable, add, or remove plugins. Its only write operation retries a currently failed, explicitly contained child.
- **No provenance** — the service does not identify which bundle, profile, or override introduced an entry.
