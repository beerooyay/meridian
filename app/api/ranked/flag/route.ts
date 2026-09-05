import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fail, off, rate } from '@/lib/api'
import { cleansvg, context, identifier, question } from '@/lib/ranked'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const run = params.get('run')
  const raw = params.get('q')
  const keys = [...params.keys()]
  if (!run || !identifier(run) || !raw || !/^[1-9]\d{0,2}$/.test(raw) || Number(raw) > 1000 || keys.length !== 2 || params.getAll('run').length !== 1 || params.getAll('q').length !== 1 || !keys.every(key => key === 'run' || key === 'q')) return fail(400, 'invalid flag request')
  const found = await context()
  if (!found) return off()
  if (!found.user) return fail(401, 'login required')
  const blocked = await rate(request, [{ bucket: 'ranked-flag', value: found.user.id, count: 150, seconds: 120 }])
  if (blocked) return blocked
  const q = Number(raw)
  const runrow = await found.db.from('runs').select('id,state,expires,qcount,config').eq('id', run).eq('uid', found.user.id).eq('mode', 'ranked').maybeSingle()
  if (runrow.error) return fail(500, 'ranked flag unavailable')
  if (!runrow.data || runrow.data.state !== 'active' || new Date(runrow.data.expires).valueOf() <= Date.now() || q > runrow.data.qcount) return fail(404, 'ranked flag unavailable')
  const attempts = await found.db.from('attempts').select('id', { count: 'exact', head: true }).eq('run', run)
  if (attempts.error) return fail(500, 'ranked flag unavailable')
  if (q !== (attempts.count ?? -1) + 1) return fail(404, 'ranked flag unavailable')
  const config = runrow.data.config as { deck?: unknown }
  if (!Array.isArray(config.deck) || config.deck.length !== runrow.data.qcount || !config.deck.every(question)) return fail(500, 'ranked flag unavailable')
  const item = config.deck[q - 1]
  if (!item?.flag || !/^[a-z]{2}$/i.test(item.flag)) return fail(404, 'ranked flag unavailable')
  try {
    const id = item.flag.toLowerCase()
    const svg = await readFile(join(process.cwd(), 'public/meridian/flags', `${id}.svg`), 'utf8')
    return new Response(cleansvg(svg, id), { headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'image/svg+xml', Vary: 'Cookie' } })
  } catch {
    return fail(404, 'ranked flag unavailable')
  }
}
