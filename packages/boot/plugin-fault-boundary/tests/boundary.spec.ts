import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import PluginFaultRegistry from '../src/index.ts'
import * as Boundary from '../src/boundary.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

async function harness(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Loader)
  await ctx.plugin(PluginFaultRegistry)
  ctx.loader.builtins.boundary = Boundary
  return ctx
}

describe('plugin fault boundary', () => {
  it('keeps its Loader row active when an optional plugin fails, then retries it', async () => {
    const ctx = await harness()
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => ctx.logger)
    let attempts = 0
    const flaky: Plugin.Function = () => {
      attempts += 1
      if (attempts === 1) throw new Error('fixture activation failed')
    }
    ctx.loader.builtins.flaky = flaky

    const entryId = await ctx.loader.create({
      name: 'cordis:boundary',
      config: { plugin: 'cordis:flaky' },
    })

    expect([...ctx.loader.entries()].find(entry => entry.id === entryId)?.fiber?.state).toBe(2)
    expect(ctx.pluginFaults.get(entryId)).toEqual({
      entryId,
      moduleName: 'cordis:flaky',
      phase: 'failed',
      diagnostic: 'fixture activation failed',
      retryable: true,
    })
    expect(warn.mock.calls[0]?.[0]).toEqual(expect.stringContaining('fixture activation failed'))

    await expect(ctx.pluginFaults.retry(entryId)).resolves.toEqual({
      entryId,
      moduleName: 'cordis:flaky',
      phase: 'active',
      retryable: false,
    })
    expect(attempts).toBe(2)
  })

  it('removes diagnostics with the owning Loader entry', async () => {
    const ctx = await harness()
    ctx.loader.builtins.optional = (() => {}) as Plugin.Function
    const entryId = await ctx.loader.create({
      name: 'cordis:boundary',
      config: { plugin: 'cordis:optional' },
    })
    expect(ctx.pluginFaults.get(entryId)?.phase).toBe('active')

    await ctx.loader.remove(entryId)
    expect(ctx.pluginFaults.get(entryId)).toBeUndefined()
    await expect(ctx.pluginFaults.retry(entryId)).rejects.toThrow('unknown entry')
  })

  it('does not weaken ordinary fail-loud Loader rows', async () => {
    const ctx = await harness()
    ctx.loader.builtins.strict = (() => { throw new Error('strict failure') }) as Plugin.Function
    await expect(ctx.loader.create({ name: 'cordis:strict' })).rejects.toThrow('strict failure')
    expect(ctx.pluginFaults.list()).toEqual([])
  })

  it('rejects malformed boundary configuration as a row failure', async () => {
    const ctx = await harness()
    await expect(ctx.loader.create({
      name: 'cordis:boundary',
      config: { plugin: '  ' },
    })).rejects.toThrow('config.plugin')
  })
})
