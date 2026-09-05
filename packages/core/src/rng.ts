export type Rng = () => number

export function hash(value: string): number {
  let state = 2166136261
  for (let index = 0; index < value.length; index++) {
    state ^= value.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }
  return state >>> 0
}

export function mulberry(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ state >>> 15, 1 | state)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

export const seeded = (seed: string | number): Rng => mulberry(typeof seed === 'number' ? seed : hash(seed))

export function int(rng: Rng, limit: number): number {
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError('limit must be a positive integer')
  const value = rng()
  if (!(value >= 0 && value < 1)) throw new RangeError('rng must return a value in [0, 1)')
  return Math.floor(value * limit)
}

export function pick<T>(rng: Rng, values: readonly T[]): T {
  if (!values.length) throw new RangeError('cannot pick from an empty collection')
  return values[int(rng, values.length)] as T
}

export function shuffle<T>(values: readonly T[], rng: Rng): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(rng, index + 1)
    ;[copy[index], copy[other]] = [copy[other] as T, copy[index] as T]
  }
  return copy
}
