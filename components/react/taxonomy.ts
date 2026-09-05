export type Group = 'daily' | 'ranked' | 'casual'

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
  ['daily-choice', 'choice', 'forty-three flags. pick the right country from four options.', 'a shared set of forty-three flags with four answers each, same deck for everyone today. one attempt, scored on accuracy.', '43 questions'],
  ['daily-chance', 'chance', 'ten flags, no options. type the country name from memory.', 'today\'s ten flags in a shared order. type the country each flag belongs to. one attempt, scored on accuracy.', '1 attempt'],
  ['daily-dogleg', 'dogleg', 'travel between two countries by crossing land borders in the fewest hops. par is the true shortest path.', 'today\'s course runs the whole world. each hole gives you a start and a finish; move only through neighboring countries and try to match par. choose nine or eighteen holes.', 'golf scoring'],
  ['daily-world-choice', 'world choice', 'ten multiple-choice questions on capitals, borders, languages, and flags.', 'a shared deck mixing capitals, borders, languages, and flags, each with four answers. one attempt per day.', '10 questions'],
  ['daily-world-scramble', 'world scramble', 'ten mixed puzzles: letter tiles, population dials, capitals, and borders in one deck.', 'a shared medley across every question type. unscramble names, estimate populations, and connect capitals in one daily run.', '10 questions'],
] as const

const ranked = [
  ['ranked-choice', 'choice', 'sixty seconds of flags. pick the right country before time runs out.', 'answer as many flag prompts as you can before the clock expires. scoring is server-verified and ranks by season.', '60 seconds'],
  ['ranked-chance', 'chance', 'sixty seconds of mixed prompts with no options. type fast, type right.', 'a timed sequence of typed answers across flags, capitals, and countries. only finished runs count on the board.', '60 seconds'],
  ['ranked-flags-scramble', 'flags scramble', 'see a flag, rebuild the country name from shuffled letters before time runs out.', 'each flag comes with its name in scrambled tiles. tap letters in order to spell it. sixty seconds, ranked by score.', '60 seconds'],
] as const

const casual = [
  ['casual-choice', 'choice', 'flags. pick the right country from four options. no clock, no board.', 'ten flag prompts drawn from your chosen region, each with four answers. practice mode with local stats only.', 'untimed'],
  ['casual-chance', 'chance', 'typed answers across flags, capitals, and countries. no options to lean on.', 'a relaxed mix of prompts where you type the answer. minor typos are forgiven.', 'untimed'],
  ['casual-dogleg', 'dogleg', 'cross land borders from one country to another in as few hops as possible. par is the shortest route.', 'a freshly generated course in your chosen region. each hole is a start and finish; move only through neighbors and try to beat par. nine or eighteen holes.', 'golf scoring'],
  ['casual-population', 'population', 'two countries. which has more people? endless rounds.', 'straight head-to-head population comparisons until you stop.', 'endless'],
  ['casual-sizes', 'sizes', 'two countries. which covers more land? endless rounds.', 'head-to-head comparisons by total area. learn the true scale of the map.', 'endless'],
  ['casual-capitals', 'capitals', 'name the capital of a country, or the country of a capital. four options.', 'multiple-choice capitals in both directions, drawn from your chosen region.', 'endless'],
  ['casual-languages', 'languages', 'which language is official or widely spoken here? four options.', 'multiple-choice prompts on official and major languages by country.', 'endless'],
  ['casual-borders', 'borders', 'which of these four countries touches the one shown? endless rounds.', 'multiple-choice land-border questions. decoys come from the same region to keep it honest.', 'endless'],
  ['casual-world', 'world', 'every question type, dynamically mixed. three wrong answers ends the run.', 'a marathon deck drawing from every casual question type: flags, capitals, languages, borders, population, and size. up to one hundred questions, but three wrong answers ends your run.', '100 questions · 3 strikes'],
  ['casual-flags-scramble', 'flags scramble', 'see a flag, then spell the country from shuffled letter tiles.', 'each flag arrives with its name scrambled. tap the letters into order and check your spelling.', 'untimed'],
  ['casual-population-scramble', 'population scramble', 'compare two populations, then estimate a third on a logarithmic dial.', 'alternates head-to-head population comparisons with dial estimates from one thousand to two billion.', 'untimed'],
  ['casual-border-scramble', 'border scramble', 'which of these countries actually share a border? spot the true neighbors.', 'pick the real land neighbor from a set of plausible decoys drawn from the same region.', 'untimed'],
  ['casual-capital-scramble', 'capital scramble', 'spell a capital city from shuffled letters, given its country.', 'capital names arrive as scrambled tiles. rebuild them one letter at a time.', 'untimed'],
  ['casual-world-scramble', 'world scramble', 'every puzzle type mixed into one deck: tiles, dials, comparisons, and more.', 'a medley across letter tiles, population dials, capitals, languages, and borders from your selected region.', 'untimed'],
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

export const all = Object.values(modes).flat()
