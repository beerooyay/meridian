'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Gameplay from './gameplay'
import { modes } from './taxonomy'
import type { Mode } from './taxonomy'

type Auth = 'login' | 'signup'
type Phase = 'home' | 'detail' | 'ready' | 'boards'
type Scope = { id: string; name: string; count: number }
type User = { id: string; username: string | null }
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
const games = [
  { id: 'choice', name: 'choice' },
  { id: 'chance', name: 'chance' },
  { id: 'flags-scramble', name: 'flags scramble' },
  { id: 'dogleg', name: 'dogleg' },
]

function Card({ mode, open }: { mode: Mode; open: (mode: Mode) => void }) {
  return (
    <button className="mr-card" type="button" onClick={() => open(mode)}>
      <h2>{mode.name}</h2>
      <p>{mode.summary}</p>
      <span className="mr-metric">{mode.metric}</span>
    </button>
  )
}

function Authbox({ kind, close, swap, onsuccess }: { kind: Auth; close: () => void; swap: () => void; onsuccess: () => void }) {
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
      if (kind === 'login') { onsuccess(); close(); return }
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
        <button className="btn quiet mr-close" type="button" aria-label="close" onClick={close}>×</button>
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

function Boards({ scope, back }: { scope: Scope; back: () => void }) {
  const [board, setBoard] = useState<Board>('casual')
  const [game, setGame] = useState('choice')
  const [rows, setRows] = useState<Row[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let live = true
    setState('loading')
    const params = new URLSearchParams({ board, game, scope: scope.id, limit: '50' })
    if (board === 'ranked') params.set('season', 'current')
    if (board === 'daily') params.set('day', new Date().toISOString().slice(0, 10))
    fetch(`/api/leaderboard?${params}`)
      .then(async response => { const data = await response.json().catch(() => null) as { rows?: Row[] } | null; if (!live) return; if (!response.ok || !data?.rows) { setRows([]); setState('error') } else { setRows(data.rows); setState('ready') } })
      .catch(() => live && setState('error'))
    return () => { live = false }
  }, [board, game, scope.id])

  return (
    <section className="mr-detail">
      <button className="btn quiet mr-back" type="button" onClick={back}>← all modes</button>
      <div className="card mr-detailcard">
        <div className="kicker">leaderboards</div>
        <h1>boards</h1>
        <p>{scope.name} · top runs</p>
        <div className="mr-tabs">{boards.map(tab => <button key={tab} className={`chip ${board === tab ? 'on' : ''}`} type="button" onClick={() => setBoard(tab)}>{tab}</button>)}</div>
        <div className="mr-tabs">{games.map(item => <button key={item.id} className={`chip ${game === item.id ? 'on' : ''}`} type="button" onClick={() => setGame(item.id)}>{item.name}</button>)}</div>
        {state === 'loading' && <p className="mr-empty">loading</p>}
        {state === 'error' && <p className="mr-empty">board unavailable</p>}
        {state === 'ready' && rows.length === 0 && <p className="mr-empty">no runs yet. be the first.</p>}
        {state === 'ready' && rows.length > 0 && <table className="mr-board"><thead><tr><th>#</th><th>player</th><th>score</th><th>correct</th><th>time</th></tr></thead><tbody>
          {rows.map((row, i) => <tr key={i}><td>{i + 1}</td><td>{String(row.username ?? '—')}</td><td>{Number(row.score ?? row.best ?? 0)}</td><td>{Number(row.correct ?? 0)}</td><td>{Number(row.elapsed ?? row.fastest ?? 0)}s</td></tr>)}
        </tbody></table>}
      </div>
    </section>
  )
}

