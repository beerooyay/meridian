import Shell from '@/components/react/shell'
import { server } from '@/lib/supabase/server'

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://www.meridianflags.com/#site',
      name: 'meridian',
      url: 'https://www.meridianflags.com',
      description: 'world geography memory games. know the world properly and put it to the test.',
      publisher: { '@type': 'Organization', name: 'rblabs', url: 'https://rblabs.cloud' },
    },
    {
      '@type': 'VideoGame',
      '@id': 'https://www.meridianflags.com/#game',
      name: 'meridian',
      url: 'https://www.meridianflags.com',
      description: 'world geography memory games — daily flag puzzles, ranked sprints, and casual practice across flags, capitals, populations, languages, and borders.',
      applicationCategory: 'Game',
      gamePlatform: ['Web Browser'],
      operatingSystem: 'any',
      genre: ['Educational', 'Trivia', 'Puzzle'],
      playMode: 'SinglePlayer',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      image: 'https://www.meridianflags.com/meridian/branding/og.png',
      publisher: { '@type': 'Organization', name: 'rblabs', url: 'https://rblabs.cloud' },
    },
  ],
}

export default async function Page() {
  const client = await server()
  const auth = client ? await client.auth.getUser() : null
  const account = auth?.data.user
  const profile = account && client ? await client.from('profiles').select('username').eq('uid', account.id).maybeSingle() : null
  const user = account ? { id: account.id, username: profile?.data?.username ?? null } : null
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
    <Shell initial={user} />
  </>
}
