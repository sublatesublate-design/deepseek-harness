import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable Loader-tree identity of one configured plugin entry. */
export type PluginEntryId = Branded<'PluginEntryId'>

/** Lifecycle state of an entry's root Fiber, or null when it has no live root Fiber. */
export type PluginFiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

/** Failure behavior selected by the configured Loader row. */
export type PluginFailurePolicy = 'fatal' | 'contained'

/** One non-group Loader entry exposed to trusted clients. */
export interface PluginInventoryEntry {
  readonly entryId: PluginEntryId
  /** Exact module specifier imported by the Loader entry. */
  readonly moduleName: string
  /** Effective Loader enablement, including disabled ancestor groups. */
  readonly enabled: boolean
  readonly fiberPhase: PluginFiberPhase
  /** Whether activation failure aborts composition or stays behind an explicit boundary. */
  readonly failurePolicy: PluginFailurePolicy
  /** Bounded failure detail for a contained plugin; absent for strict rows. */
  readonly diagnostic?: string
  /** Whether the contained plugin can currently be retried. */
  readonly retryable: boolean
}

/** Point-in-time inventory returned by the plugin inventory Remote. */
export interface PluginInventorySnapshot {
  readonly entries: readonly PluginInventoryEntry[]
}
