import type { Countries, CountryId } from './countries.ts'
import { bfs, graph, type Graph } from './graph.ts'
import { distance, span } from './geo.ts'
import { seeded, shuffle } from './rng.ts'
import type { Scope } from './scopes.ts'

export type Holes = 9 | 18
export type Tier = 'short' | 'medium' | 'long'

export interface DoglegOptions {
  readonly holes: Holes
  readonly seed: string | number
  readonly scope?: Scope | readonly CountryId[]
}

export interface DoglegPlan {
  readonly tier: Tier
  readonly target: number
}

interface Slot {
  readonly tier: Tier
  readonly minimum: number
  readonly maximum: number
}

export interface DoglegHole {
  readonly number: number
  readonly tier: Tier
  readonly from: CountryId
  readonly to: CountryId
  readonly path: readonly CountryId[]
  readonly parPath: readonly CountryId[]
  readonly par: number
  readonly distance: number
}

export interface DoglegCourse {
  readonly seed: string | number
  readonly holes: readonly DoglegHole[]
  readonly plan: readonly DoglegPlan[]
  readonly par: number
  readonly distance: number
  readonly totalPar: number
  readonly totalDistance: number
}

export type TrailIssue = 'empty' | 'unknown' | 'start' | 'end' | 'border'

export interface TrailProblem {
  readonly issue: TrailIssue
  readonly step: number
  readonly country?: CountryId
}

export interface TrailResult {
  readonly valid: boolean
  readonly reached: boolean
  readonly hops: number
  readonly distance: number
  readonly problems: readonly TrailProblem[]
}

interface Candidate {
  readonly from: CountryId
  readonly to: CountryId
  readonly path: readonly CountryId[]
  readonly par: number
}

const slots: Readonly<Record<Tier, Slot>> = Object.freeze({
  short: Object.freeze({ tier: 'short', minimum: 3, maximum: 5 }),
  medium: Object.freeze({ tier: 'medium', minimum: 6, maximum: 10 }),
  long: Object.freeze({ tier: 'long', minimum: 10, maximum: 18 }),
})

const pathfrom = (start: CountryId, end: CountryId, parent: ReadonlyMap<CountryId, CountryId>): CountryId[] => {
  const route = [end]
  let at = end
  while (at !== start) {
    at = parent.get(at) as CountryId
    route.push(at)
  }
  return route.reverse()
}

function candidates(source: Graph): Candidate[] {
  const found: Candidate[] = []
  for (let left = 0; left < source.ids.length; left++) {
    const from = source.ids[left] as CountryId
    const search = bfs(source, from)
    for (let right = left + 1; right < source.ids.length; right++) {
      const to = source.ids[right] as CountryId
      const par = search.distance.get(to)
      if (par === undefined || par < 3 || par > 18) continue
      found.push({ from, to, par, path: pathfrom(from, to, search.parent) })
    }
  }
  return found
}

const layout = (holes: Holes): Slot[] => {
  const factor = holes / 9
  return [
    ...Array<Slot>(5 * factor).fill(slots.short),
    ...Array<Slot>(3 * factor).fill(slots.medium),
    ...Array<Slot>(factor).fill(slots.long),
  ]
}

const isscope = (value: Scope | readonly CountryId[]): value is Scope => !Array.isArray(value)

const poolids = (index: Countries, selected?: Scope | readonly CountryId[]): readonly CountryId[] => {
  if (!selected) return index.all.map(item => item.id)
  return isscope(selected) ? selected.countries : selected
}

export class DoglegScopeError extends Error {
  readonly tier: Tier
  readonly needed: number
  readonly available: number

  constructor(group: Tier, needed: number, available: number) {
    super(`scope cannot fulfill ${group} tier: needs ${needed} endpoint pairs, found ${available}`)
    this.name = 'DoglegScopeError'
    this.tier = group
    this.needed = needed
    this.available = available
  }
}

