/** Shared loopback-hostname semantics for the Host fence and browser UI. */

import { describe, expect, it } from 'vitest'
import { isLoopbackHostname, isLoopbackRemoteAddress } from '../src/loopback-hostname.ts'

describe('isLoopbackHostname', () => {
  it('accepts localhost, IPv6 loopback, and the whole IPv4 127/8 block', () => {
    for (const hostname of ['localhost', '[::1]', '127.0.0.1', '127.8.9.10', '127.255.255.255']) {
      expect(isLoopbackHostname(hostname)).toBe(true)
    }
  })

  it('refuses malformed and non-loopback hostnames', () => {
    for (const hostname of ['remote.localhost', '::1', '128.0.0.1', '127.0.0', '127.0.0.256', '127.0.0.-1']) {
      expect(isLoopbackHostname(hostname)).toBe(false)
    }
  })
})

describe('isLoopbackRemoteAddress', () => {
  it('accepts IPv6 loopback, IPv4 127/8, and IPv4-mapped 127/8', () => {
    for (const address of ['::1', '127.0.0.1', '127.8.9.10', '::ffff:127.0.0.1', '::ffff:127.255.255.255']) {
      expect(isLoopbackRemoteAddress(address)).toBe(true)
    }
  })

  it('refuses a missing, empty, or non-loopback peer', () => {
    for (const address of [undefined, '', '::', '128.0.0.1', '10.0.0.1', '::ffff:10.0.0.1', 'localhost']) {
      expect(isLoopbackRemoteAddress(address)).toBe(false)
    }
  })
})
