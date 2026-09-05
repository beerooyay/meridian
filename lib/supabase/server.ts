import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { publicenv } from "./env"

export async function server() {
  const env = publicenv()
  if (!env) return null
  const jar = await cookies()
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, options))
        } catch {}
      },
    },
  })
}
