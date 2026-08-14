import { afterEach, describe, expect, it } from 'vitest'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import PluginFaultRegistry from '../../../boot/plugin-fault-boundary/src/index.ts'
import * as FaultBoundary from '../../../boot/plugin-fault-boundary/src/boundary.ts'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import PluginInventoryGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

const activePlugin: Plugin.Function = () => {}
const pendingPlugin: Plugin.Object = {
  inject: ['neverReady'],
  apply() {},
}

async function harness(): Promise<{
  ctx: Context
  inventory: PluginInventoryGateway
}> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Loader)
  await ctx.plugin(PluginFaultRegistry)
  ctx.loader.builtins.active = activePlugin
  ctx.loader.builtins.pending = pendingPlugin
  ctx.loader.builtins.boundary = FaultBoundary
  await ctx.plugin(PluginInventoryGateway)
  const inventory = ctx.get('pluginInventory') as PluginInventoryGateway
  return { ctx, inventory }
}

describe('PluginInventoryGateway', () => {
  it('publishes one direct list method under the pluginInventory namespace', async () => {
    const { inventory } = await harness()
    expect(inventory.typertRemote).toMatchObject({
      serviceKey: 'pluginInventory',
      namespace: 'pluginInventory',
    })
    expect(remoteMethods(inventory)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'retry', invocation: { kind: 'direct' } },
    ])
  })

  it('projects current non-group Loader entries without a second cache', async () => {
    const { ctx, inventory } = await harness()
    const activeId = await ctx.loader.create({ name: 'cordis:active' })
    const pendingId = await ctx.loader.create({ name: 'cordis:pending' })
    const disabledId = await ctx.loader.create({
      name: 'cordis:not-installed',
      disabled: true,
    })
    await ctx.loader.create({ name: 'cordis:active', group: true })

    const snapshot = inventory.list()
    expect(snapshot.entries).toHaveLength(3)
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      {
        entryId: activeId,
        moduleName: 'cordis:active',
        enabled: true,
        fiberPhase: 'active',
        failurePolicy: 'fatal',
        retryable: false,
      },
      {
        entryId: pendingId,
        moduleName: 'cordis:pending',
        enabled: true,
        fiberPhase: 'pending',
        failurePolicy: 'fatal',
        retryable: false,
      },
      {
        entryId: disabledId,
        moduleName: 'cordis:not-installed',
        enabled: false,
        fiberPhase: null,
        failurePolicy: 'fatal',
        retryable: false,
      },
    ]))

    await ctx.loader.update(activeId, { disabled: true })
    expect(inventory.list().entries.find(entry => entry.entryId === activeId)).toEqual({
      entryId: activeId,
      moduleName: 'cordis:active',
      enabled: false,
      fiberPhase: null,
      failurePolicy: 'fatal',
      retryable: false,
    })

    await ctx.loader.remove(pendingId)
    expect(inventory.list().entries.some(entry => entry.entryId === pendingId)).toBe(false)
  })

  it('projects contained failures as their target and exposes bounded retry', async () => {
    const { ctx, inventory } = await harness()
    let attempts = 0
    ctx.loader.builtins.flaky = (() => {
      attempts += 1
      if (attempts === 1) throw new Error('optional activation failed')
    }) as Plugin.Function
    const entryId = await ctx.loader.create({
      name: 'cordis:boundary',
      config: { plugin: 'cordis:flaky' },
    })

    expect(inventory.list().entries).toContainEqual({
      entryId,
      moduleName: 'cordis:flaky',
      enabled: true,
      fiberPhase: 'failed',
      failurePolicy: 'contained',
      diagnostic: 'optional activation failed',
      retryable: true,
    })
    await expect(inventory.retry(entryId as never)).resolves.toEqual({
      entryId,
      moduleName: 'cordis:flaky',
      enabled: true,
      fiberPhase: 'active',
      failurePolicy: 'contained',
      retryable: false,
    })
    expect(attempts).toBe(2)
  })
})
