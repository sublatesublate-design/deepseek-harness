/** Projection and bounded recovery of current Cordis Loader plugin entries. */

import type { Context, FiberState } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-plugin-fault-boundary'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  PluginEntryId,
  PluginFiberPhase,
  PluginInventoryEntry,
  PluginInventorySnapshot,
} from './types.ts'

export type * from './types.ts'

/** Brand an existing Loader-tree entry id at the owning boundary. */
function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, PluginFiberPhase>

/** Remote-only service exposing Loader state and contained-entry retry. */
export class PluginInventoryGateway extends TypertRemoteService {
  static inject = ['loader']

  constructor(ctx: Context) {
    super(ctx, 'pluginInventory')
  }

  /**
   * Read the Loader directly on every call. Cordis's internal plugin/status
   * events already maintain Entry.fiber and Fiber.state, so a second cache
   * would only add another lifecycle truth to keep synchronized.
   * @returns Current non-group Loader entries in Loader order.
   */
  @Remote('list')
  list(): PluginInventorySnapshot {
    const entries: PluginInventoryEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      entries.push(this.project(entry))
    }
    return { entries }
  }

  /**
   * Retry one failed entry mounted behind the opt-in fault boundary.
   * @param entryId - Loader id returned by {@link list}.
   * @returns the updated projected row after the retry settles.
   */
  @Remote('retry')
  async retry(entryId: PluginEntryId): Promise<PluginInventoryEntry> {
    const faults = this.ctx.get('pluginFaults')
    if (faults === undefined) throw new Error('pluginInventory.retry: plugin fault registry is unavailable')
    await faults.retry(entryId)
    const entry = [...this.ctx.loader.entries()].find(candidate => candidate.id === entryId)
    if (entry === undefined || entry.options.group) {
      throw new Error(`pluginInventory.retry: Loader entry ${JSON.stringify(entryId)} is unavailable`)
    }
    return this.project(entry)
  }

  /** Project one non-group Loader entry, replacing a live boundary with its target. */
  private project(entry: Entry): PluginInventoryEntry {
    const faults = this.ctx.get('pluginFaults')
    const contained = faults?.get(entry.id)
    if (contained !== undefined) {
      return {
        entryId: pluginEntryId(entry.id),
        moduleName: contained.moduleName,
        enabled: !entry.disabled,
        fiberPhase: contained.phase,
        failurePolicy: 'contained',
        ...(contained.diagnostic === undefined ? {} : { diagnostic: contained.diagnostic }),
        retryable: contained.retryable,
      }
    }
    return {
      entryId: pluginEntryId(entry.id),
      moduleName: entry.options.name,
      enabled: !entry.disabled,
      fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
      failurePolicy: 'fatal',
      retryable: false,
    }
  }
}

export default PluginInventoryGateway
