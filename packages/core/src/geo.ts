import type { Countries, CountryId, Point } from './countries.ts'

const radius = 6371.0088
const radians = (degrees: number): number => degrees * Math.PI / 180

export function distance(left: Point, right: Point): number {
  const lat = radians(right[0] - left[0])
  const lon = radians(right[1] - left[1])
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(left[0])) * Math.cos(radians(right[0])) * Math.sin(lon / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function span(index: Countries, trail: readonly CountryId[]): number {
  let total = 0
  for (let step = 1; step < trail.length; step++) {
    const left = index.byId.get(trail[step - 1] as CountryId)
    const right = index.byId.get(trail[step] as CountryId)
    if (!left || !right) throw new RangeError(`unknown country in trail at step ${step}`)
    total += distance(left.centroid, right.centroid)
  }
  return total
}
