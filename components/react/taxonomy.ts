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
  ['daily-choice', 'Choice', 'Four answers, one clean decision.', 'Read the country prompt and choose the right answer from four options.', '10 questions'],
  ['daily-chance', 'Chance', 'Name each flag without a safety net.', 'Type the country flown by each flag in one shared daily run.', '1 attempt'],
  ['daily-dogleg', 'Dogleg', 'Navigate borders in as few moves as possible.', 'Plot a route between countries over shared land borders. Pick a short front nine or a full eighteen.', 'golf scoring'],
  ['daily-world-scramble', 'World Scramble', 'A deterministic world medley.', 'Solve letter tiles, comparisons, capitals, languages, and borders in one shared deck.', '10 questions'],
] as const

const ranked = [
  ['ranked-choice', 'Choice', 'Fast answers climb the table.', 'Choose the correct country before the clock expires and build a ranked score.', '60 seconds'],
  ['ranked-chance', 'Chance', 'Mixed prompts under pressure.', 'Adapt to a timed sequence of geography prompts and compete for the best score.', '60 seconds'],
  ['ranked-flags-scramble', 'Flags Scramble', 'Flags, letters, and a running clock.', 'Identify flags and rebuild their country names while every second counts.', '60 seconds'],
] as const

const casual = [
  ['casual-choice', 'Choice', 'Country knowledge at your pace.', 'Choose from four answers with no leaderboard pressure.', 'untimed'],
  ['casual-chance', 'Chance', 'A varied tour of the atlas.', 'Move through a relaxed mix of country facts and prompts.', 'untimed'],
  ['casual-flags-scramble', 'Flags Scramble', 'Turn flags into country names.', 'Recognize each flag, then rebuild the matching country name.', 'untimed'],
  ['casual-population-scramble', 'Population Scramble', 'Compare and estimate populations.', 'Alternate country comparisons with a smooth logarithmic population dial.', 'untimed'],
  ['casual-border-scramble', 'Border Scramble', 'Untangle neighboring countries.', 'Build valid groups and routes from countries that share borders.', 'untimed'],
  ['casual-capital-scramble', 'Capital Scramble', 'Match capitals back to their countries.', 'Rebuild capital and country pairings from a shuffled set.', 'untimed'],
  ['casual-world-scramble', 'World Scramble', 'The full map, mixed together.', 'Unscramble country names drawn from your selected scope.', 'untimed'],
  ['casual-dogleg', 'Dogleg', 'Play a generated course at your pace.', 'Navigate nine or eighteen generated holes and finish under the map’s true par.', 'golf scoring'],
  ['casual-population', 'Population', 'Which country has more people?', 'Compare two countries and choose the larger population.', 'endless'],
  ['casual-sizes', 'Sizes', 'Which country covers more ground?', 'Compare countries by total area and learn the scale of the map.', 'endless'],
  ['casual-capitals', 'Capitals', 'Cities to countries and back.', 'Connect capital cities with the countries they represent.', 'endless'],
  ['casual-languages', 'Languages', 'Follow the world through language.', 'Identify official and widely spoken languages by country.', 'endless'],
  ['casual-borders', 'Borders', 'Learn who touches whom.', 'Choose which countries share a land border.', 'endless'],
] as const

const make = (group: Group, rows: readonly (readonly [string, string, string, string, string])[]): Mode[] =>
  rows.map(([id, name, summary, detail, metric]) => ({ id, name, group, summary, detail, metric }))

export const modes: Record<Group, Mode[]> = {
  daily: make('daily', daily).map((mode) => mode.name === 'Dogleg' ? { ...mode, holes: [9, 18] as const } : mode),
  ranked: make('ranked', ranked).map((mode) => ({ ...mode, timed: true })),
  casual: make('casual', casual).map((mode) => mode.name === 'Dogleg' ? { ...mode, holes: [9, 18] as const } : mode),
}

export const all = Object.values(modes).flat()
