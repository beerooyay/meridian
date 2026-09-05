'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Gameplay from './gameplay'
import { modes } from './taxonomy'
import type { Mode } from './taxonomy'

type Auth = 'login' | 'signup'
type Phase = 'home' | 'detail' | 'ready'
type Scope = { id: string; name: string; count: number }

const scopes: Scope[] = [
  { id: 'world', name: 'World', count: 195 },
  { id: 'region:africa', name: 'Africa', count: 54 },
  { id: 'region:americas', name: 'Americas', count: 35 },
  { id: 'region:asia', name: 'Asia', count: 48 },
  { id: 'region:europe', name: 'Europe', count: 44 },
  { id: 'region:oceania', name: 'Oceania', count: 14 },
]

function Glyph({ kind }: { kind: 'daily' | 'ranked' | 'casual' | 'scope' }) {
  const path = kind === 'daily'
    ? <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>
    : kind === 'ranked'
      ? <path d="M13 2 5 13h6l-1 9 9-12h-7z" />
      : kind === 'scope'
        ? <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>
        : <><path d="M4 6h16v12H4z" /><path d="m8 10 3 3 5-5" /></>
  return <svg className="mode-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
}

function Card({ mode, open }: { mode: Mode; open: (mode: Mode) => void }) {
  return (
    <button className={`mr-card ${mode.group === 'ranked' ? 'rush' : ''}`} type="button" onClick={() => open(mode)}>
      <span className="mr-cardtop"><Glyph kind={mode.group} /><span className="mr-arrow">↗</span></span>
      <span className="mode-name">{mode.name}</span>
      <span className="menu-sub">{mode.summary}</span>
      <span className="mr-metric">{mode.metric}</span>
    </button>
  )
}

