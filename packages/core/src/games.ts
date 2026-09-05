import { accepts, answers, normalize } from './answers.ts'
import type { Countries, Country, CountryId } from './countries.ts'
import { pick, seeded, shuffle, type Rng } from './rng.ts'
import type { Scope } from './scopes.ts'

export type Topic = 'flag' | 'population' | 'size' | 'capital' | 'language' | 'border'
export type QuestionKind = 'choice' | 'text' | 'tiles' | 'compare' | 'dial'

export interface Question {
  readonly id: string
  readonly kind: QuestionKind
  readonly topic: Topic
  readonly prompt: string
  readonly target: CountryId
  readonly answer: string
  readonly options: readonly string[]
  readonly letters: readonly string[]
  readonly flag?: CountryId
  readonly value?: number
  readonly unit?: string
  readonly note?: string
}

export interface PublicQuestion {
  readonly id: string
  readonly kind: QuestionKind
  readonly topic: Topic
  readonly prompt: string
  readonly options: readonly string[]
  readonly letters: readonly string[]
  readonly flag?: string
  readonly unit?: string
  readonly note?: string
}

export interface Reveal {
  readonly answer: string
  readonly value?: number
  readonly unit?: string
}

export interface DeckOptions {
  readonly mode: string
  readonly seed: string | number
  readonly count?: number
  readonly scope?: Scope | readonly CountryId[]
}

const isscope = (value: Scope | readonly CountryId[]): value is Scope => !Array.isArray(value)
const ids = (index: Countries, selected?: Scope | readonly CountryId[]): readonly CountryId[] => !selected ? index.all.map(item => item.id) : isscope(selected) ? selected.countries : selected
const pool = (index: Countries, selected?: Scope | readonly CountryId[]): Country[] => ids(index, selected).map(id => index.byId.get(id)).filter((item): item is Country => Boolean(item))
const usable = (items: readonly Country[], field: 'population' | 'area' | 'capital' | 'languages') => items.filter(item => field === 'languages' ? item.languages.length : Boolean(item[field]))
const choices = (items: readonly Country[], target: Country, rng: Rng, label: (item: Country) => string = item => item.name): string[] => shuffle([target, ...shuffle(items.filter(item => item.id !== target.id), rng).slice(0, 3)].map(label), rng)
const letters = (value: string, rng: Rng): string[] => shuffle([...value.toUpperCase()].filter(char => /[A-Z]/.test(char)), rng)
const question = (id: string, kind: QuestionKind, topic: Topic, prompt: string, target: Country, answer: string, options: readonly string[] = [], extra: Partial<Question> = {}): Question => Object.freeze({ ...extra, id, kind, topic, prompt, target: target.id, answer, options: Object.freeze([...options]), letters: Object.freeze(extra.letters ? [...extra.letters] : []) })

function flag(items: Country[], rng: Rng, id: string, kind: 'choice' | 'text' | 'tiles'): Question {
  const target = pick(rng, items)
  const options = kind === 'choice' ? choices(items, target, rng) : []
  return question(id, kind, 'flag', kind === 'tiles' ? 'Build the country shown by this flag' : 'Which country flies this flag?', target, target.name, options, { flag: target.id, letters: kind === 'tiles' ? letters(target.name, rng) : [] })
}

function compare(items: Country[], rng: Rng, id: string, topic: 'population' | 'size'): Question {
  const field = topic === 'population' ? 'population' : 'area'
  const available = usable(items, field)
  const pair = shuffle(available, rng).slice(0, 2)
  const target = [...pair].sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))[0]!
  return question(id, 'compare', topic, topic === 'population' ? 'Which country has more people?' : 'Which country covers more land?', target, target.name, pair.map(item => item.name), { value: target[field]!, unit: topic === 'population' ? 'people' : 'km²' })
}

function dial(items: Country[], rng: Rng, id: string): Question {
  const target = pick(rng, usable(items, 'population'))
  return question(id, 'dial', 'population', `Estimate the population of ${target.name}`, target, String(target.population), [], { value: target.population!, unit: 'people', note: 'Within 30% counts as correct' })
}

function fact(items: Country[], rng: Rng, id: string, topic: 'capital' | 'language' | 'border', tiles = false): Question {
  if (topic === 'capital') {
    const available = usable(items, 'capital')
    const target = pick(rng, available)
    const answer = target.capital!
    return question(id, tiles ? 'tiles' : 'choice', topic, `What is the capital of ${target.name}?`, target, answer, tiles ? [] : choices(available, target, rng, item => item.capital!), { letters: tiles ? letters(answer, rng) : [] })
  }
  if (topic === 'language') {
    const available = usable(items, 'languages')
    const target = pick(rng, available)
    const answer = pick(rng, target.languages)
    const labels = [...new Set(available.flatMap(item => item.languages))]
    return question(id, 'choice', topic, `Which language is official in ${target.name}?`, target, answer, shuffle([answer, ...shuffle(labels.filter(item => !target.languages.includes(item)), rng).slice(0, 3)], rng))
  }
  const available = items.filter(item => item.neighbours.some(id => items.some(other => other.id === id)))
  const target = pick(rng, available)
  const linked = target.neighbours.map(id => items.find(item => item.id === id)).filter((item): item is Country => Boolean(item))
  const answer = pick(rng, linked)
  const wrong = items.filter(item => item.id !== target.id && !target.neighbours.includes(item.id))
  return question(id, 'choice', topic, `Which country shares a land border with ${target.name}?`, answer, answer.name, choices(wrong, answer, rng))
}

