import { describe, expect, it } from 'vitest'
import { CONTROL_TOKEN_HEADER, isAuthorizedApiRequest } from '../src/api-request-auth.ts'

const TOKEN = 'desktop-control-token-with-at-least-32-characters'

describe('API control credential', () => {
  it('keeps unconfigured browser deployments compatible', () => {
    expect(isAuthorizedApiRequest({ headers: new Headers() }, undefined)).toBe(true)
  })

  it('accepts only the complete configured token', () => {
    expect(isAuthorizedApiRequest({
      headers: new Headers({ [CONTROL_TOKEN_HEADER]: TOKEN }),
    }, TOKEN)).toBe(true)
    expect(isAuthorizedApiRequest({
      headers: new Headers({ [CONTROL_TOKEN_HEADER]: `${TOKEN}-wrong` }),
    }, TOKEN)).toBe(false)
    expect(isAuthorizedApiRequest({ headers: new Headers() }, TOKEN)).toBe(false)
  })
})
