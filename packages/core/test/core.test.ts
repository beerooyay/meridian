import assert from 'node:assert/strict'
import test from 'node:test'
import { accepts, answers, bfs, countries, deck, dogleg, DoglegScopeError, graph, normalize, play, points, sanitize, shortest, validate, type CountryInput } from '../src/index.ts'

const chain = (size: number) => {
  const raw: CountryInput[] = Array.from({ length: size }, (_, index) => {
    const id = `C${String(index).padStart(2, '0')}`
    const id3 = `X${String(index).padStart(2, '0')}`
    const borders = [index > 0 ? `X${String(index - 1).padStart(2, '0')}` : '', index + 1 < size ? `X${String(index + 1).padStart(2, '0')}` : ''].filter(Boolean)
    return { id, id3, name: `Country ${index}`, region: 'Test', subregion: 'Test', borders, centroid: [0, -120 + index * 4] as const }
  })
  return countries(raw)
}

test('country indexing and canonical bfs are stable', () => {
  const index = chain(6)
  const map = graph(index)
  assert.deepEqual(shortest(map, 'C00', 'C05'), ['C00', 'C01', 'C02', 'C03', 'C04', 'C05'])
  assert.equal(bfs(map, 'C00').distance.get('C05'), 5)
  assert.deepEqual(index.byId.get('C02')?.neighbours, ['C01', 'C03'])
})

test('answer matching folds names but rejects another exact country', () => {
  const index = countries([
    { id: 'AT', id3: 'AUT', name: 'Austria', region: 'Europe', subregion: 'Central', centroid: [47.5, 14.5] },
    { id: 'AU', id3: 'AUS', name: 'Australia', region: 'Oceania', subregion: 'Australia', centroid: [-25, 133] },
    { id: 'CI', id3: 'CIV', name: "Côte d'Ivoire", region: 'Africa', subregion: 'West', centroid: [7.5, -5.5] },
  ])
  const book = answers(index)
  assert.equal(normalize("Côte d'Ivoire"), 'cote d ivoire')
  assert.equal(accepts(book, 'CI', 'Ivory Coast'), true)
  assert.equal(accepts(book, 'AU', 'Austria'), false)
  assert.equal(accepts(book, 'AU', 'Australlia'), true)
})

test('dogleg generates deterministic complete shuffled courses', () => {
  const index = chain(50)
  const first = dogleg(index, { holes: 18, seed: 'links' })
  const second = dogleg(index, { holes: 18, seed: 'links' })
  assert.deepEqual(first, second)
  assert.equal(first.holes.length, 18)
  assert.equal(first.holes.filter(hole => hole.tier === 'short').length, 10)
  assert.equal(first.holes.filter(hole => hole.tier === 'medium').length, 6)
  assert.equal(first.holes.filter(hole => hole.tier === 'long').length, 2)
  assert.equal(new Set(first.holes.map(hole => [hole.from, hole.to].sort().join(':'))).size, 18)
  assert.equal(first.totalPar, first.holes.reduce((sum, hole) => sum + hole.par, 0))
  assert.equal(first.totalDistance, first.holes.reduce((sum, hole) => sum + hole.distance, 0))
  for (const hole of first.holes) {
    assert.equal(hole.parPath.length - 1, hole.par)
    if (hole.tier === 'short') assert.ok(hole.par >= 3 && hole.par <= 5)
    if (hole.tier === 'medium') assert.ok(hole.par >= 6 && hole.par <= 10)
    if (hole.tier === 'long') assert.ok(hole.par >= 10 && hole.par <= 18)
  }
})

test('dogleg rejects an incapable scope instead of shortening it', () => {
  const index = chain(8)
  assert.throws(() => dogleg(index, { holes: 9, seed: 1 }), DoglegScopeError)
})

test('player trails report hops, distance, endpoints, and broken borders', () => {
  const index = chain(25)
  const course = dogleg(index, { holes: 9, seed: 'trail' })
  const hole = course.holes[0]!
  const result = play(index, hole, hole.path)
  assert.equal(result.valid, true)
  assert.equal(result.reached, true)
  assert.equal(result.hops, hole.par)
  assert.ok(Math.abs(result.distance - hole.distance) < 1e-9)
  const broken = play(index, hole, [hole.from, hole.to])
  if (hole.par > 1) assert.equal(broken.problems.some(problem => problem.issue === 'border'), true)
})

test('question decks are deterministic and validate shared payloads', () => {
  const index = chain(25)
  const first = deck(index, { mode: 'daily-choice', seed: 'today', count: 10 })
  const second = deck(index, { mode: 'daily-choice', seed: 'today', count: 10 })
  assert.deepEqual(first, second)
  assert.equal(first.length, 10)
  assert.equal(first.every(item => item.kind === 'choice' && item.options.length === 4), true)
  assert.equal(validate(index, first[0]!, first[0]!.answer), true)
  const payload = sanitize(first[0]!)
  assert.equal('target' in payload, false)
  assert.equal('answer' in payload, false)
  assert.equal('value' in payload, false)
  assert.equal('flag' in payload, false)
  assert.deepEqual(payload.options, first[0]!.options)
  const ranked = sanitize(first[0]!, '/api/ranked/flag?run=opaque&q=1')
  assert.equal(ranked.flag, '/api/ranked/flag?run=opaque&q=1')
  assert.equal(ranked.flag?.includes(first[0]!.target), false)
  assert.equal(points(true, 500), 950)
  assert.equal(points(false, 0), 0)
})

test('daily flag decks contain thirty questions without repeats when the scope permits', () => {
  const index = chain(40)
  for (const mode of ['daily-choice', 'daily-chance']) {
    const run = deck(index, { mode, seed: 'today' })
    assert.equal(run.length, 30)
    assert.equal(new Set(run.map(item => item.target)).size, 30)
  }
})

test('flag decks exhaust the scope before repeating a country', () => {
  const index = chain(8)
  const run = deck(index, { mode: 'ranked-choice', seed: 'cycle', count: 17 })
  assert.equal(new Set(run.slice(0, 8).map(item => item.target)).size, 8)
  assert.equal(new Set(run.slice(8, 16).map(item => item.target)).size, 8)
  assert.notEqual(run[7]!.target, run[8]!.target)
})

test('world survival deck mixes every question kind across a full hundred-question run', () => {
  const raw: CountryInput[] = chain(25).all.map((item, position) => ({
    ...item,
    population: 10_000 * (position + 1),
    area: 5_000 * (position + 1),
    capital: `Capital ${position}`,
    languages: [`Language ${position % 5}`],
  }))
  const index = countries(raw)
  const run = deck(index, { mode: 'casual-world', seed: 'survival' })
  assert.equal(run.length, 100)
  const kinds = new Set(run.map(item => item.kind))
  assert.ok(kinds.has('choice'))
  assert.ok(kinds.has('text'))
  assert.ok(kinds.has('tiles'))
  assert.ok(kinds.has('compare'))
  assert.ok(kinds.has('dial'))
})

test('population scramble preserves comparisons and logarithmic estimates', () => {
  const raw: CountryInput[] = chain(25).all.map((item, position) => ({ ...item, population: 10_000 * (position + 1) }))
  const index = countries(raw)
  const run = deck(index, { mode: 'casual-population-scramble', seed: 8, count: 4 })
  assert.deepEqual(run.map(item => item.kind), ['compare', 'dial', 'compare', 'dial'])
  const estimate = run[1]!
  assert.equal(validate(index, estimate, estimate.value!), true)
  assert.equal(validate(index, estimate, estimate.value! * 2), false)
})
