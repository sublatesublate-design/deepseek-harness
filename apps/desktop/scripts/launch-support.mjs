/** Process options shared by the desktop source launcher and its tests. */

/**
 * Keep Electron's GUI process eligible to present a Windows top-level window.
 *
 * @param {{ cwd: string, environment: NodeJS.ProcessEnv }} options Launch inputs.
 * @returns {import('node:child_process').SpawnOptions} Electron spawn options.
 */
export function electronSpawnOptions({ cwd, environment }) {
  return {
    cwd,
    env: environment,
    stdio: 'inherit',
    windowsHide: false,
  }
}
