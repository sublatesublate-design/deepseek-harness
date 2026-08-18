/**
 * Browser-safe, zero-dependency loopback classification shared by the `/api`
 * Host fence, the socket-peer check, and the package's `ctx.connection` state.
 * The predicates stay package-internal; client plugins consume the derived
 * state through Cordis.
 */

/**
 * Whether a normalized URL hostname names the local loopback authority.
 * @param hostname - WHATWG URL hostname (IPv6 literals retain brackets).
 * @returns true for localhost, IPv6 loopback, or any IPv4 address in 127/8.
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  return isLoopbackIpv4(hostname)
}

/**
 * Whether a socket `remoteAddress` is a proven loopback peer.
 * @param address - Node `socket.remoteAddress` (IPv6 literals have no brackets;
 *   IPv4-mapped IPv6 uses the `::ffff:` prefix). `undefined` is not proven.
 * @returns true for IPv6 loopback, IPv4 127/8, or IPv4-mapped 127/8.
 */
export function isLoopbackRemoteAddress(address: string | undefined): boolean {
  if (address === undefined || address.length === 0) return false
  if (address === '::1') return true
  const mapped = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
  return isLoopbackIpv4(mapped)
}

/** Whether `value` is a dotted IPv4 address in 127/8. */
function isLoopbackIpv4(value: string): boolean {
  const parts = value.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}
