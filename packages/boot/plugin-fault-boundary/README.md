# @deepseek-ai/dsh-plugin-fault-boundary

English | [中文](README.zh.md)

Opt-in activation containment for optional Cordis Loader plugins. The default export registers `ctx.pluginFaults`; the `./boundary` export imports and mounts one target plugin inside a child Fiber. Import or activation failure is logged, recorded as a bounded diagnostic, and absorbed so the boundary row and its siblings can finish booting. Ordinary Loader rows keep the repository's fail-loud behavior.

Use the wrapper explicitly in a patch:

```yaml
- insert:
    - id: my-optional-plugin
      name: '@deepseek-ai/dsh-plugin-fault-boundary/boundary'
      config:
        plugin: '@scope/my-optional-plugin'
        config:
          feature: true
```

The registry exposes point-in-time `list()`, `get(entryId)`, and `retry(entryId)` operations. Retry disposes the failed child before importing and activating the target again. The Web plugin inventory projects the target module instead of the wrapper and exposes retry only while that live boundary is failed.

## Trust model

Plugins are trusted local code. A mounted plugin runs inside the Harness process and can use that process's filesystem, network, environment, native-module, and process-control authority. The child Fiber contains supported activation failures; it does not restrict capabilities. Install and enable only plugins whose code and updates you trust.

## Model Experience

None, as this Host-only boundary changes plugin lifecycle without contributing a model prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Activation containment, not security isolation** — the boundary covers module import and Cordis activation/reload lifecycle failures. It neither reduces plugin authority nor recovers an infinite loop, native crash, process exit, or arbitrary unhandled asynchronous exception after activation.
- **Explicit opt-in only** — a plugin is contained only when its Loader row uses `./boundary`; core rows remain fail-loud so missing required services do not produce a superficially healthy application.
- **Ephemeral diagnostics** — records exist only while the boundary row is mounted. Full failure details stay in Host logs; trusted clients receive a single-line message capped at 500 characters.
