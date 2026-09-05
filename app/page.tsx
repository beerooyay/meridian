import Shell from '@/components/react/shell'
import { server } from '@/lib/supabase/server'

export default async function Page() {
  const client = await server()
  const auth = client ? await client.auth.getUser() : null
  const account = auth?.data.user
  const profile = account && client ? await client.from('profiles').select('username').eq('uid', account.id).maybeSingle() : null
  const user = account ? { id: account.id, username: profile?.data?.username ?? null } : null
  return <Shell initial={user} />
}
