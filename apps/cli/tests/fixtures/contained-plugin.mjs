const KEY = Symbol.for('@deepseek-ai/dsh:test:contained-plugin-attempts')

export function reset() {
  globalThis[KEY] = 0
}

export function attempts() {
  return globalThis[KEY] ?? 0
}

export function apply() {
  globalThis[KEY] = attempts() + 1
  if (attempts() === 1) throw new Error('real composition optional plugin failed')
}
