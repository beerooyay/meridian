import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { deck, scope as getscope, type Scope } from '@meridian/core'
import { exact, fail, json, off, rate } from '@/lib/api'
import { context, games, payload } from '@/lib/ranked'

export async function POST(request: Request) {
  const body = await json(request)
  if (!body || !exact(body, ['game', 'scope']) || typeof body.game !== 'string' || !games.has(body.game) || typeof body.scope !== 'string') return fail(400, 'invalid ranked config')
  const found = await context()
  if (!found) return off()
  if (!found.user || !found.index) return fail(401, 'login required')
  const blocked = await rate(request, [{ bucket: 'ranked-issue', value: found.user.id, count: 5, seconds: 60 }])
  if (blocked) return blocked
  let selected: Scope
  try {
    selected = getscope(found.index, body.scope)
  } catch {
    return fail(400, 'invalid scope')
  }
  const seed = randomBytes(32).toString('hex')
  const questions = deck(found.index, { mode: body.game, seed, count: 120, scope: selected })
  const now = new Date()
  const limit = new Date(now.valueOf() + 43_000)
  const season = await found.db.from('seasons').select('id,slug,ends').eq('active', true).lte('starts', now.toISOString()).gte('ends', limit.toISOString()).limit(1).maybeSingle()
  if (season.error) return fail(500, 'ranked season unavailable')
  if (!season.data) return fail(409, 'no active ranked season')
  const issued = await found.db.from('runs').insert({
    uid: found.user.id,
    game: body.game,
    mode: 'ranked',
    scope: selected.id,
    season: season.data.id,
    qcount: questions.length,
    seed,
    config: { deck: questions },
    issued: now.toISOString(),
    expires: limit.toISOString(),
  }).select('id').single()
  if (issued.error || !issued.data) return fail(500, 'ranked run could not be issued')
  const active = await found.db.from('runs').update({ state: 'active', started: now.toISOString() }).eq('id', issued.data.id).eq('state', 'issued').select('id,expires').single()
  if (active.error || !active.data) {
    await found.db.from('runs').update({ state: 'void' }).eq('id', issued.data.id).eq('state', 'issued')
    return fail(500, 'ranked run could not be activated')
  }
  return NextResponse.json({ run: active.data.id, season: season.data.slug, q: 1, qcount: questions.length, expires: active.data.expires, question: payload(questions[0]!, active.data.id, 1) })
}
