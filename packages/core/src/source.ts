import { countries, type Countries, type CountryInput, type Point } from './countries.ts'

export interface CountrySource {
  readonly id: string
  readonly id3: string
  readonly name: string
  readonly official?: string
  readonly alt?: readonly string[]
  readonly region: string
  readonly subregion: string
  readonly borders?: readonly string[]
  readonly latlng: Point
  readonly pop?: number
  readonly area?: number
  readonly capital?: string
  readonly langs?: readonly string[]
}

export interface MeridianSource {
  readonly countries: readonly CountrySource[]
}

export function source(raw: MeridianSource): Countries {
  const input: CountryInput[] = raw.countries.map(item => ({
    id: item.id,
    id3: item.id3,
    name: item.name,
    region: item.region,
    subregion: item.subregion,
    centroid: item.latlng,
    ...(item.official === undefined ? {} : { official: item.official }),
    ...(item.alt === undefined ? {} : { alt: item.alt }),
    ...(item.borders === undefined ? {} : { borders: item.borders }),
    ...(item.pop === undefined ? {} : { population: item.pop }),
    ...(item.area === undefined ? {} : { area: item.area }),
    ...(item.capital === undefined ? {} : { capital: item.capital }),
    ...(item.langs === undefined ? {} : { languages: item.langs }),
  }))
  return countries(input)
}
