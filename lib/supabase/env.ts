type Public = {
  url: string
  key: string
}

type Secret = Public & {
  service: string
}

const valid = (value: string | undefined) => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.hostname === "localhost" ? value : null
  } catch {
    return null
  }
}

export function publicenv(): Public | null {
  const url = valid(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return url && key ? { url, key } : null
}

export function secretenv(): Secret | null {
  const base = publicenv()
  const service = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return base && service ? { ...base, service } : null
}