function Authbox({ kind, close, swap }: { kind: Auth; close: () => void; swap: () => void }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    try {
      const endpoint = kind === 'login' ? 'signin' : 'signup'
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => null) as { error?: string; confirmed?: boolean } | null
      if (!response.ok) throw new Error(data?.error || 'We could not complete that request.')
      setNotice(kind === 'login' ? 'Welcome back.' : data?.confirmed ? 'Your account is ready.' : 'Check your email to confirm your account before logging in.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'We could not complete that request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mr-layer" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <section className="mr-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-btn mr-close" type="button" aria-label="Close" onClick={close}>×</button>
        <div className="result-kicker">Meridian account</div>
        <h2 id="auth-title">{kind === 'login' ? 'Welcome back' : 'Join Meridian'}</h2>
        <p>{kind === 'login' ? 'Sign in to keep your runs and rankings together.' : 'Create a profile to save progress across the map.'}</p>
        <form className="mr-form" onSubmit={submit}>
          {kind === 'signup' && <label>Username<input className="answer-input" name="username" type="text" autoComplete="username" minLength={3} maxLength={18} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,17}" required /></label>}
          <label>Email<input className="answer-input" name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input className="answer-input" name="password" type="password" autoComplete={kind === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>
          {notice && <div className="mr-notice" role="status">{notice}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait' : kind === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <button className="mr-swap" type="button" onClick={swap}>{kind === 'login' ? 'New here? Sign up' : 'Already have an account? Log in'}</button>
      </section>
    </div>
  )
}

function Scopebox({ current, choose, close }: { current: Scope; choose: (scope: Scope) => void; close: () => void }) {
  return (
    <div className="mr-layer" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <section className="sheet mr-scope" role="dialog" aria-modal="true" aria-labelledby="scope-title">
        <div className="sheet-grip" />
        <h2 className="sheet-title" id="scope-title">Where in the world</h2>
        <div className="scope-list">
          {scopes.map((scope) => (
            <button className={`scope-row ${scope.id === current.id ? 'on' : ''}`} type="button" key={scope.id} onClick={() => choose(scope)}>
              <span className="scope-row-name">{scope.name}</span>
              <span className="scope-row-count">{scope.count} countries</span>
            </button>
          ))}
        </div>
        <button className="btn ghost sm mt" type="button" onClick={close}>Close</button>
      </section>
    </div>
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
    const nextseed = mode.group === 'casual' ? crypto.randomUUID() : day
    if (mode.group === 'daily') {
      const key = `meridian:daily:${day}:${mode.id}`
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ at: 0, right: 0, wrong: 0, done: false, holes, scope: chosen.id }))
    }
    setSeed(nextseed)
    setPhase('ready')
  }

  return (
    <div className="app mr-app">
      <header className="mr-nav">
        <button className="mr-logo" type="button" onClick={() => setPhase('home')} aria-label="Meridian home">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="/meridian/branding/logo-text-white.png" />
            <img src="/meridian/branding/logo-text-black.png" alt="Meridian" />
          </picture>
        </button>
        <nav aria-label="Primary navigation">
          <button type="button" onClick={() => jump('daily')}>Daily</button>
          <button type="button" onClick={() => jump('ranked')}>Ranked</button>
          <button type="button" onClick={() => jump('casual')}>Casual</button>
        </nav>
        <button className="btn ghost sm mr-login" type="button" onClick={() => setAuth('login')}>Log in</button>
      </header>

      <main className="view mr-view">
        {phase === 'home' && <>
          <section className="mr-hero">
            <div>
              <div className="result-kicker">Know the world properly</div>
              <h1>Geography that goes<br />beyond the outline.</h1>
              <p>Build real map intuition through daily puzzles, ranked sprints, and unhurried practice.</p>
            </div>
            <button className="scope-btn mr-scopebtn" type="button" onClick={() => setScopeopen(true)}>
              <Glyph kind="scope" />
              <span><span className="scope-label">Playing</span><span className="scope-value">{scope.name}</span><span className="scope-count">{scope.count} countries</span></span>
              <span className="mr-chevron">⌄</span>
            </button>
          </section>

          <section className="mr-section" id="daily">
            <header className="mr-head"><div><span>01</span><h2>Daily</h2></div><p>Fresh routes through the map, every day.</p></header>
            <div className="mr-dailygrid">{modes.daily.map((item) => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>

          <section className="mr-section" id="ranked">
            <header className="mr-head"><div><span>02</span><h2>Ranked</h2></div><p>Timed runs. One minute. Make it count.</p></header>
            <div className="mr-grid">{modes.ranked.map((item) => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>

          <section className="mr-section" id="casual">
            <header className="mr-head"><div><span>03</span><h2>Casual</h2></div><p>Explore the atlas without a clock.</p></header>
            <div className="mr-grid">{modes.casual.map((item) => <Card mode={item} open={open} key={item.id} />)}</div>
          </section>
        </>}

        {phase === 'detail' && mode && <section className="mr-detail">
          <button className="mr-back" type="button" onClick={() => setPhase('home')}>← All modes</button>
          <div className="mr-detailcard">
            <div className="mr-detailglyph"><Glyph kind={mode.group} /></div>
            <div className="result-kicker">{mode.group}{mode.timed ? ' · timed' : ''}</div>
            <h1>{mode.name}</h1>
            <p>{mode.detail}</p>
            <div className="mr-facts"><span><b>{chosen.name}</b>scope</span><span><b>{mode.metric}</b>format</span></div>
            {mode.holes && <fieldset className="mr-holes"><legend>Round length</legend>{mode.holes.map((count) => <button className={`chip ${holes === count ? 'on' : ''}`} type="button" key={count} onClick={() => setHoles(count)}>{count} holes</button>)}</fieldset>}
            <button className="btn mr-start" type="button" onClick={start}>Start {mode.name}</button>
          </div>
        </section>}

        {phase === 'ready' && mode && <Gameplay mode={mode} scope={chosen.id} holes={holes} seed={seed} back={() => setPhase('home')} />}
      </main>

      <footer className="mr-foot"><span>Meridian</span><span>195 countries · one connected world</span><button type="button" onClick={() => setAuth('signup')}>Create account</button></footer>
      {scopeopen && <Scopebox current={scope} choose={(next) => { setScope(next); setScopeopen(false) }} close={() => setScopeopen(false)} />}
      {auth && <Authbox kind={auth} close={() => setAuth(null)} swap={() => setAuth(auth === 'login' ? 'signup' : 'login')} />}
      <style data-meridian="shell">{styles}</style>
    </div>
  )
}

const styles = `
  html { scroll-behavior:smooth; }
  body { min-width:320px; }
  .mr-app { max-width:1180px; padding:0 28px 32px; }
  .mr-nav { height:82px; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; border-bottom:1px solid var(--line); position:relative; z-index:3; }
  .mr-logo { width:132px; padding:0; border:0; background:none; cursor:pointer; line-height:0; }
  .mr-logo img { width:100%; height:auto; display:block; }
  .mr-nav nav { display:flex; gap:8px; }
  .mr-nav nav button,.mr-foot button,.mr-swap,.mr-back { border:0; background:none; color:var(--ink-2); cursor:pointer; font-size:13px; font-weight:620; }
  .mr-nav nav button { padding:10px 14px; border-radius:999px; }
  .mr-nav nav button:hover { background:var(--surface-2); color:var(--ink); }
  .mr-login { width:auto; justify-self:end; padding-inline:20px!important; }
  .mr-view { padding:0; }
  .mr-hero { min-height:440px; display:grid; grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr); align-items:center; gap:72px; border-bottom:1px solid var(--line); }
  .mr-hero h1,.mr-detail h1,.mr-ready h1 { font-size:clamp(42px,6vw,76px); line-height:.98; letter-spacing:-.055em; margin:16px 0 22px; font-weight:680; }
  .mr-hero p { max-width:570px; color:var(--ink-2); font-size:17px; }
  .mr-scopebtn { display:flex; align-items:center; gap:14px; padding:18px 48px 18px 18px; }
  .mr-scopebtn .mode-glyph { width:32px; height:32px; flex:none; }
  .mr-scopebtn > span { display:flex; flex-direction:column; }
  .mr-chevron { position:absolute; right:18px; font-size:20px; color:var(--ink-3); }
  .mr-section { padding:82px 0; scroll-margin-top:20px; border-bottom:1px solid var(--line); }
  .mr-head { display:flex; justify-content:space-between; align-items:flex-end; gap:30px; margin-bottom:28px; }
  .mr-head div { display:flex; align-items:baseline; gap:14px; }
  .mr-head span { color:var(--brass); font-size:11px; font-weight:700; letter-spacing:.14em; }
  .mr-head h2 { font-size:38px; letter-spacing:-.04em; line-height:1; font-weight:670; }
  .mr-head p { color:var(--ink-3); font-size:14px; }
  .mr-grid,.mr-dailygrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .mr-dailygrid { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .mr-card { min-height:210px; display:flex; flex-direction:column; text-align:left; padding:20px; border:1px solid var(--line); border-radius:var(--r-m); background:var(--surface); color:var(--ink); box-shadow:var(--shadow); cursor:pointer; transition:transform .18s var(--ease),border-color .18s var(--ease),box-shadow .18s var(--ease); }
  .mr-card:hover { transform:translateY(-3px); border-color:var(--line-2); box-shadow:0 14px 32px -22px rgba(20,22,26,.5); }
  .mr-card.rush .mode-glyph { color:var(--brass); }
  .mr-cardtop { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; }
  .mr-cardtop .mode-glyph { width:25px; height:25px; }
  .mr-arrow { color:var(--ink-3); font-size:15px; }
  .mr-card .mode-name { font-size:18px; text-align:left; margin-bottom:5px; }
  .mr-card .menu-sub { line-height:1.35; }
  .mr-metric { margin-top:auto; padding-top:18px; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); }
  .mr-detail { min-height:calc(100dvh - 170px); padding:42px 0 80px; }
  .mr-back { padding:8px 0; margin-bottom:40px; }
  .mr-detailcard,.mr-ready { max-width:700px; margin:0 auto; text-align:center; padding:46px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-l); box-shadow:var(--shadow); }
  .mr-detailglyph { width:58px; height:58px; display:grid; place-items:center; margin:0 auto 24px; border-radius:50%; background:var(--surface-2); }
  .mr-detailglyph .mode-glyph { width:27px; height:27px; }
  .mr-detail h1,.mr-ready h1 { font-size:clamp(44px,7vw,72px); margin:12px 0 18px; }
  .mr-detailcard > p,.mr-ready > p { color:var(--ink-2); max-width:520px; margin:0 auto; }
  .mr-facts { display:grid; grid-template-columns:1fr 1fr; margin:34px 0 24px; border-block:1px solid var(--line); }
  .mr-facts span { padding:18px; font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:var(--ink-3); }
  .mr-facts span + span { border-left:1px solid var(--line); }
  .mr-facts b { display:block; color:var(--ink); font-size:15px; text-transform:none; letter-spacing:0; margin-bottom:3px; }
  .mr-holes { border:0; padding:0; margin:8px 0 26px; }
  .mr-holes legend { width:100%; margin-bottom:10px; color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
  .mr-holes .chip { margin:0 3px; }
  .mr-start { margin-top:10px; }
  .mr-ready { padding-top:80px; padding-bottom:80px; }
  .mr-route { display:flex; align-items:center; justify-content:center; gap:10px; margin:38px 0; color:var(--ink-2); font-size:12px; font-weight:650; }
  .mr-route i { width:34px; height:1px; background:var(--line-2); }
  .mr-muted { font-size:14px!important; margin-bottom:26px!important; }
  .mr-foot { display:flex; justify-content:space-between; align-items:center; padding:32px 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-3); }
  .mr-foot span:first-child { color:var(--ink); font-weight:700; }
  .mr-foot button { text-decoration:underline; text-underline-offset:4px; }
  .mr-layer { position:fixed; inset:0; z-index:50; display:grid; place-items:center; padding:20px; background:rgba(10,11,13,.46); backdrop-filter:blur(6px); animation:fade .2s var(--ease) both; }
  .mr-modal { position:relative; width:min(100%,460px); padding:38px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-l); box-shadow:0 24px 80px -30px rgba(0,0,0,.7); animation:rise .25s var(--ease) both; }
  .mr-modal h2 { font-size:34px; line-height:1; letter-spacing:-.04em; margin:10px 0; }
  .mr-modal > p { color:var(--ink-2); font-size:14px; }
  .mr-close { position:absolute; top:16px; right:16px; font-size:24px; color:var(--ink-3); }
  .mr-form { display:flex; flex-direction:column; gap:13px; margin-top:26px; }
  .mr-form label { display:flex; flex-direction:column; gap:6px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-3); }
  .mr-form input { text-transform:none; letter-spacing:normal; }
  .mr-notice { padding:10px 12px; background:var(--surface-2); border-radius:var(--r-s); font-size:13px; color:var(--ink-2); text-align:center; }
  .mr-swap { display:block; margin:18px auto 0; }
  .mr-scope { position:relative; z-index:51; width:min(100%,460px); left:auto; right:auto; bottom:auto; border:1px solid var(--line); border-radius:var(--r-l); }
  @media (max-width:760px) {
    .mr-app { padding:0 20px 24px; }
    .mr-nav { height:68px; grid-template-columns:1fr auto; }
    .mr-nav nav { position:fixed; z-index:10; left:12px; right:12px; bottom:max(12px,env(safe-area-inset-bottom)); justify-content:space-around; padding:5px; background:color-mix(in srgb,var(--surface) 90%,transparent); border:1px solid var(--line); border-radius:999px; box-shadow:0 10px 35px rgba(0,0,0,.18); backdrop-filter:blur(14px); }
    .mr-nav nav button { flex:1; }
    .mr-login { padding-inline:14px!important; }
    .mr-hero { min-height:auto; grid-template-columns:1fr; gap:38px; padding:64px 0 52px; }
    .mr-hero h1 { font-size:clamp(42px,13vw,60px); }
    .mr-section { padding:58px 0; }
    .mr-head { display:block; }
    .mr-head p { margin-top:10px; }
    .mr-grid,.mr-dailygrid { grid-template-columns:1fr 1fr; }
    .mr-card { min-height:200px; padding:17px; }
    .mr-detail { padding-top:28px; }
    .mr-back { margin-bottom:22px; }
    .mr-detailcard,.mr-ready { padding:34px 22px; }
    .mr-foot { padding-bottom:78px; }
    .mr-foot span:nth-child(2) { display:none; }
  }
  @media (max-width:440px) {
    .mr-grid,.mr-dailygrid { grid-template-columns:1fr; }
    .mr-card { min-height:164px; }
    .mr-cardtop { margin-bottom:18px; }
    .mr-modal { padding:34px 24px 28px; }
  }
`
