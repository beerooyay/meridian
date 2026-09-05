import { createBrowserClient } from "@supabase/ssr"
import { publicenv } from "./env"

export function browser() {
  const env = publicenv()
  return env ? createBrowserClient(env.url, env.key) : null
}
