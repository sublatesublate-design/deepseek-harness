import { defineConfig } from 'tsdown'

/** Bundle the Electron main process while leaving the platform runtime external. */
export default defineConfig({
  entry: ['src/main.mjs'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: ['electron'],
  },
})
