export type CountryId = string

export type Point = readonly [number, number]

export interface CountryInput {
  readonly id: CountryId
  readonly id3: string
  readonly name: string
  readonly official?: string
  readonly alt?: readonly string[]
  readonly region: string
  readonly subregion: string
  readonly borders?: readonly string[]
  readonly centroid: Point
  readonly population?: number
  readonly area?: number
  readonly capital?: string
  readonly languages?: readonly string[]
}

export interface Country extends Omit<CountryInput, 'alt' | 'borders' | 'centroid' | 'languages'> {
  readonly alt: readonly string[]
  readonly borders: readonly string[]
  readonly centroid: Point
  readonly languages: readonly string[]
  readonly neighbours: readonly CountryId[]
}

export interface Countries {
  readonly all: readonly Country[]
  readonly byId: ReadonlyMap<CountryId, Country>
  readonly byId3: ReadonlyMap<string, Country>
  readonly regions: readonly string[]
  readonly subregions: readonly string[]
}

export interface CountryOptions {
  readonly mutual?: boolean
}

const clean = (value: string, field: string): string => {
  const next = value.trim()
  if (!next) throw new TypeError(`${field} must not be empty`)
  return next
}

export function countries(input: readonly CountryInput[], options: CountryOptions = {}): Countries {
  const mutual = options.mutual ?? true
  const byId = new Map<CountryId, CountryInput>()
  const byId3 = new Map<string, CountryInput>()
  for (const item of input) {
    const id = clean(item.id, 'country id')
    const id3 = clean(item.id3, 'country id3').toUpperCase()
    if (byId.has(id)) throw new Error(`duplicate country id: ${id}`)
    if (byId3.has(id3)) throw new Error(`duplicate country id3: ${id3}`)
    if (item.centroid.length !== 2 || !item.centroid.every(Number.isFinite)) {
      throw new TypeError(`invalid centroid for ${id}`)
    }
    if (Math.abs(item.centroid[0]) > 90 || Math.abs(item.centroid[1]) > 180) {
      throw new RangeError(`centroid out of range for ${id}`)
    }
    const normalized = { ...item, id, id3 }
    byId.set(id, normalized)
    byId3.set(id3, normalized)
  }

  const all = [...byId.values()].map((item): Country => {
    const links = new Set<CountryId>()
    for (const code of item.borders ?? []) {
      const other = byId3.get(code.toUpperCase())
      if (!other || other.id === item.id) continue
      if (mutual && !(other.borders ?? []).some(border => border.toUpperCase() === item.id3)) continue
      links.add(other.id)
    }
    return Object.freeze({
      ...item,
      alt: Object.freeze([...(item.alt ?? [])]),
      borders: Object.freeze([...(item.borders ?? [])]),
      centroid: Object.freeze([item.centroid[0], item.centroid[1]]) as Point,
      languages: Object.freeze([...(item.languages ?? [])]),
      neighbours: Object.freeze([...links].sort()),
    })
  })

  const indexed = new Map(all.map(country => [country.id, country] as const))
  const indexed3 = new Map(all.map(country => [country.id3, country] as const))
  const regions = [...new Set(all.map(country => country.region))].sort()
  const subregions = [...new Set(all.map(country => country.subregion))].sort()
  return Object.freeze({
    all: Object.freeze(all),
    byId: indexed,
    byId3: indexed3,
    regions: Object.freeze(regions),
    subregions: Object.freeze(subregions),
  })
}

export const country = (index: Countries, id: CountryId): Country => {
  const found = index.byId.get(id)
  if (!found) throw new RangeError(`unknown country: ${id}`)
  return found
}
