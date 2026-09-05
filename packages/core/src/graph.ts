import type { Countries, CountryId } from './countries.ts'

export interface Graph {
  readonly ids: readonly CountryId[]
  readonly adj: ReadonlyMap<CountryId, readonly CountryId[]>
}

export interface Search {
  readonly start: CountryId
  readonly distance: ReadonlyMap<CountryId, number>
  readonly parent: ReadonlyMap<CountryId, CountryId>
}

export function graph(index: Countries, pool: readonly CountryId[] = index.all.map(item => item.id)): Graph {
  const ids = [...new Set(pool)].sort()
  const allowed = new Set(ids)
  for (const id of ids) if (!index.byId.has(id)) throw new RangeError(`unknown country: ${id}`)
  const adj = new Map<CountryId, readonly CountryId[]>()
  for (const id of ids) {
    const item = index.byId.get(id)!
    adj.set(id, Object.freeze(item.neighbours.filter(next => allowed.has(next)).sort()))
  }
  return Object.freeze({ ids: Object.freeze(ids), adj })
}

export function bfs(source: Graph, start: CountryId): Search {
  if (!source.adj.has(start)) throw new RangeError(`start is outside graph: ${start}`)
  const distance = new Map<CountryId, number>([[start, 0]])
  const parent = new Map<CountryId, CountryId>()
  const queue = [start]
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head] as CountryId
    for (const next of source.adj.get(at) ?? []) {
      if (distance.has(next)) continue
      distance.set(next, (distance.get(at) as number) + 1)
      parent.set(next, at)
      queue.push(next)
    }
  }
  return Object.freeze({ start, distance, parent })
}

export function path(search: Search, end: CountryId): CountryId[] | null {
  if (!search.distance.has(end)) return null
  const route = [end]
  let at = end
  while (at !== search.start) {
    const previous = search.parent.get(at)
    if (!previous) return null
    route.push(previous)
    at = previous
  }
  return route.reverse()
}

export function shortest(source: Graph, start: CountryId, end: CountryId): CountryId[] | null {
  if (!source.adj.has(end)) throw new RangeError(`end is outside graph: ${end}`)
  return path(bfs(source, start), end)
}

export function components(source: Graph): CountryId[][] {
  const seen = new Set<CountryId>()
  const groups: CountryId[][] = []
  for (const id of source.ids) {
    if (seen.has(id)) continue
    const group = [...bfs(source, id).distance.keys()]
    for (const member of group) seen.add(member)
    groups.push(group)
  }
  return groups.sort((left, right) => right.length - left.length || left[0]!.localeCompare(right[0]!))
}

export const adjacent = (source: Graph, left: CountryId, right: CountryId): boolean =>
  source.adj.get(left)?.includes(right) ?? false
