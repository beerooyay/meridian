import { NextResponse } from "next/server"
import { fail, ip, off, rate } from "@/lib/api"
import { server } from "@/lib/supabase/server"

const date = /^\d{4}-\d{2}-\d{2}$/
const slug = /^[a-z0-9][a-z0-9-]{1,31}$/
const scope = /^[a-z0-9][a-z0-9:-]{0,63}$/
const games = /^[a-z0-9][a-z0-9-]{0,31}$/
const clean = (params: URLSearchParams, allowed: string[]) => {
  const keys = [...params.keys()]
  return keys.length === new Set(keys).size && keys.every(key => allowed.includes(key))
}
const validdate = (value: string) => {
  if (!date.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

export async function GET(request: Request) {
  const blocked = await rate(request, [{ bucket: "leaderboard", value: ip(request), count: 60, seconds: 60 }])
  if (blocked) return blocked
  const params = new URL(request.url).searchParams
  const board = params.get("board")
  const game = params.get("game")
  const raw = params.get("limit") ?? "50"
  if (!/^[1-9]\d{0,2}$/.test(raw) || Number(raw) > 100) return fail(400, "invalid limit")
  if (!game || !games.test(game)) return fail(400, "invalid game")
  const limit = Number(raw)
  const client = await server()
  if (!client) return off()
  if (board === "casual") {
    const area = params.get("scope")
    if (!area || !scope.test(area) || !clean(params, ["board", "game", "scope", "limit"])) return fail(400, "invalid query")
    const result = await client
      .from("casualboard")
      .select("username,game,scope,runs,questions,correct,score,elapsed,best,average")
      .eq("game", game)
      .eq("scope", area)
      .order("score", { ascending: false })
      .order("best", { ascending: false })
      .limit(limit)
    if (result.error) return fail(500, "leaderboard unavailable")
    return NextResponse.json({ board, game, scope: area, rows: result.data })
  }
  if (board === "ranked") {
    const season = params.get("season")
    const area = params.get("scope")
    if (!season || !slug.test(season) || !area || !scope.test(area) || !clean(params, ["board", "game", "scope", "season", "limit"])) return fail(400, "invalid query")
    const result = await client
      .from("rankedboard")
      .select("slug,game,scope,username,runs,best,average,fastest")
      .eq("slug", season)
      .eq("game", game)
      .eq("scope", area)
      .order("best", { ascending: false })
      .order("fastest", { ascending: true })
      .limit(limit)
    if (result.error) return fail(500, "leaderboard unavailable")
    return NextResponse.json({ board, game, scope: area, season, rows: result.data })
  }
  if (board === "daily") {
    const day = params.get("day")
    if (!day || !validdate(day) || !clean(params, ["board", "game", "day", "limit"])) return fail(400, "invalid query")
    const result = await client
      .from("dailyboard")
      .select("day,game,scope,username,score,correct,elapsed,finished")
      .eq("day", day)
      .eq("game", game)
      .order("score", { ascending: false })
      .order("elapsed", { ascending: true })
      .limit(limit)
    if (result.error) return fail(500, "leaderboard unavailable")
    return NextResponse.json({ board, game, day, rows: result.data })
  }
  return fail(400, "invalid board")
}
