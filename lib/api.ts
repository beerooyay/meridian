import "server-only"
import { createHmac } from "node:crypto"
import { NextResponse } from "next/server"
import { admin } from "@/lib/supabase/admin"
import { secretenv } from "@/lib/supabase/env"

export const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status })

export const off = () => fail(503, "service unavailable")

export const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const exact = (value: Record<string, unknown>, keys: string[]) => {
  const own = Object.keys(value)
  return own.length === keys.length && keys.every(key => own.includes(key))
}

const maxbody = 4096

export async function json(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null
  const stated = request.headers.get("content-length")
  if (stated && (!/^\d+$/.test(stated) || Number(stated) > maxbody)) return null
  try {
    if (!request.body) return null
    const reader = request.body.getReader()
    const parts: Uint8Array[] = []
    let size = 0
    while (true) {
      const item = await reader.read()
      if (item.done) break
      size += item.value.byteLength
      if (size > maxbody) {
        await reader.cancel()
        return null
      }
      parts.push(item.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const part of parts) {
      bytes.set(part, offset)
      offset += part.byteLength
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    return object(value) ? value : null
  } catch {
    return null
  }
}

export type Rule = {
  bucket: string
  value: string
  count: number
  seconds: number
}

export const ip = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown"

export async function rate(request: Request, rules: Rule[]) {
  const env = secretenv()
  const db = admin()
  if (!env || !db) return null
  for (const rule of rules) {
    const key = createHmac("sha256", env.service).update(`${rule.bucket}:${rule.value}`).digest("hex")
    const result = await db.rpc("ratelimit", { p_bucket: rule.bucket, p_key: key, p_limit: rule.count, p_seconds: rule.seconds })
    if (result.error) return off()
    if (!result.data) return fail(429, "too many requests")
  }
  return null
}

export const email = (value: unknown) => {
  if (typeof value !== "string") return null
  const clean = value.trim().toLowerCase()
  return clean.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : null
}

export const password = (value: unknown) =>
  typeof value === "string" && value.length >= 8 && value.length <= 72 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null

export const username = (value: unknown) => {
  if (typeof value !== "string") return null
  const clean = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9_-]{2,17}$/.test(clean) ? clean : null
}