export default function Shell() {
  const [phase, setPhase] = useState<Phase>('home')
  const [mode, setMode] = useState<Mode | null>(null)
  const [scope, setScope] = useState(scopes[0])
  const [scopeopen, setScopeopen] = useState(false)
  const [auth, setAuth] = useState<Auth | null>(null)
  const [holes, setHoles] = useState<9 | 18>(9)
  const [seed, setSeed] = useState('')
  const [user, setUser] = useState<User | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/auth/session').catch(() => null)
    const data = res ? await res.json().catch(() => null) as { user?: User | null } | null : null
    setUser(data?.user ?? null)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function signout() {
    await fetch('/api/auth/signout', { method: 'POST' })
    setUser(null)
    setPhase('home')
  }

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (auth) setAuth(null)
      else if (scopeopen) setScopeopen(false)
      else if (phase !== 'home') setPhase('home')
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [auth, phase, scopeopen])

  function open(next: Mode) {
    setMode(next)
    setHoles(9)
    setPhase('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function jump(id: string) {
    setPhase('home')
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const day = new Date().toISOString().slice(0, 10)
  const world = mode?.id === 'daily-dogleg'
  const chosen = world ? scopes[0] : scope

  function start() {
    if (!mode) return
    if (mode.group === 'daily') {
      const key = `meridian:daily:${day}:${mode.id}`
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ at: 0, right: 0, wrong: 0, done: false, holes, scope: chosen.id }))
    }
    setSeed(mode.group === 'casual' ? crypto.randomUUID() : day)
    setPhase('ready')
  }

  return (
    <div className="mr-app">
      {phase !== 'ready' && <header className="mr-nav">
        <button className="mr-logo" type="button" onClick={() => setPhase('home')} aria-label="meridian home">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="/meridian/branding/logo-text-white.png" />
            <img src="/meridian/branding/logo-text-black.png" alt="meridian" width="210" height="48" />
          </picture>
        </button>
        <nav aria-label="primary">
          <button className="btn quiet" type="button" onClick={() => jump('daily')}>daily</button>
          <button className="btn quiet" type="button" onClick={() => jump('ranked')}>ranked</button>
          <button className="btn quiet" type="button" onClick={() => jump('casual')}>casual</button>
          <button className="btn quiet" type="button" onClick={() => setPhase('boards')}>boards</button>
        </nav>
        {user
          ? <div className="mr-user"><button className="btn ghost" type="button" onClick={() => setPhase('boards')}>{user.username ?? 'player'}</button><button className="btn quiet" type="button" onClick={signout}>sign out</button></div>
          : <button className="btn ghost mr-login" type="button" onClick={() => setAuth('login')}>log in</button>}
      </header>}

      <main className="mr-view">
        {phase === 'home' && <>
          <section className="mr-hero">
            <div>
              <div className="kicker">know the world properly</div>
              <h1>geography that goes beyond the outline.</h1>
              <p>build real map intuition through daily puzzles, ranked sprints, and unhurried practice.</p>
            </div>
            <button className="scope-btn" type="button" onClick={() => setScopeopen(true)}>
              <span className="scope-label">playing</span>
              <span className="scope-value">{scope.name}</span>
              <span className="scope-count">{scope.count} countries</span>
              <span className="scope-caret">⌄</span>
            </button>
          </section>

          <section className="mr-section" id="daily">
            <header className="mr-head"><h2>daily</h2><p>one shared deck for everyone, every day. one attempt.</p></header>
            <div className="mr-dailygrid">{modes.daily.map(item => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>

          <section className="mr-section" id="ranked">
            <header className="mr-head"><h2>ranked</h2><p>sixty seconds, server-scored. only timed runs reach the boards.</p></header>
            <div className="mr-grid">{modes.ranked.map(item => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>

          <section className="mr-section" id="casual">
            <header className="mr-head"><h2>casual</h2><p>no clock, no board. explore the atlas at your pace.</p></header>
            <div className="mr-grid">{modes.casual.map(item => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>
        </>}

        {phase === 'detail' && mode && <section className="mr-detail">
          <button className="btn quiet mr-back" type="button" onClick={() => setPhase('home')}>← all modes</button>
          <div className="card mr-detailcard">
            <div className="kicker">{mode.group}{mode.timed ? ' · timed' : ''}</div>
            <h1>{mode.name}</h1>
            <p>{mode.detail}</p>
            <div className="mr-facts"><span><b>{chosen.name}</b>scope</span><span><b>{mode.metric}</b>format</span></div>
            {mode.holes && <fieldset className="mr-holes"><legend>round length</legend><div>{mode.holes.map(count => <button className={`chip ${holes === count ? 'on' : ''}`} type="button" key={count} onClick={() => setHoles(count)}>{count} holes</button>)}</div></fieldset>}
            <button className="btn wide" type="button" onClick={start}>start {mode.name}</button>
          </div>
        </section>}

        {phase === 'ready' && mode && <Gameplay mode={mode} scope={chosen.id} holes={holes} seed={seed} back={() => setPhase('home')} />}

        {phase === 'boards' && <Boards scope={scope} back={() => setPhase('home')} />}
      </main>

      {phase !== 'ready' && <footer className="mr-foot"><span>meridian</span><span>195 countries · one connected world</span>{!user && <button className="btn quiet" type="button" onClick={() => setAuth('signup')}>create account</button>}</footer>}
      {scopeopen && <Scopebox current={scope} choose={next => { setScope(next); setScopeopen(false) }} close={() => setScopeopen(false)} />}
      {auth && <Authbox kind={auth} close={() => setAuth(null)} swap={() => setAuth(auth === 'login' ? 'signup' : 'login')} onsuccess={refresh} />}
    </div>
  )
}
