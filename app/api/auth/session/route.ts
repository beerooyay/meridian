import { NextResponse } from "next/server"
import { fail, off } from "@/lib/api"
import { server } from "@/lib/supabase/server"

export async function GET() {
  const client = await server()
  if (!client) return off()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return NextResponse.json({ user: null })
  const profile = await client.from("profiles").select("username").eq("uid", data.user.id).maybeSingle()
  if (profile.error) return fail(500, "profile unavailable")
  return NextResponse.json({ user: { id: data.user.id, username: profile.data?.username ?? null } })
}
