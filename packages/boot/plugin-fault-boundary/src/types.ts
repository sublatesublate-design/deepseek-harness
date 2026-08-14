/** Lifecycle phase of a plugin mounted behind the opt-in fault boundary. */
export type ContainedPluginPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'

/** Point-in-time status of one contained Loader entry. */
export interface ContainedPluginRecord {
  /** Loader id of the boundary row. */
  readonly entryId: string
  /** Module specifier imported inside the boundary. */
  readonly moduleName: string
  readonly phase: ContainedPluginPhase
  /** Bounded single-line failure detail safe to expose to trusted local clients. */
  readonly diagnostic?: string
  /** True only while the entry is failed and its boundary remains mounted. */
  readonly retryable: boolean
}

/** Configuration for the `./boundary` Loader plugin. */
export interface Config {
  /** Module specifier of the optional plugin to contain. */
  readonly plugin: string
  /** Configuration passed verbatim to the contained plugin. */
  readonly config?: unknown
}
