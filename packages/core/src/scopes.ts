import type { Countries, CountryId } from './countries.ts'

export type ScopeKind = 'world' | 'region' | 'subregion'

export interface Scope {
  readonly id: string
  readonly label: string
  readonly kind: ScopeKind
  readonly parent: string | null
  readonly countries: readonly CountryId[]
}

export interface ScopeOptions {
  readonly minimum?: number
}

export const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function scopes(index: Countries, options: ScopeOptions = {}): Scope[] {
  const minimum = options.minimum ?? 5
  if (!Number.isSafeInteger(minimum) || minimum < 1) throw new RangeError('minimum must be a positive integer')
  const list: Scope[] = [{ id: 'world', label: 'World', kind: 'world', parent: null, countries: index.all.map(item => item.id) }]
  for (const region of index.regions) {
    const members = index.all.filter(item => item.region === region)
    const id = `region:${slug(region)}`
    list.push({ id, label: region, kind: 'region', parent: null, countries: members.map(item => item.id) })
    for (const subregion of [...new Set(members.map(item => item.subregion))].sort()) {
      const subset = members.filter(item => item.subregion === subregion)
      if (subregion !== region && subset.length >= minimum) {
        list.push({ id: `subregion:${slug(subregion)}`, label: subregion, kind: 'subregion', parent: id, countries: subset.map(item => item.id) })
      }
    }
  }
  return list.map(item => Object.freeze({ ...item, countries: Object.freeze([...item.countries]) }))
}

export function scope(index: Countries, id = 'world', options?: ScopeOptions): Scope {
  const found = scopes(index, options).find(item => item.id === id)
  if (!found) throw new RangeError(`unknown scope: ${id}`)
  return found
}
