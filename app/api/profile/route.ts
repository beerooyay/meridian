import { NextResponse } from "next/server"
import { exact, fail, json, off, rate, username } from "@/lib/api"
import { server } from "@/lib/supabase/server"

async function auth() {
  const client = await server()
  if (!client) return { status: 503 as const }
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return { status: 401 as const }
  return { status: null, client, user: data.user }
}

export async function GET(request: Request) {
  const gate = await auth()
  if (gate.status === 503) return off()
  if (gate.status === 401) return fail(401, "unauthorized")
  const blocked = await rate(request, [{ bucket: "profile-read", value: gate.user.id, count: 30, seconds: 60 }])
  if (blocked) return blocked
  const [profile, stats, casual, totals] = await Promise.all([
    gate.client.from("profiles").select("username,created,updated").eq("uid", gate.user.id).maybeSingle(),
    gate.client.from("casualstats").select("game,scope,runs,questions,correct,score,elapsed,best,updated").eq("uid", gate.user.id),
    gate.client.from("casualtotals").select("runs,questions,correct,score,elapsed,updated").eq("uid", gate.user.id).maybeSingle(),
    gate.client.from("totals").select("runs,questions,correct,score,elapsed,updated").eq("uid", gate.user.id).maybeSingle(),
  ])
  if (profile.error || stats.error || casual.error || totals.error) return fail(500, "profile unavailable")
  const zero = { runs: 0, questions: 0, correct: 0, score: 0, elapsed: 0, updated: null }
  const casualrow = casual.data ?? zero
  const totalsrow = totals.data ?? zero
  const rows = (stats.data ?? []).map(row => ({
    ...row,
    average: Number(row.runs) ? Number((Number(row.score) / Number(row.runs)).toFixed(2)) : 0,
  }))
  return NextResponse.json({
    profile: { id: gate.user.id, username: profile.data?.username ?? null, created: profile.data?.created ?? null, updated: profile.data?.updated ?? null },
    casual: {
      total: { ...casualrow, average: Number(casualrow.runs) ? Number((Number(casualrow.score) / Number(casualrow.runs)).toFixed(2)) : 0 },
      rows,
    },
    total: totalsrow,
  })
}

export async function PATCH(request: Request) {
  const body = await json(request)
  if (!body || !exact(body, ["username"])) return fail(400, "invalid body")
  const name = username(body.username)
  if (!name) return fail(400, "invalid username")
  const gate = await auth()
  if (gate.status === 503) return off()
  if (gate.status === 401) return fail(401, "unauthorized")
  const blocked = await rate(request, [{ bucket: "profile-write", value: gate.user.id, count: 5, seconds: 600 }])
  if (blocked) return blocked
  const result = await gate.client
    .from("profiles")
    .update({ username: name })
    .eq("uid", gate.user.id)
    .select("username,created,updated")
    .single()
  if (result.error) return fail(result.error.code === "23505" ? 409 : 400, result.error.code === "23505" ? "username unavailable" : "update failed")
  return NextResponse.json({ profile: { id: gate.user.id, ...result.data } })
}
