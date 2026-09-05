import { NextResponse } from 'next/server'
import { exact, fail, json, off, rate } from '@/lib/api'
import { context, identifier, message } from '@/lib/ranked'

export async function POST(request: Request) {
  const body = await json(request)
  if (!body || !exact(body, ['run']) || !identifier(body.run)) return fail(400, 'invalid run')
  const found = await context()
  if (!found) return off()
  if (!found.user) return fail(401, 'login required')
  const blocked = await rate(request, [{ bucket: 'ranked-finish', value: found.user.id, count: 20, seconds: 120 }])
  if (blocked) return blocked
  const saved = await found.db.rpc('rankedfinish', { p_run: body.run, p_uid: found.user.id })
  if (saved.error) {
    const text = message(saved.error.message)
    return fail(text.includes('still active') ? 409 : text.includes('not found') ? 404 : 400, text)
  }
  const result = Array.isArray(saved.data) ? saved.data[0] : saved.data
  if (!result) return fail(500, 'ranked result unavailable')
  return NextResponse.json({ score: Number(result.score), correct: Number(result.correct), answered: Number(result.answered), elapsed: Number(result.elapsed), proof: String(result.proof), finished: result.finished })
}
