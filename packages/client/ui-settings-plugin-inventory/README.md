# @deepseek-ai/dsh-client-ui-settings-plugin-inventory

English | [中文](README.zh.md)

**Plugin list** tab for Web Settings. The browser plugin registers one localized `settings.plugins.tab` contribution with id `all`; the Plugins section owns the navigation entry and tab chrome. It performs no Remote read during plugin activation. Selecting the tab for the first time mounts it and lazily calls `ctx.remote.pluginInventory.list()` through [`api-remotes`](../../api/remotes/README.md).

The tab opens with the deployment trust rule: plugins run inside the Harness process with its file, network, and process authority, and failure containment is not a security sandbox. It then renders a searchable two-column catalog of compact disclosure cards. Each collapsed card uses the short module name as its title and a small effective-enablement tag; enabled entries also show a colored lifecycle dot. Expanding one card reveals its Loader-tree entry id, effective configuration, Cordis status, and failure policy. An explicitly contained failure also shows the Host-supplied bounded diagnostic and a retry action; a successful retry replaces that row in place, while failure stays generic and directs the user to Host logs. Ordinary fail-loud rows have no mutation control. Loading, empty, no-match, and generic read-failure states stay local to the mounted component. The registration uses `ctx.slots.inject()`, so it follows late tab declaration, redeclaration, locale changes, and teardown without importing the section owner.

## Model Experience

None, as this package only visualizes a Host-owned deployment snapshot in browser Settings and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **One snapshot per Settings mount or list retry** — the tab does not subscribe to Loader changes or automatically refetch after reconnect; a contained-plugin retry updates only that row.
- **Narrow recovery only** — the tab cannot enable, disable, add, remove, or reconfigure plugins. Only a failed explicit boundary exposes retry.
- **No provenance** — local search does not add grouping or explain which bundle, profile, or override introduced an entry.