export function dogleg(index: Countries, options: DoglegOptions): DoglegCourse {
  if (options.holes !== 9 && options.holes !== 18) throw new RangeError('dogleg supports 9 or 18 holes')
  const source = graph(index, poolids(index, options.scope))
  const bag = candidates(source)
  const needed: Record<Tier, number> = {
    short: options.holes === 9 ? 5 : 10,
    medium: options.holes === 9 ? 3 : 6,
    long: options.holes === 9 ? 1 : 2,
  }
  const rng = seeded(options.seed)
  const short = bag.filter(item => item.par >= 3 && item.par <= 5)
  const medium = bag.filter(item => item.par >= 6 && item.par <= 9)
  const tens = shuffle(bag.filter(item => item.par === 10), rng)
  const long = bag.filter(item => item.par >= 11 && item.par <= 18)
  if (short.length < needed.short) throw new DoglegScopeError('short', needed.short, short.length)
  const longtens = Math.max(0, needed.long - long.length)
  if (long.length + tens.length < needed.long) throw new DoglegScopeError('long', needed.long, long.length + tens.length)
  const longpool = [...long, ...tens.slice(0, longtens)]
  const mediumpool = [...medium, ...tens.slice(longtens)]
  if (mediumpool.length < needed.medium) throw new DoglegScopeError('medium', needed.medium, mediumpool.length)

  const schedule = shuffle(layout(options.holes), rng)
  const pools = new Map<Tier, Candidate[]>([
    ['short', shuffle(short, rng)],
    ['medium', shuffle(mediumpool, rng)],
    ['long', shuffle(longpool, rng)],
  ])
  const uses = new Map<CountryId, number>()
  const holes = schedule.map((slot, position): DoglegHole => {
    const pool = pools.get(slot.tier) as Candidate[]
    let lowest = Infinity
    for (const item of pool) lowest = Math.min(lowest, (uses.get(item.from) ?? 0) + (uses.get(item.to) ?? 0))
    const choices = pool.filter(item => (uses.get(item.from) ?? 0) + (uses.get(item.to) ?? 0) === lowest)
    const chosen = choices[0] as Candidate
    for (const other of pools.values()) {
      const index = other.indexOf(chosen)
      if (index >= 0) other.splice(index, 1)
    }
    uses.set(chosen.from, (uses.get(chosen.from) ?? 0) + 1)
    uses.set(chosen.to, (uses.get(chosen.to) ?? 0) + 1)
    const parPath = Object.freeze([...chosen.path])
    return Object.freeze({
      number: position + 1,
      tier: slot.tier,
      from: chosen.from,
      to: chosen.to,
      path: parPath,
      parPath,
      par: chosen.par,
      distance: span(index, chosen.path),
    })
  })
  const plan = holes.map(hole => Object.freeze({ tier: hole.tier, target: hole.par }))
  const totalPar = holes.reduce((total, hole) => total + hole.par, 0)
  const totalDistance = holes.reduce((total, hole) => total + hole.distance, 0)
  return Object.freeze({
    seed: options.seed,
    holes: Object.freeze(holes),
    plan: Object.freeze(plan),
    par: totalPar,
    distance: totalDistance,
    totalPar,
    totalDistance,
  })
}

export function trail(index: Countries, source: Graph, route: readonly CountryId[], from?: CountryId, to?: CountryId): TrailResult {
  const problems: TrailProblem[] = []
  if (!route.length) problems.push({ issue: 'empty', step: 0 })
  route.forEach((id, step) => {
    if (!index.byId.has(id) || !source.adj.has(id)) problems.push({ issue: 'unknown', step, country: id })
    if (step > 0 && source.adj.has(route[step - 1] as CountryId) && source.adj.has(id) && !source.adj.get(route[step - 1] as CountryId)!.includes(id)) {
      problems.push({ issue: 'border', step, country: id })
    }
  })
  if (route.length && from && route[0] !== from) problems.push({ issue: 'start', step: 0, country: route[0] as CountryId })
  if (route.length && to && route.at(-1) !== to) problems.push({ issue: 'end', step: route.length - 1, country: route.at(-1) as CountryId })
  let kilometers = 0
  for (let step = 1; step < route.length; step++) {
    const left = index.byId.get(route[step - 1] as CountryId)
    const right = index.byId.get(route[step] as CountryId)
    if (left && right) kilometers += distance(left.centroid, right.centroid)
  }
  return Object.freeze({
    valid: problems.length === 0,
    reached: Boolean(to && route.at(-1) === to),
    hops: Math.max(0, route.length - 1),
    distance: kilometers,
    problems: Object.freeze(problems),
  })
}

export function play(index: Countries, hole: DoglegHole, route: readonly CountryId[], scope?: Scope | readonly CountryId[]): TrailResult {
  return trail(index, graph(index, poolids(index, scope)), route, hole.from, hole.to)
}
