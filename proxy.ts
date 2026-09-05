import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { publicenv } from "@/lib/supabase/env"

export async function proxy(request: NextRequest) {
  const env = publicenv()
  if (!env) return NextResponse.next({ request })
  let response = NextResponse.next({ request })
  const client = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        values.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  await client.auth.getUser()
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
