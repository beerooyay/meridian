'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Gameplay from './gameplay'
import { Back, Caret, Close, User as UserIcon } from './icons'
import { core, modes, scrambles } from './taxonomy'
import type { Format, Mode } from './taxonomy'

type Auth = 'login' | 'signup'
type Phase = 'home' | 'detail' | 'ready' | 'boards'
type Scope = { id: string; name: string; count: number }
type User = { id: string; username: string | null }
const num = (value: unknown) => { const v = Number(value); return Number.isFinite(v) ? v : 0 }
type Board = 'casual' | 'ranked' | 'daily'
type Row = Record<string, unknown>

const scopes: Scope[] = [
  { id: 'world', name: 'world', count: 195 },
  { id: 'region:africa', name: 'africa', count: 54 },
  { id: 'region:americas', name: 'americas', count: 35 },
  { id: 'region:asia', name: 'asia', count: 48 },
  { id: 'region:europe', name: 'europe', count: 44 },
  { id: 'region:oceania', name: 'oceania', count: 14 },
]

const boards: Board[] = ['casual', 'ranked', 'daily']
const boardopts = boards.map(id => ({ id, name: id }))
const formats: { id: Format; name: string }[] = [
  { id: 'best', name: 'best of 25' },
  { id: 'minute', name: 'one minute' },
  { id: 'cycle', name: 'the cycle' },
]
const rounds = [{ id: '9', name: '9 holes' }, { id: '18', name: '18 holes' }]
const boardgames: Record<Board, { id: string; name: string }[]> = {
  casual: [
    { id: 'choice', name: 'choice' },
    { id: 'chance', name: 'chance' },
    { id: 'flags-scramble', name: 'flags scramble' },
    { id: 'population-scramble', name: 'population scramble' },
    { id: 'border-scramble', name: 'border scramble' },
    { id: 'capital-scramble', name: 'capital scramble' },
    { id: 'world-scramble', name: 'world scramble' },
  ],
  ranked: [
    { id: 'choice', name: 'choice' },
    { id: 'chance', name: 'chance' },
    { id: 'flags-scramble', name: 'flags scramble' },
  ],
  daily: [
    { id: 'choice', name: 'choice' },
    { id: 'chance', name: 'chance' },
    { id: 'dogleg', name: 'dogleg' },
  ],
}

const Card = memo(function Card({ mode, open }: { mode: Mode; open: (mode: Mode) => void }) {
  return (
    <button className="mr-card" type="button" onClick={() => open(mode)}>
      <span className="mr-cardname">{mode.name}</span>
      <span className="mr-cardsummary">{mode.summary}</span>
      <span className="mr-metric">{mode.metric}</span>
    </button>
  )
})

