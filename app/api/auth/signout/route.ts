import { NextResponse } from "next/server"
import { fail, off } from "@/lib/api"
import { server } from "@/lib/supabase/server"

export async function POST() {
  const client = await server()
  if (!client) return off()
  const { error } = await client.auth.signOut()
  if (error) return fail(500, "signout failed")
  return NextResponse.json({ ok: true })
}
