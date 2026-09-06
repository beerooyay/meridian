import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sanitize, source, type MeridianSource, type Question } from '@meridian/core'
import { admin } from '@/lib/supabase/admin'
import { server } from '@/lib/supabase/server'

export const games = new Set(['ranked-choice', 'ranked-chance', 'ranked-flags-scramble'])

let atlas: ReturnType<typeof source> | null = null

export async function context() {
  const client = await server()
  const db = admin()
  if (!client || !db) return null
  const auth = await client.auth.getUser()
  if (auth.error || !auth.data.user) return { client, db, user: null, index: null }
  if (!atlas) {
    const file = await readFile(join(process.cwd(), 'public/meridian/data/countries.json'), 'utf8')
    atlas = source(JSON.parse(file) as MeridianSource)
  }
  return { client, db, user: auth.data.user, index: atlas }
}

export const question = (value: unknown): value is Question => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<Question>
  return typeof item.id === 'string' && typeof item.kind === 'string' && typeof item.topic === 'string' && typeof item.prompt === 'string' && typeof item.target === 'string' && typeof item.answer === 'string' && Array.isArray(item.options) && Array.isArray(item.letters)
}

export const identifier = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export const input = (value: unknown): value is string | number => (typeof value === 'string' && value.length <= 200) || (typeof value === 'number' && Number.isFinite(value))

export const payload = (item: Question, run: string, q: number, flagdata?: string | null) =>
  sanitize(item, flagdata || (item.flag ? `/api/ranked/flag?run=${encodeURIComponent(run)}&q=${q}` : undefined))

const flags = new Map<string, string | undefined>()
const raws = new Map<string, string | undefined>()
export async function loadflagraw(id: string): Promise<string | undefined> {
  const lower = id.toLowerCase()
  if (raws.has(lower)) return raws.get(lower)
  if (!/^[a-z]{2}$/.test(lower)) return undefined
  try {
    const svg = await readFile(join(process.cwd(), 'public/meridian/flags', `${lower}.svg`), 'utf8')
    const data = cleansvg(svg, lower)
    raws.set(lower, data)
    return data
  } catch { raws.set(lower, undefined); return undefined }
}
export async function loadflag(id: string): Promise<string | undefined> {
  const lower = id.toLowerCase()
  if (flags.has(lower)) return flags.get(lower)
  if (!/^[a-z]{2}$/.test(lower)) return undefined
  try {
    const svg = await readFile(join(process.cwd(), 'public/meridian/flags', `${lower}.svg`), 'utf8')
    const data = `data:image/svg+xml;base64,${Buffer.from(cleansvg(svg, lower)).toString('base64')}`
    flags.set(lower, data)
    return data
  } catch { flags.set(lower, undefined); return undefined }
}

export const cleansvg = (svg: string, id: string) =>
  svg
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\saria-label="[^"]*"/gi, '')
    .replaceAll(`flag-icons-${id}`, 'ranked-flag')
    .replaceAll(`${id}-`, 'ranked-')

export const message = (text?: string) => {
  if (!text) return 'ranked request failed'
  if (text.includes('expired')) return 'ranked run expired'
  if (text.includes('not active')) return 'ranked run is not active'
  if (text.includes('not found')) return 'ranked run not found'
  if (text.includes('sequence')) return 'question out of sequence'
  if (text.includes('still active')) return 'ranked run is still active'
  // guardattempt trigger fires 'invalid question'; a duplicate insert means the
  // answer already landed on a retry. both mean the run has moved past this
  // question, so surface them as a sequence condition (mapped to 409) and let
  // the client settle the run instead of showing a dead-end failure.
  if (text.includes('invalid question')) return 'question out of sequence'
  if (text.includes('duplicate') || text.includes('unique') || text.includes('conflict')) return 'question out of sequence'
  return 'ranked request failed'
}
