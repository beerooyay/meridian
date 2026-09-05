import "server-only"
import { createClient } from "@supabase/supabase-js"
import { secretenv } from "./env"

export function admin() {
  const env = secretenv()
  return env
    ? createClient(env.url, env.service, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null
}
