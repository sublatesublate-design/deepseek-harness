/** Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-pet`. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-pet'

/** Cordis companion plugin name. */
export const name = 'client-ui-pet-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** The package owns only browser-local animation and one disposable slot registration. */
const install: InvariantInstaller = () => {
  // No runtime invariant: browser state has no authoritative host relationship to inspect.
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
