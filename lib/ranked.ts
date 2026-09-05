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

export const payload = (item: Question, run: string, q: number) => sanitize(item, item.flag ? `/api/ranked/flag?run=${encodeURIComponent(run)}&q=${q}` : undefined)

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
  if (text.includes('sequence')) return 'question out of sequence'
  if (text.includes('still active')) return 'ranked run is still active'
  return 'ranked request failed'
}
