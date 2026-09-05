import type { Countries, Country, CountryId } from './countries.ts'

const filler = /\b(the|of|republic|democratic|federal|kingdom|state|states|people|peoples|islamic|commonwealth|principality|grand|duchy|sultanate|plurinational|bolivarian)\b/g

export const aliases: Readonly<Record<CountryId, readonly string[]>> = Object.freeze({
  US: ['usa', 'us', 'america', 'the us', 'united states of america'],
  GB: ['uk', 'britain', 'great britain', 'england'],
  AE: ['uae', 'emirates'],
  CD: ['drc', 'dr congo', 'congo kinshasa', 'zaire', 'democratic republic of congo'],
  CG: ['congo brazzaville', 'republic of congo'],
  NL: ['holland'],
  MM: ['burma'],
  CI: ['ivory coast'],
  CV: ['cape verde'],
  SZ: ['swaziland'],
  CZ: ['czech republic', 'czech'],
  MK: ['macedonia'],
  TL: ['east timor'],
  VA: ['vatican', 'holy see'],
  PS: ['palestine'],
  KR: ['south korea', 'korea south', 'republic of korea'],
  KP: ['north korea', 'korea north', 'dprk'],
  TR: ['turkey', 'turkiye'],
  RU: ['russia'],
  SY: ['syria'],
  LA: ['laos'],
  BO: ['bolivia'],
  TZ: ['tanzania'],
  VE: ['venezuela'],
  IR: ['iran', 'persia'],
  DO: ['dominican rep'],
  CF: ['car', 'central african rep'],
  ZA: ['south africa', 'rsa'],
})

export interface Answers {
  readonly keys: ReadonlyMap<CountryId, ReadonlySet<string>>
  readonly owners: ReadonlyMap<string, ReadonlySet<CountryId>>
}

export function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function core(value: unknown): string {
  const plain = normalize(value)
  return plain.replace(filler, ' ').replace(/\s+/g, ' ').trim() || plain
}

const forms = (value: unknown): string[] => {
  const plain = normalize(value)
  return plain ? [...new Set([plain, core(plain)])].filter(item => item.length > 1) : []
}

const cache = new WeakMap<Countries, Answers>()
export function answers(index: Countries, extra: Readonly<Record<CountryId, readonly string[]>> = aliases): Answers {
  if (extra === aliases) { const hit = cache.get(index); if (hit) return hit }
  const keys = new Map<CountryId, ReadonlySet<string>>()
  const owners = new Map<string, Set<CountryId>>()
  for (const item of index.all) {
    const names = [item.name, item.official ?? '', ...item.alt, ...(extra[item.id] ?? [])]
    const countryKeys = new Set(names.flatMap(forms))
    keys.set(item.id, countryKeys)
    for (const key of countryKeys) {
      const found = owners.get(key) ?? new Set<CountryId>()
      found.add(item.id)
      owners.set(key, found)
    }
  }
  const result = Object.freeze({ keys, owners })
  if (extra === aliases) cache.set(index, result)
  return result
}

function edits(left: string, right: string, ceiling = 2): number {
  if (left === right) return 0
  if (Math.abs(left.length - right.length) > ceiling) return ceiling + 1
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) {
      current[column] = Math.min(previous[column]! + 1, current[column - 1]! + 1, previous[column - 1]! + Number(left[row - 1] !== right[column - 1]))
    }
    previous = current
  }
  return previous[right.length] as number
}

export function accepts(book: Answers, target: Country | CountryId, input: unknown): boolean {
  const id = typeof target === 'string' ? target : target.id
  const keys = book.keys.get(id)
  if (!keys) throw new RangeError(`country is not indexed for answers: ${id}`)
  for (const guess of forms(input)) {
    if (keys.has(guess)) return true
    const owners = book.owners.get(guess)
    if (owners && !owners.has(id)) continue
    for (const key of keys) {
      const tolerance = key.length >= 9 ? 2 : key.length >= 5 ? 1 : 0
      if (tolerance && edits(key, guess, tolerance) <= tolerance) return true
    }
  }
  return false
}

export function intended(book: Answers, input: unknown, exclude?: CountryId): CountryId | null {
  for (const guess of forms(input)) {
    const owners = book.owners.get(guess)
    if (!owners) continue
    const found = [...owners].sort().find(id => id !== exclude)
    if (found) return found
  }
  return null
}
