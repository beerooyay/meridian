import { NextResponse } from "next/server"
import { email, exact, fail, ip, json, off, password, rate } from "@/lib/api"
import { server } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const body = await json(request)
  if (!body || !exact(body, ["email", "password"])) return fail(400, "invalid body")
  const mail = email(body.email)
  const pass = password(body.password)
  if (!mail || !pass) return fail(400, "invalid credentials")
  const blocked = await rate(request, [
    { bucket: "signin-ip", value: ip(request), count: 20, seconds: 600 },
    { bucket: "signin-email", value: mail, count: 10, seconds: 600 },
  ])
  if (blocked) return blocked
  const client = await server()
  if (!client) return off()
  const { data, error } = await client.auth.signInWithPassword({ email: mail, password: pass })
  if (error || !data.user) return fail(401, "invalid credentials")
  const profile = await client.from("profiles").select("username").eq("uid", data.user.id).single()
  if (profile.error || !profile.data) {
    await client.auth.signOut()
    return fail(500, "profile unavailable")
  }
  return NextResponse.json({ user: { id: data.user.id, username: profile.data.username } })
}
