import { defineConfig } from 'tsdown'

/** Bundle the Electron main process and its sandbox-compatible preload separately. */
export default defineConfig([
  {
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
  },
  {
    entry: ['src/pet-preload.mjs'],
    outDir: 'lib',
    format: ['cjs'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: ['electron'],
    },
  },
])
