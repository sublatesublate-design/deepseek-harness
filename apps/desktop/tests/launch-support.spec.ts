/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { electronSpawnOptions } from '../scripts/launch-support.mjs'

describe('desktop process launch support', () => {
  it('does not hide the Electron GUI process on Windows', () => {
    const environment = { DSH_TEST: '1' }
    expect(electronSpawnOptions({ cwd: 'C:\\workspace\\apps\\desktop', environment })).toEqual({
      cwd: 'C:\\workspace\\apps\\desktop',
      env: environment,
      stdio: 'inherit',
      windowsHide: false,
    })
  })
})
