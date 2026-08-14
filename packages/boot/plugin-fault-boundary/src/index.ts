/** Opt-in activation containment registry for optional Cordis plugins. */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { ContainedPluginRecord } from './types.ts'

export type * from './types.ts'

interface BoundaryController {
  snapshot(): ContainedPluginRecord
  retry(): Promise<ContainedPluginRecord>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    pluginFaults: PluginFaultRegistry
  }
}

/** Registry consumed by boundary rows and trusted diagnostics surfaces. */
export class PluginFaultRegistry extends Service {
  private readonly controllers = new Map<string, BoundaryController>()

  constructor(ctx: Context) {
    super(ctx, 'pluginFaults')
  }

  /**
   * Return all live contained entries in registration order.
   * @returns Immutable snapshots of the live registrations.
   */
  list(): readonly ContainedPluginRecord[] {
    return [...this.controllers.values()].map(controller => controller.snapshot())
  }

  /**
   * Return one live contained entry.
   * @param entryId - owning Loader row id.
   * @returns the current snapshot, or undefined when no boundary owns the id.
   */
  get(entryId: string): ContainedPluginRecord | undefined {
    return this.controllers.get(entryId)?.snapshot()
  }

  /**
   * Retry one failed contained entry.
   * @param entryId - owning Loader row id.
   * @returns the target's settled status after the retry attempt.
   */
  async retry(entryId: string): Promise<ContainedPluginRecord> {
    const controller = this.controllers.get(entryId)
    if (controller === undefined) {
      throw new Error(`plugin fault boundary: unknown entry ${JSON.stringify(entryId)}`)
    }
    return controller.retry()
  }

  /**
   * Register the controller owned by one boundary row.
   * @param entryId - owning Loader row id.
   * @param controller - lifecycle controller created by the boundary wrapper.
   * @returns disposer that removes this exact registration.
   */
  attach(entryId: string, controller: BoundaryController): () => void {
    if (this.controllers.has(entryId)) {
      throw new Error(`plugin fault boundary: entry ${JSON.stringify(entryId)} is already registered`)
    }
    this.controllers.set(entryId, controller)
    return () => {
      if (this.controllers.get(entryId) === controller) this.controllers.delete(entryId)
    }
  }
}

export default PluginFaultRegistry
