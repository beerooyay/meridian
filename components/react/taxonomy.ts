export type Group = 'daily' | 'ranked' | 'casual'
export type Format = 'best' | 'minute' | 'cycle'

export type Mode = {
  id: string
  name: string
  group: Group
  summary: string
  detail: string
  metric: string
  timed?: boolean
  holes?: readonly [9, 18]
}

const daily = [
  ['daily-choice', 'choice', 'guess as many flags as you can in thirty tries. multiple choice.', 'thirty flag prompts with four answers each, in the same order for everyone today. one attempt, scored on accuracy.', '30 questions'],
  ['daily-chance', 'chance', 'guess as many flags as you can in thirty tries. fill in the blank.', 'thirty flags in the same order for everyone today. type each country from memory with no options. one attempt, scored on accuracy.', '30 questions'],
  ['daily-dogleg', 'dogleg', 'travel between two countries by crossing land borders in the fewest hops. par is the true shortest path.', 'today\'s course runs the whole world. each hole gives you a start and a finish; move only through neighboring countries and try to match par. choose nine or eighteen holes.', 'golf scoring'],
] as const

const ranked = [
  ['ranked-choice', 'choice', 'sixty seconds of flags. pick the right country before time runs out.', 'answer as many flag prompts as you can before the clock expires. scoring is server-verified and ranks by season.', '60 seconds'],
  ['ranked-chance', 'chance', 'sixty seconds of mixed prompts with no options. type fast, type right.', 'a timed sequence of typed answers across flags, capitals, and countries. only finished runs count on the board.', '60 seconds'],
  ['ranked-flags-scramble', 'flags scramble', 'see a flag, rebuild the country name from shuffled letters before time runs out.', 'each flag comes with its name in scrambled tiles. tap letters in order to spell it. sixty seconds, ranked by score.', '60 seconds'],
] as const

const casual = [
  ['casual-choice', 'choice', 'guess flags from four possible countries. choose your scope and run format.', 'flag prompts drawn from your chosen region, each with four possible answers. play twenty-five questions, race one minute, or attempt the full cycle with three strikes.', 'custom run'],
  ['casual-chance', 'chance', 'answer mixed geography prompts without options. choose your scope and format.', 'type answers across flags, capitals, and countries from your chosen region. minor typos are forgiven.', 'custom run'],
  ['casual-dogleg', 'dogleg', 'cross land borders in the fewest hops. choose your scope and course length.', 'a freshly generated course in your chosen region. each hole is a start and finish; move only through neighbors and try to match par.', 'golf scoring'],
  ['casual-population', 'population', 'compare two countries and pick the one with more people.', 'head-to-head population comparisons from your chosen region, played in the run format you select.', 'custom run'],
  ['casual-sizes', 'sizes', 'compare two countries and pick the one covering more land.', 'head-to-head area comparisons from your chosen region. learn the true scale of the map.', 'custom run'],
  ['casual-capitals', 'capitals', 'match countries with their capital cities from four options.', 'multiple-choice capital prompts drawn from your chosen region and run format.', 'custom run'],
  ['casual-languages', 'languages', 'identify an official or widely spoken language from four options.', 'multiple-choice language prompts drawn from your chosen region and run format.', 'custom run'],
  ['casual-borders', 'borders', 'find the country that shares a real land border with the one shown.', 'multiple-choice border prompts with plausible decoys from the same region.', 'custom run'],
  ['casual-world', 'world', 'every geography question type mixed into one run.', 'a medley of flags, capitals, languages, borders, population, and size in your chosen scope and format.', 'custom run'],
  ['casual-flags-scramble', 'flags scramble', 'see a flag, then rebuild its country from shuffled letters.', 'tap shuffled letters into order to name flags from your chosen region and run format.', 'custom run'],
  ['casual-population-scramble', 'population scramble', 'compare populations and estimate them on a logarithmic dial.', 'alternates head-to-head comparisons with estimates from one thousand to two billion.', 'custom run'],
  ['casual-border-scramble', 'border scramble', 'spot real neighboring countries among plausible decoys.', 'find true land neighbors using countries from your selected region and run format.', 'custom run'],
  ['casual-capital-scramble', 'capital scramble', 'rebuild capital cities from shuffled letters.', 'spell capitals one letter at a time using your selected region and run format.', 'custom run'],
  ['casual-world-scramble', 'world scramble', 'tiles, dials, comparisons, and more mixed into one run.', 'a medley of letter tiles, population dials, capitals, languages, and borders.', 'custom run'],
] as const

const make = (group: Group, rows: readonly (readonly [string, string, string, string, string])[]): Mode[] =>
  rows.map(([id, name, summary, detail, metric]) => ({ id, name, group, summary, detail, metric }))

export const modes: Record<Group, Mode[]> = {
  daily: make('daily', daily).map((mode) => mode.name === 'dogleg' ? { ...mode, holes: [9, 18] as const } : mode),
  ranked: make('ranked', ranked).map((mode) => ({ ...mode, timed: true })),
  casual: make('casual', casual).map((mode) => mode.name === 'dogleg' ? { ...mode, holes: [9, 18] as const } : mode),
}

export const scrambles = (group: Group) => modes[group].filter((mode) => mode.id.endsWith('-scramble'))
export const core = (group: Group) => modes[group].filter((mode) => !mode.id.endsWith('-scramble'))
