import { NextResponse } from "next/server"
import { email, exact, fail, ip, json, off, password, rate, username } from "@/lib/api"
import { server } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const body = await json(request)
  if (!body || !exact(body, ["email", "password", "username"])) return fail(400, "invalid body")
  const mail = email(body.email)
  const pass = password(body.password)
  const name = username(body.username)
  if (!mail || !pass || !name) return fail(400, "invalid credentials")
  const blocked = await rate(request, [
    { bucket: "signup-ip", value: ip(request), count: 10, seconds: 600 },
    { bucket: "signup-email", value: mail, count: 5, seconds: 600 },
  ])
  if (blocked) return blocked
  const client = await server()
  if (!client) return off()
  const { data, error } = await client.auth.signUp({
    email: mail,
    password: pass,
    options: { data: { username: name } },
  })
  if (error || !data.user) return fail(409, "account unavailable")
  return NextResponse.json(
    { user: { id: data.user.id, username: name }, confirmed: Boolean(data.session) },
    { status: 201 },
  )
}