const modes: Readonly<Record<string, readonly string[]>> = {
  'daily-choice': ['flag-choice'],
  'daily-world-choice': ['flag-choice', 'capital', 'language', 'border'],
  'daily-chance': ['flag-text'],
  'daily-world-scramble': ['flag-tiles', 'capital-tiles', 'population', 'border', 'language'],
  'ranked-choice': ['flag-choice'],
  'ranked-chance': ['flag-choice', 'flag-text', 'population', 'size', 'capital', 'language', 'border'],
  'ranked-flags-scramble': ['flag-tiles'],
  'casual-choice': ['flag-choice'],
  'casual-chance': ['flag-choice', 'flag-text', 'population', 'size', 'capital', 'language', 'border'],
  'casual-world': ['flag-choice', 'flag-text', 'flag-tiles', 'capital', 'capital-tiles', 'language', 'border', 'population', 'size', 'dial'],
  'casual-flags-scramble': ['flag-tiles', 'flag-choice'],
  'casual-population-scramble': ['population', 'dial'],
  'casual-border-scramble': ['border', 'border', 'flag-tiles'],
  'casual-capital-scramble': ['capital', 'capital-tiles'],
  'casual-world-scramble': ['flag-tiles', 'capital-tiles', 'population', 'size', 'language', 'border'],
  'casual-population': ['population'],
  'casual-sizes': ['size'],
  'casual-capitals': ['capital'],
  'casual-languages': ['language'],
  'casual-borders': ['border'],
}

export function deck(index: Countries, options: DeckOptions): readonly Question[] {
  const items = pool(index, options.scope)
  if (items.length < 4) throw new RangeError('question scope needs at least four countries')
  const pattern = modes[options.mode]
  if (!pattern) throw new RangeError(`unknown question mode: ${options.mode}`)
  const rng = seeded(options.seed)
  const count = options.count ?? (options.mode.startsWith('ranked-') ? 120 : options.mode === 'casual-world' ? 100 : options.mode === 'daily-choice' ? 43 : 10)
  return Object.freeze(Array.from({ length: count }, (_, position) => {
    const type = pattern[position % pattern.length]!
    const id = `${options.mode}:${position}`
    if (type.startsWith('flag-')) return flag(items, rng, id, type.slice(5) as 'choice' | 'text' | 'tiles')
    if (type === 'population' || type === 'size') return compare(items, rng, id, type)
    if (type === 'dial') return dial(items, rng, id)
    if (type === 'capital-tiles') return fact(items, rng, id, 'capital', true)
    return fact(type === 'border' && !items.some(item => item.neighbours.some(id => items.some(other => other.id === id))) ? [...index.all] : items, rng, id, type as 'capital' | 'language' | 'border')
  }))
}

export function sanitize(item: Question, image?: string): PublicQuestion {
  const clean: PublicQuestion = {
    id: item.id,
    kind: item.kind,
    topic: item.topic,
    prompt: item.prompt,
    options: Object.freeze([...item.options]),
    letters: Object.freeze([...item.letters]),
    ...(item.flag && image ? { flag: image } : {}),
    ...(item.unit ? { unit: item.unit } : {}),
    ...(item.note ? { note: item.note } : {}),
  }
  return Object.freeze(clean)
}

export function reveal(item: Question): Reveal {
  return Object.freeze({ answer: item.answer, ...(item.value === undefined ? {} : { value: item.value }), ...(item.unit ? { unit: item.unit } : {}) })
}

export function points(correct: boolean, ms: number): number {
  if (!correct) return 0
  const elapsed = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 60_000
  return Math.max(100, 1000 - Math.floor(elapsed / 10))
}

export function validate(index: Countries, item: Question, input: string | number): boolean {
  if (item.kind === 'dial') {
    const guess = Number(input)
    return Boolean(item.value && guess > 0 && Math.abs(Math.log(guess / item.value)) <= Math.log(1.3))
  }
  if (item.topic === 'flag' && item.kind === 'text') return accepts(answers(index), item.target, input)
  if (item.kind === 'tiles') {
    const guess = normalize(input).replaceAll(' ', '')
    if (item.topic === 'flag') return [...(answers(index).keys.get(item.target) ?? [])].some(key => key.replaceAll(' ', '') === guess)
    return normalize(item.answer).replaceAll(' ', '') === guess
  }
  return normalize(input) === normalize(item.answer)
}
