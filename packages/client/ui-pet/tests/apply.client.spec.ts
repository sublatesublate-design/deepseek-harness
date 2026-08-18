// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-pet/client'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-pet'
import { DeepSeekWhale } from '../src/client/DeepSeekWhale.tsx'

function source<T>(value: T) {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

describe('ui-pet apply', () => {
  it('registers one localized additive overlay and removes it on disposal', async () => {
    nodeApply()
    expect(inject).toEqual(['slots', 'sessions', 'locale'])
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', new LocaleRuntime(ctx))
    ctx.provide('sessions', {
      currentProvideInfo: source({ hooks: { session: source(undefined) } }),
    } as never)
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    })
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: { 'shell.overlay': { kind: 'list', scope: 'root' } },
    } as never, () => null)

    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const [entry] = slots.entries('shell.overlay')
    expect(entry?.component).toBe(DeepSeekWhale)
    expect(entry?.options.id).toBe('deepseek-whale')
    expect(entry?.locale).toBe('pet')
    const injected = (entry?.inject as () => { hooks: Record<string, unknown> })()
    expect(injected.hooks.petSession).toBeDefined()
    expect(injected.hooks.petEnvironment).toBeDefined()

    await fiber.dispose()
    expect(slots.entries('shell.overlay')).toHaveLength(0)
  })
})
