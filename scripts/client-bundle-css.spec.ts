/**
 * CSS and raster assets enter client bundles through virtual modules, so each
 * loader must register the underlying source as a watch dependency.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clientBundle } from '../packages/client/tsdown.client.ts'

interface AssetPlugin {
  name: string
  resolveId?: (source: string, importer?: string) => string | null
  load?: (this: { addWatchFile(id: string): void }, id: string) => Promise<string | null>
}

function pluginNamed(name: string): AssetPlugin {
  const configs = clientBundle(
    '@deepseek-ai/dsh-client-test',
    ['lib/types/index.js', 'lib/types/invariant.js'],
  )({ env: { DSH_BUILD_FACE: 'client' } })
  const client = configs.find(config => config.platform === 'browser')
  if (client === undefined) throw new Error('client config missing')
  const plugins = (client as { plugins: AssetPlugin[] }).plugins
  const plugin = plugins.find(candidate => candidate.name === name)
  if (plugin === undefined) throw new Error(`${name} missing from client config`)
  return plugin
}

function cssPlugin(): AssetPlugin {
  return pluginNamed('dsh-css-modules-inline')
}

describe('client bundle CSS Modules', () => {
  it('registers the source stylesheet as a watch dependency', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-client-css-watch-'))
    try {
      const stylesheet = join(root, 'Fixture.module.css')
      const importer = join(root, 'index.ts')
      await writeFile(stylesheet, '.root { color: red; }\n')
      const plugin = cssPlugin()
      const virtualId = plugin.resolveId?.('./Fixture.module.css', importer)
      if (typeof virtualId !== 'string' || plugin.load === undefined) {
        throw new Error('CSS Modules plugin hooks are incomplete')
      }
      const watched: string[] = []

      const output = await plugin.load.call({ addWatchFile: id => watched.push(id) }, virtualId)

      expect(watched).toEqual([stylesheet])
      expect(output).toContain('data-plugin-css')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('client bundle raster assets', () => {
  it('embeds a watched WebP source as a browser data URL', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-client-raster-watch-'))
    try {
      const asset = join(root, 'pet.webp')
      const importer = join(root, 'index.ts')
      await writeFile(asset, Uint8Array.of(82, 73, 70, 70))
      const plugin = pluginNamed('dsh-raster-assets-inline')
      const virtualId = plugin.resolveId?.('./pet.webp', importer)
      if (typeof virtualId !== 'string' || plugin.load === undefined) {
        throw new Error('raster asset plugin hooks are incomplete')
      }
      const watched: string[] = []

      const output = await plugin.load.call({ addWatchFile: id => watched.push(id) }, virtualId)

      expect(watched).toEqual([asset])
      expect(output).toContain('data:image/webp;base64,UklGRg==')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