function Authbox({ kind, close, swap, onsuccess }: { kind: Auth; close: () => void; swap: () => void; onsuccess: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const response = await fetch(`/api/auth/${kind === 'login' ? 'signin' : 'signup'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json().catch(() => null) as { error?: string; confirmed?: boolean } | null
      if (!response.ok) throw new Error(data?.error || 'we could not complete that request.')
      if (kind === 'login') { await onsuccess(); close(); return }
      setNotice(data?.confirmed ? 'your account is ready.' : 'check your email to confirm your account before logging in.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'we could not complete that request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mr-layer" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <section className="card mr-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="btn quiet mr-close" type="button" aria-label="close" onClick={close}><Close /></button>
        <div className="kicker">meridian account</div>
        <h2 id="auth-title">{kind === 'login' ? 'welcome back' : 'join meridian'}</h2>
        <p>{kind === 'login' ? 'sign in to keep your runs and rankings together.' : 'create a profile to save progress across the map.'}</p>
        <form className="mr-form" onSubmit={submit}>
          {kind === 'signup' && <label>username<input className="field" name="username" type="text" autoComplete="username" minLength={3} maxLength={18} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,17}" required /></label>}
          <label>email<input className="field" name="email" type="email" autoComplete="email" required /></label>
          <label>password<input className="field" name="password" type="password" autoComplete={kind === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>
          {notice && <div className="mr-notice" role="status">{notice}</div>}
          <button className="btn wide" type="submit" disabled={busy}>{busy ? 'please wait' : kind === 'login' ? 'log in' : 'create account'}</button>
        </form>
        <button className="btn quiet mr-swap" type="button" onClick={swap}>{kind === 'login' ? 'new here? sign up' : 'already have an account? log in'}</button>
      </section>
    </div>
  )
}

function Scopebox({ current, choose, close }: { current: Scope; choose: (scope: Scope) => void; close: () => void }) {
  return (
    <div className="mr-layer" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <section className="card mr-scope" role="dialog" aria-modal="true" aria-labelledby="scope-title">
        <h2 id="scope-title">where in the world</h2>
        <div className="scope-list">
          {scopes.map((scope) => (
            <button className={`scope-row ${scope.id === current.id ? 'on' : ''}`} type="button" key={scope.id} onClick={() => choose(scope)}>
              <span>{scope.name}</span>
              <span>{scope.count} countries</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function Pick({ value, options, pick, placeholder, wide }: { value: string | null; options: readonly { id: string; name: string }[]; pick: (id: string) => void; placeholder: string; wide?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const label = options.find(item => item.id === value)?.name ?? value ?? placeholder
  return <div className={`mr-pick ${wide ? 'wide' : ''}`} ref={ref}>
    <button className="mr-pickbtn" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(open => !open)}>
      <span className="mr-picklabel">{label}</span><span className="mr-caret"><Caret /></span>
    </button>
    {open && <div className="mr-menu" role="listbox">
      {options.map(item => <button key={item.id} className={item.id === value ? 'on' : ''} type="button" role="option" aria-selected={item.id === value} onClick={() => { pick(item.id); setOpen(false) }}>{item.name}</button>)}
    </div>}
  </div>
}

function Boards({ scope, back, openscope }: { scope: Scope; back: () => void; openscope: () => void }) {
  const [board, setBoard] = useState<Board>('casual')
  const [game, setGame] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const options = boardgames[board]

  useEffect(() => {
    if (game && !options.some(item => item.id === game)) setGame(null)
  }, [board, game, options])

  useEffect(() => {
    if (!game) return
    let live = true
    setState('loading')
    const params = new URLSearchParams({ board, game, limit: '15' })
    if (board === 'casual') params.set('scope', scope.id)
    if (board === 'ranked') { params.set('scope', scope.id); params.set('season', 'current') }
    if (board === 'daily') params.set('day', new Date().toISOString().slice(0, 10))
    fetch(`/api/leaderboard?${params}`)
      .then(async response => { const data = await response.json().catch(() => null) as { rows?: unknown } | null; if (!live) return; if (!response.ok || !data || !Array.isArray(data.rows)) { setRows([]); setState('error') } else { setRows(data.rows as Row[]); setState('ready') } })
      .catch(() => live && setState('error'))
    return () => { live = false }
  }, [board, game, scope.id])

  const pickboard = useCallback((id: string) => setBoard(id as Board), [])
  return (
    <section className="mr-detail">
      <button className="btn quiet mr-back" type="button" onClick={back}><Back />all modes</button>
      <div className="mr-boardpage">
        <h1>boards</h1>
        <button className="btn ghost" type="button" onClick={openscope}>{scope.name} · {scope.count} countries</button>
        <div className="mr-combo">
          <Pick value={board} options={boardopts} pick={pickboard} placeholder="board" />
          <span className="mr-sep" />
          <Pick value={game} options={options} pick={setGame} placeholder="mode" wide />
        </div>
        {game && <div className="card mr-boardcard">
          {state === 'loading' && <p className="mr-empty">loading</p>}
          {state === 'error' && <p className="mr-empty">board unavailable</p>}
          {state === 'ready' && rows.length === 0 && <p className="mr-empty">no runs yet. be the first.</p>}
          {state === 'ready' && rows.length > 0 && <table className="mr-board"><thead><tr><th>#</th><th>player</th><th>score</th><th>correct</th><th>time</th></tr></thead><tbody>
            {rows.map((row, i) => <tr key={i}><td>{i + 1}</td><td>{String(row.username ?? '—')}</td><td>{num(row.score ?? row.best)}</td><td>{num(row.correct)}</td><td>{num(row.elapsed ?? row.fastest)}s</td></tr>)}
          </tbody></table>}
        </div>}
      </div>
    </section>
  )
}

const casualcore = core('casual')
const casualscrambles = scrambles('casual')

const themes = [
  { id: 'system', name: 'system' },
  { id: 'light', name: 'light' },
  { id: 'dark', name: 'dark' },
] as const
type Theme = typeof themes[number]['id']

function applytheme(next: Theme) {
  try {
    if (next === 'system') {
      localStorage.removeItem('meridian:theme')
      delete document.documentElement.dataset.theme
    } else {
      localStorage.setItem('meridian:theme', next)
      document.documentElement.dataset.theme = next
    }
  } catch {}
}

function Profilebox({ user, close, signout, saved }: { user: User; close: () => void; signout: () => void; saved: (name: string) => void }) {
  const [name, setName] = useState(user.username ?? '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('meridian:theme')
      return stored === 'light' || stored === 'dark' ? stored : 'system'
    } catch { return 'system' }
  })
  const dirty = name.trim().toLowerCase() !== (user.username ?? '')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || busy) return
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name }) })
      const data = await response.json().catch(() => null) as { error?: string; profile?: { username: string | null } } | null
      if (!response.ok) throw new Error(data?.error || 'could not save your profile.')
      saved(data?.profile?.username ?? name.trim().toLowerCase())
      setNotice('saved.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  function picktheme(next: Theme) {
    setTheme(next)
    applytheme(next)
  }

  return (
    <div className="mr-layer" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <section className="card mr-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button className="btn quiet mr-close" type="button" aria-label="close" onClick={close}><Close /></button>
        <div className="kicker">profile</div>
        <h2 id="profile-title">@{user.username ?? 'player'}</h2>
        <p>your name on the boards, your pace everywhere else.</p>
        <form className="mr-form" onSubmit={save}>
          <label>username<input className="field" name="username" type="text" autoComplete="username" minLength={3} maxLength={18} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,17}" value={name} onChange={event => setName(event.target.value)} required /></label>
          {notice && <div className="mr-notice" role="status">{notice}</div>}
          <button className="btn wide" type="submit" disabled={busy || !dirty}>{busy ? 'saving' : 'save username'}</button>
        </form>
        <div className="mr-setrow"><span>theme</span><div>{themes.map(item => <button key={item.id} className={`chip ${theme === item.id ? 'on' : ''}`} type="button" onClick={() => picktheme(item.id)}>{item.name}</button>)}</div></div>
        <button className="btn ghost wide" type="button" onClick={signout}>sign out</button>
      </section>
    </div>
  )
}

export default function Shell({ initial }: { initial: User | null }) {
  const [phase, setPhase] = useState<Phase>('home')
  const [mode, setMode] = useState<Mode | null>(null)
  const [scope, setScope] = useState(scopes[0])
  const [scopeopen, setScopeopen] = useState(false)
  const [auth, setAuth] = useState<Auth | null>(null)
  const [holes, setHoles] = useState<9 | 18>(9)
  const [format, setFormat] = useState<Format>('best')
  const [seed, setSeed] = useState('')
  const [user, setUser] = useState<User | null>(initial)
  const [profile, setProfile] = useState(false)

  const day = new Date().toISOString().slice(0, 10)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/auth/session').catch(() => null)
    const data = res ? await res.json().catch(() => null) as { user?: User | null } | null : null
    setUser(data?.user ?? null)
  }, [])

  async function signout() {
    try { await fetch('/api/auth/signout', { method: 'POST' }) } catch {}
    setUser(null)
    setProfile(false)
    setPhase('home')
  }

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (auth) setAuth(null)
      else if (profile) setProfile(false)
      else if (scopeopen) setScopeopen(false)
      else if (phase !== 'home') setPhase('home')
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [auth, phase, profile, scopeopen])

  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    const set = () => {
      const height = vv?.height ?? window.innerHeight
      root.style.setProperty('--app-vh', `${height}px`)
      // the on-screen keyboard shrinks the visual viewport well below the layout
      // viewport; flag it so game screens can reflow to keep inputs and flags visible
      root.toggleAttribute('data-kb', !!vv && window.innerHeight - height > 120)
    }
    set()
    vv?.addEventListener('resize', set)
    vv?.addEventListener('scroll', set)
    window.addEventListener('orientationchange', set)
    return () => {
      vv?.removeEventListener('resize', set)
      vv?.removeEventListener('scroll', set)
      window.removeEventListener('orientationchange', set)
      root.removeAttribute('data-kb')
    }
  }, [])

  const open = useCallback((next: Mode) => {
    setMode(next)
    setHoles(9)
    setFormat('best')
    if (next.group === 'daily') {
      try {
        const saved = JSON.parse(localStorage.getItem(`meridian:daily:${day}:${next.id}`) || '') as { done?: boolean; holes?: 9 | 18 }
        if (saved.done) {
          if (saved.holes === 9 || saved.holes === 18) setHoles(saved.holes)
          setSeed(day)
          setPhase('ready')
          return
        }
      } catch {}
    }
    setPhase('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [day])

  function jump(id: string) {
    setPhase('home')
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const chosen = mode?.group === 'casual' ? scope : scopes[0]

  function start() {
    if (!mode) return
    if (mode.group === 'daily') {
      const key = `meridian:daily:${day}:${mode.id}`
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ at: 0, right: 0, wrong: 0, done: false, holes, scope: chosen.id }))
    }
    setSeed(mode.group === 'casual' ? (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) : day)
    setPhase('ready')
  }

  return (
    <div className="mr-app">
      {phase !== 'ready' && <header className="mr-nav">
        <button className="mr-logo" type="button" onClick={() => setPhase('home')} aria-label="meridian home">
          <img className="swap-light" src="/meridian/branding/logo-text-black.png" alt="meridian" width="210" height="48" />
          <img className="swap-dark" src="/meridian/branding/logo-text-white.png" alt="" width="210" height="48" aria-hidden="true" />
        </button>
        <nav aria-label="primary">
          <button className="btn quiet" type="button" onClick={() => jump('daily')}>daily</button>
          <button className="btn quiet" type="button" onClick={() => jump('ranked')}>ranked</button>
          <button className="btn quiet" type="button" onClick={() => jump('casual')}>casual</button>
          <button className="btn quiet" type="button" onClick={() => setPhase('boards')}>boards</button>
        </nav>
        {user
          ? <button className="btn ghost mr-avatar" type="button" onClick={() => setProfile(true)} aria-label="profile settings"><UserIcon /></button>
          : <button className="btn ghost mr-login" type="button" onClick={() => setAuth('login')}>log in</button>}
      </header>}

      <main className="mr-view">
        {phase === 'home' && <>
          <section className="mr-hero">
            <div>
              <div className="kicker">know the world properly and put it to the test</div>
              <h1>world geography memory games.</h1>
              <p>build real map intuition and knowledge through daily puzzles, ranked, daily, & casual game modes, and addictive learning.</p>
            </div>
            <div className="mr-heromark">
              <img className="swap-light" src="/meridian/branding/meridian-black.png" alt="" width="1080" height="1080" decoding="async" aria-hidden="true" />
              <img className="swap-dark" src="/meridian/branding/meridian-white.png" alt="" width="1080" height="1080" decoding="async" aria-hidden="true" />
            </div>
          </section>

          <section className="mr-section" id="daily">
            <header className="mr-head"><h2>daily</h2><p>one shared deck for everyone, every day. one attempt.</p></header>
            <div className="mr-grid">{modes.daily.map(item => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>

          <section className="mr-section" id="ranked">
            <header className="mr-head"><h2>ranked</h2><p>sixty seconds, server-scored. only timed runs reach the boards.</p></header>
            <div className="mr-grid">{modes.ranked.map(item => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>

          <section className="mr-section" id="casual">
            <header className="mr-head"><h2>casual</h2><p>no clock, no board. explore the atlas at your pace.</p></header>
            <div className="mr-grid">{casualcore.map(item => <Card mode={item} open={open} key={item.id} />)}</div>
            <h3 className="mr-subhead">scrambles</h3>
            <div className="mr-grid">{casualscrambles.map(item => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>
        </>}

        {phase === 'detail' && mode && <section className="mr-detail">
          <button className="btn quiet mr-back" type="button" onClick={() => setPhase('home')}><Back />all modes</button>
          <div className="card mr-detailcard">
            <div className="kicker">{mode.group}{mode.timed ? ' · timed' : ''}</div>
            <h1>{mode.name}</h1>
            <p>{mode.detail}</p>
            {mode.group === 'casual' ? <div className="mr-combo mr-config">
              <Pick value={scope.id} options={scopes} pick={id => setScope(scopes.find(item => item.id === id) ?? scopes[0])} placeholder="scope" />
              <span className="mr-sep" />
              {mode.id.endsWith('dogleg')
                ? <Pick value={String(holes)} options={rounds} pick={id => setHoles(id === '18' ? 18 : 9)} placeholder="format" wide />
                : <Pick value={format} options={formats} pick={id => setFormat(id as Format)} placeholder="format" wide />}
            </div> : <div className="mr-facts"><span><b>{chosen.name}</b> scope</span><span><b>{mode.metric}</b> format</span></div>}
            {mode.group !== 'casual' && mode.holes && <fieldset className="mr-holes"><legend>round length</legend><div>{mode.holes.map(count => <button className={`chip ${holes === count ? 'on' : ''}`} type="button" key={count} onClick={() => setHoles(count)}>{count} holes</button>)}</div></fieldset>}
            <button className="btn wide" type="button" onClick={start}>start {mode.name}</button>
          </div>
        </section>}

        {phase === 'ready' && mode && <Gameplay mode={mode} scope={chosen.id} holes={holes} format={format} seed={seed} back={() => setPhase('home')} />}

        {phase === 'boards' && <Boards scope={scope} back={() => setPhase('home')} openscope={() => setScopeopen(true)} />}
      </main>

      {phase !== 'ready' && <footer className="mr-foot"><span><a className="mr-footlink" href="https://rblabs.cloud" target="_blank" rel="noopener">meridian</a></span><span>195 countries · one connected world</span>{!user && <button className="btn quiet" type="button" onClick={() => setAuth('signup')}>create account</button>}</footer>}
      {scopeopen && <Scopebox current={scope} choose={next => { setScope(next); setScopeopen(false) }} close={() => setScopeopen(false)} />}
      {auth && <Authbox key={auth} kind={auth} close={() => setAuth(null)} swap={() => setAuth(auth === 'login' ? 'signup' : 'login')} onsuccess={refresh} />}
      {profile && user && <Profilebox user={user} close={() => setProfile(false)} signout={signout} saved={name => setUser({ ...user, username: name })} />}
    </div>
  )
}
