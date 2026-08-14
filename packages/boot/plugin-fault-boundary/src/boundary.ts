/** Loader wrapper that contains import and activation failures for one optional plugin. */

import type { Context, Fiber, FiberState, Plugin } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { ContainedPluginPhase, ContainedPluginRecord, Config } from './types.ts'

/** Cordis plugin name. */
export const name = 'plugin-fault-boundary'
/** Services required by a boundary row. */
export const inject = ['loader', 'pluginFaults']

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

const PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: 'failed',
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, ContainedPluginPhase>

/** Reduce an unknown thrown value to bounded client-visible prose. */
function diagnostic(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const singleLine = raw.replace(/\s+/g, ' ').trim() || 'Unknown activation failure'
  return singleLine.length <= 500 ? singleLine : `${singleLine.slice(0, 497)}...`
}

/** Validate the small public boundary configuration at its owning edge. */
function normalizeConfig(config: Config | undefined): Required<Pick<Config, 'plugin'>> & Pick<Config, 'config'> {
  if (typeof config?.plugin !== 'string' || config.plugin.length === 0 || config.plugin.trim() !== config.plugin) {
    throw new Error('plugin fault boundary: config.plugin must be a non-blank module specifier without surrounding whitespace')
  }
  return { plugin: config.plugin, config: config.config }
}

class Controller {
  private child: Fiber | undefined
  private current: ContainedPluginRecord
  private running: Promise<ContainedPluginRecord> | undefined
  private disposed = false

  constructor(
    private readonly ctx: Context,
    private readonly entryId: string,
    private readonly config: ReturnType<typeof normalizeConfig>,
  ) {
    this.current = this.record('loading')
  }

  snapshot(): ContainedPluginRecord {
    return Object.freeze({ ...this.current })
  }

  start(): Promise<ContainedPluginRecord> {
    return this.run()
  }

  retry(): Promise<ContainedPluginRecord> {
    if (this.current.phase !== 'failed') {
      throw new Error(`plugin fault boundary: entry ${JSON.stringify(this.entryId)} is not failed`)
    }
    return this.run()
  }

  observe(fiber: Fiber): void {
    if (fiber !== this.child || this.disposed) return
    const phase = PHASE[fiber.state]
    if (phase === 'failed' && this.current.phase !== 'failed') {
      this.current = this.record('failed', 'Plugin stopped after activation')
    } else if (phase !== 'failed') {
      this.current = this.record(phase)
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    const child = this.child
    this.child = undefined
    if (child !== undefined) await child.dispose()
  }

  private record(phase: ContainedPluginPhase, detail?: string): ContainedPluginRecord {
    return {
      entryId: this.entryId,
      moduleName: this.config.plugin,
      phase,
      ...(detail === undefined ? {} : { diagnostic: detail }),
      retryable: phase === 'failed' && !this.disposed,
    }
  }

  private run(): Promise<ContainedPluginRecord> {
    if (this.disposed) {
      return Promise.reject(new Error(`plugin fault boundary: entry ${JSON.stringify(this.entryId)} is disposed`))
    }
    if (this.running !== undefined) return this.running
    this.running = this.attempt().finally(() => { this.running = undefined })
    return this.running
  }

  private async attempt(): Promise<ContainedPluginRecord> {
    const previous = this.child
    this.child = undefined
    if (previous !== undefined) await previous.dispose()
    this.current = this.record('loading')

    try {
      const entry = this.ctx.fiber.entry
      if (entry === undefined) {
        throw new Error('boundary must be mounted by the Cordis Loader')
      }
      const imported: unknown = await entry.parent.tree.import(this.config.plugin, entry.getOuterStack)
      if (this.disposed) throw new Error('boundary was disposed during plugin import')
      const plugin = this.ctx.loader.unwrapExports(imported) as Plugin
      const child = this.ctx.plugin(plugin, this.config.config)
      this.child = child
      await child.await()
      this.observe(child)
    } catch (error) {
      const child = this.child
      this.child = undefined
      if (child !== undefined) await child.dispose().catch(() => undefined)
      const detail = diagnostic(error)
      this.current = this.record('failed', detail)
      this.ctx.logger.warn(
        `plugin fault boundary: ${this.config.plugin} failed in Loader entry ${this.entryId}: ${detail}`,
        error,
      )
    }
    return this.snapshot()
  }
}

/** Mount and contain the configured optional plugin. */
export async function apply(ctx: Context, rawConfig?: Config): Promise<void> {
  const config = normalizeConfig(rawConfig)
  const entryId = ctx.fiber.entry?.id
  if (entryId === undefined) throw new Error('plugin fault boundary: boundary must be mounted by the Cordis Loader')

  const controller = new Controller(ctx, entryId, config)
  const detach = ctx.pluginFaults.attach(entryId, controller)
  ctx.on('internal/status', (fiber) => { controller.observe(fiber) })
  ctx.effect(() => async () => {
    detach()
    await controller.dispose()
  }, `plugin-fault-boundary.dispose(${JSON.stringify(entryId)})`)
  await controller.start()
}
