/** Optional bearer-style control credential for Host API requests. */

import { timingSafeEqual } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'

/** Header injected by the native desktop shell for its managed Host API. */
export const CONTROL_TOKEN_HEADER = 'x-dsh-control-token'

/** The request facts needed by the control-token check. */
interface ApiAuthRequest {
  headers: IncomingHttpHeaders | Headers
}

function header(headers: IncomingHttpHeaders | Headers, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

/**
 * Check the deployment's optional control credential without leaking prefix
 * equality through ordinary string comparison. An absent configured token
 * keeps browser-only `dsh web` deployments backward compatible.
 * @param request - Node HTTP or Fetch request carrying the optional credential.
 * @param expectedToken - deployment credential, or undefined to disable this layer.
 * @returns whether the request satisfies the configured credential policy.
 */
export function isAuthorizedApiRequest(request: ApiAuthRequest, expectedToken: string | undefined): boolean {
  if (expectedToken === undefined) return true
  const supplied = header(request.headers, CONTROL_TOKEN_HEADER)
  if (supplied === undefined) return false
  const expectedBytes = Buffer.from(expectedToken)
  const suppliedBytes = Buffer.from(supplied)
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
}
