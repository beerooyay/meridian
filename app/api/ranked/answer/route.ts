import { NextResponse } from 'next/server'
import { reveal, validate, type Question } from '@meridian/core'
import { exact, fail, json, off, rate } from '@/lib/api'
import { context, identifier, input, loadflag, message, payload, question } from '@/lib/ranked'

export async function POST(request: Request) {
  const body = await json(request)
  if (!body || !exact(body, ['run', 'q', 'answer']) || !identifier(body.run) || !Number.isSafeInteger(body.q) || Number(body.q) < 1 || !input(body.answer)) return fail(400, 'invalid answer')
  const q = Number(body.q)
  const answer = body.answer as string | number
  const found = await context()
  if (!found) return off()
  if (!found.user || !found.index) return fail(401, 'login required')
  const blocked = await rate(request, [{ bucket: 'ranked-answer', value: found.user.id, count: 150, seconds: 120 }])
  if (blocked) return blocked
  const run = await found.db.from('runs').select('id,uid,game,mode,qcount,config').eq('id', body.run).eq('uid', found.user.id).eq('mode', 'ranked').maybeSingle()
  if (run.error) return fail(500, 'ranked run unavailable')
  if (!run.data) return fail(404, 'ranked run not found')
  const raw = run.data.config as { deck?: unknown[] }
  if (!Array.isArray(raw.deck) || raw.deck.length !== run.data.qcount) return fail(500, 'ranked run is invalid')
  if (q < 1 || q > raw.deck.length) return fail(409, 'question out of sequence')
  const item = raw.deck[q - 1]
  if (!question(item)) return fail(500, 'ranked run is invalid')
  const correct = validate(found.index, item, answer)
  const saved = await found.db.rpc('rankedanswer', { p_run: body.run, p_uid: found.user.id, p_q: q, p_answer: answer, p_correct: correct })
  if (saved.error) {
    const text = message(saved.error.message)
    return fail(text.includes('expired') ? 409 : text.includes('sequence') ? 409 : 400, text)
  }
  const attempt = Array.isArray(saved.data) ? saved.data[0] : saved.data
  if (!attempt) return fail(500, 'ranked answer unavailable')
  const next = raw.deck[q] as Question | undefined
  const validnext = next && question(next) ? next : null
  const flagdata = validnext?.flag ? await loadflag(validnext.flag) : undefined
  return NextResponse.json({
    q,
    correct: Boolean(attempt.correct),
    points: Number(attempt.points),
    reveal: reveal(item),
    next: validnext ? { q: q + 1, question: payload(validnext, body.run, q + 1, flagdata) } : null,
  })
}
