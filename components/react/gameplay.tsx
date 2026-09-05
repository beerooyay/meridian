'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { deck, dogleg, graph, play, scope as getscope, scopes as getscopes, source, validate, type Countries, type MeridianSource, type PublicQuestion, type Reveal, type Scope } from '@meridian/core'
import type { Mode } from './taxonomy'

type Props = { mode: Mode; scope: string; holes: 9 | 18; seed: string; back: () => void }
type Saved = { at: number; right: number; wrong: number; done: boolean }
type Stats = { runs: number; right: number; total: number; average: number }

const stamp = (mode: Mode, seed: string) => `meridian:daily:${seed}:${mode.id}`
const flag = (value: string) => value.startsWith('/') ? value : `/meridian/flags/${value.toLowerCase()}.svg`
const format = (value: number) => new Intl.NumberFormat('en', { notation: value >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)

function Tiles({ item, locked, submit }: { item: PublicQuestion; locked: boolean; submit: (value: string) => void }) {
  const [used, setUsed] = useState<number[]>([])
  useEffect(() => setUsed([]), [item.id])
  const word = used.map(index => item.letters[index]).join('')
  return <div className="gp-tiles">
    <div className="gp-word">{word || 'Build the answer'}</div>
    <div className="gp-letters">{item.letters.map((letter, index) => <button type="button" className="chip" disabled={locked || used.includes(index)} onClick={() => setUsed([...used, index])} key={`${letter}:${index}`}>{letter}</button>)}</div>
    <div className="gp-actions"><button className="btn ghost sm" type="button" disabled={locked || !used.length} onClick={() => setUsed(used.slice(0, -1))}>Undo</button><button className="btn sm" type="button" disabled={locked || used.length !== item.letters.length} onClick={() => submit(word)}>Check</button></div>
  </div>
}

function Dial({ item, locked, submit }: { item: PublicQuestion; locked: boolean; submit: (value: number) => void }) {
  const [step, setStep] = useState(50)
  useEffect(() => setStep(50), [item.id])
  const value = Math.round(10 ** (3 + step / 100 * Math.log10(2e6)))
  return <div className="gp-dial"><strong>{format(value)}</strong><span>people</span><input type="range" min="0" max="100" step="0.1" value={step} disabled={locked} onChange={event => setStep(Number(event.target.value))} /><div className="gp-scale"><span>1 thousand</span><span>2 billion</span></div><button className="btn" type="button" disabled={locked} onClick={() => submit(value)}>Lock estimate</button></div>
}

function Prompt({ item, locked, answer }: { item: PublicQuestion; locked: boolean; answer: (value: string | number) => void }) {
  const [input, setInput] = useState('')
  useEffect(() => setInput(''), [item.id])
  function send(event: FormEvent) { event.preventDefault(); if (input.trim()) answer(input) }
  return <>
    {item.flag && <img className="gp-flag" src={flag(item.flag)} alt="Country flag" />}
    <h2>{item.prompt}</h2>
    {item.note && <p className="gp-note">{item.note}</p>}
    {(item.kind === 'choice' || item.kind === 'compare') && <div className="gp-options">{item.options.map(option => <button type="button" disabled={locked} onClick={() => answer(option)} key={option}>{option}</button>)}</div>}
    {item.kind === 'text' && <form className="gp-form" onSubmit={send}><input className="answer-input" autoFocus value={input} disabled={locked} onChange={event => setInput(event.target.value)} placeholder="Type a country" /><button className="btn" disabled={locked}>Check</button></form>}
    {item.kind === 'tiles' && <Tiles item={item} locked={locked} submit={answer} />}
    {item.kind === 'dial' && <Dial item={item} locked={locked} submit={answer} />}
  </>
}

function Quiz({ index, mode, scope, seed, back }: { index: Countries; mode: Mode; scope: Scope; seed: string; back: () => void }) {
  const questions = useMemo(() => deck(index, { mode: mode.id, seed: `${seed}:${mode.id}:${scope.id}`, scope }), [index, mode.id, scope, seed])
  const key = stamp(mode, seed)
  const initial = mode.group === 'daily' && typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem(key) || '') as Saved } catch { return null } })() : null
  const [at, setAt] = useState(initial?.at ?? 0)
  const [right, setRight] = useState(initial?.right ?? 0)
  const [wrong, setWrong] = useState(initial?.wrong ?? 0)
  const [done, setDone] = useState(initial?.done ?? false)
  const [result, setResult] = useState<boolean | null>(null)
  const [history, setHistory] = useState<Stats | null>(null)
  const recorded = useRef(false)
  const item = questions[Math.min(at, questions.length - 1)]!

  useEffect(() => {
    if (mode.group === 'daily') localStorage.setItem(key, JSON.stringify({ at, right, wrong, done, scope: scope.id }))
  }, [at, right, wrong, done, key, mode.group, scope.id])
  useEffect(() => {
    if (!done || mode.group !== 'casual' || recorded.current) return
    recorded.current = true
    const key = `meridian:stats:${mode.id}:${scope.id}`
    let old: Stats = { runs: 0, right: 0, total: 0, average: 0 }
    try { old = { ...old, ...JSON.parse(localStorage.getItem(key) || '{}') as Stats } } catch {}
    const next = { runs: old.runs + 1, right: old.right + right, total: old.total + right + wrong, average: 0 }
    next.average = next.total ? next.right / next.total : 0
    localStorage.setItem(key, JSON.stringify(next))
    setHistory(next)
  }, [done, mode.group, mode.id, right, scope.id, wrong])

  function answer(value: string | number) {
    if (result !== null || done) return
    const good = validate(index, item, value)
    setResult(good)
    if (good) setRight(value => value + 1); else setWrong(value => value + 1)
  }
  function next() {
    if (at + 1 >= questions.length) setDone(true)
    else { setAt(value => value + 1); setResult(null) }
  }

  if (done) return <Result right={right} wrong={wrong} back={back} stats={history} />
  return <section className="gp-shell">
    <header className="gp-head"><button className="mr-back" type="button" onClick={back}>← End run</button><span>{at + 1} / {questions.length}</span><strong>{right} right</strong></header>
    <div className="gp-card"><div className="result-kicker">{item.topic}</div><Prompt item={item} locked={result !== null} answer={answer} />{result !== null && <div className={`gp-feedback ${result ? 'yes' : 'no'}`}><strong>{result ? 'Correct' : `Answer: ${item.answer}`}</strong>{item.value && item.kind !== 'dial' && <span>{format(item.value)} {item.unit}</span>}<button className="btn sm" type="button" onClick={next}>Next</button></div>}</div>
  </section>
}

function Result({ right, wrong, back, stats }: { right: number; wrong: number; back: () => void; stats: Stats | null }) {
  const total = right + wrong
  return <section className="gp-shell"><div className="gp-card gp-result"><div className="result-kicker">Run complete</div><h1>{right}<small> / {total}</small></h1><p>{total ? Math.round(right / total * 100) : 0}% accuracy · {wrong} missed</p>{stats && <div className="gp-withheld">{stats.runs} local runs · {stats.right} cumulative correct · {Math.round(stats.average * 100)}% average</div>}<button className="btn" type="button" onClick={back}>Return to modes</button></div></section>
}

type Issued = { run: string; season: string; q: number; qcount: number; expires: string; question: PublicQuestion }
type Answered = { q: number; correct: boolean; points: number; reveal: Reveal; next: { q: number; question: PublicQuestion } | null }
type Final = { score: number; correct: number; answered: number; elapsed: number; proof: string }
type Row = { username: string; best: number; runs: number }

function Ranked({ mode, scope, back }: { mode: Mode; scope: Scope; back: () => void }) {
  const [issued, setIssued] = useState<Issued | null>(null)
  const [item, setItem] = useState<PublicQuestion | null>(null)
  const [q, setQ] = useState(1)
  const [left, setLeft] = useState(60)
  const [feedback, setFeedback] = useState<Answered | null>(null)
  const [result, setResult] = useState<Final | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [points, setPoints] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const started = useRef(false)
  const finishing = useRef(false)

  const finish: () => Promise<void> = useCallback(async () => {
    if (!issued || finishing.current || result) return
    finishing.current = true
    try {
      const response = await fetch('/api/ranked/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run: issued.run }) })
      const data = await response.json().catch(() => null) as (Final & { error?: string }) | null
      if (response.status === 409) { finishing.current = false; window.setTimeout(finish, 200); return }
      if (!response.ok || !data) throw new Error(data?.error || 'ranked result unavailable')
      setResult(data)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'ranked result unavailable')
    } finally {
      finishing.current = false
    }
  }, [issued, result])

  useEffect(() => {
    if (started.current) return
    started.current = true
    fetch('/api/ranked/issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: mode.id, scope: scope.id }) })
      .then(async response => {
        const data = await response.json().catch(() => null) as (Issued & { error?: string }) | null
        if (!response.ok || !data) throw new Error(data?.error || 'ranked is unavailable')
        setIssued(data); setItem(data.question); setQ(data.q)
      })
      .catch(value => setError(value instanceof Error ? value.message : 'ranked is unavailable'))
  }, [mode.id, scope.id])

  useEffect(() => {
    if (!issued || result) return
    const tick = () => {
      const next = Math.max(0, (new Date(issued.expires).valueOf() - Date.now()) / 1000)
      setLeft(next)
      if (!next) void finish()
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [finish, issued, result])

  useEffect(() => {
    if (!result || !issued) return
    const query = new URLSearchParams({ board: 'ranked', game: mode.id, scope: scope.id, season: issued.season, limit: '5' })
    fetch(`/api/leaderboard?${query}`).then(response => response.ok ? response.json() : null).then((data: { rows?: Row[] } | null) => setRows(data?.rows ?? [])).catch(() => {})
  }, [issued, mode.id, result, scope.id])

  async function answer(value: string | number) {
    if (!issued || !item || feedback || busy || result) return
    setBusy(true)
    try {
      const response = await fetch('/api/ranked/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run: issued.run, q, answer: value }) })
      const data = await response.json().catch(() => null) as (Answered & { error?: string }) | null
      if (!response.ok || !data) {
        if (response.status === 409) { await finish(); return }
        throw new Error(data?.error || 'answer could not be saved')
      }
      setFeedback(data)
      setPoints(total => total + data.points)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'answer could not be saved')
    } finally {
      setBusy(false)
    }
  }

  function next() {
    if (!feedback?.next) { void finish(); return }
    setQ(feedback.next.q); setItem(feedback.next.question); setFeedback(null)
  }

  if (error && !issued) return <section className="gp-shell"><div className="gp-card"><div className="result-kicker">Ranked unavailable</div><h2>{error === 'login required' ? 'Log in to play ranked.' : error}</h2><button className="btn" type="button" onClick={back}>Return to modes</button></div></section>
  if (!issued || !item) return <section className="gp-shell"><div className="gp-card"><div className="result-kicker">Ranked</div><h2>Issuing your server run…</h2></div></section>
  if (result) return <section className="gp-shell"><div className="gp-card gp-result"><div className="result-kicker">Authoritative result</div><h1>{result.score}<small> points</small></h1><p>{result.correct} correct · {result.answered} answered · {(result.elapsed / 1000).toFixed(1)} seconds</p>{rows.length > 0 && <div className="gp-board"><strong>{issued.season} leaderboard</strong>{rows.map((row, at) => <span key={row.username}>{at + 1}. {row.username} · {row.best}</span>)}</div>}<button className="btn" type="button" onClick={back}>Return to modes</button></div></section>
  return <section className="gp-shell"><header className="gp-head"><button className="mr-back" type="button" onClick={back}>← End run</button><span>{left.toFixed(1)}s</span><strong>{points} points</strong></header><div className="gp-card"><div className="result-kicker">{item.topic} · {q}</div><Prompt item={item} locked={Boolean(feedback) || busy} answer={answer} />{feedback && <div className={`gp-feedback ${feedback.correct ? 'yes' : 'no'}`}><strong>{feedback.correct ? 'Correct' : `Answer: ${feedback.reveal.answer}`}</strong>{feedback.reveal.value !== undefined && item.kind !== 'dial' && <span>{format(feedback.reveal.value)} {feedback.reveal.unit}</span>}<button className="btn sm" type="button" onClick={next}>{feedback.next ? 'Next' : 'Finish'}</button></div>}{error && <div className="mr-notice">{error}</div>}</div></section>
}

function Dogleg({ index, scope, holes, seed, mode, back }: { index: Countries; scope: Scope; holes: 9 | 18; seed: string; mode: Mode; back: () => void }) {
  const key = stamp(mode, seed)
  const saved = useMemo(() => { try { return typeof window === 'undefined' ? {} : JSON.parse(localStorage.getItem(key) || '{}') as { at?: number; route?: string[]; scores?: number[]; trails?: number[]; gave?: boolean; mastered?: string[]; holes?: 9 | 18 } } catch { return {} } }, [key])
  const length = saved.holes ?? holes
  const course = useMemo(() => dogleg(index, { holes: length, seed: `${seed}:${scope.id}:${length}`, scope: scope.countries }), [index, length, scope, seed])
  const [at, setAt] = useState(saved.at ?? 0)
  const safe = Math.min(at, course.holes.length - 1)
  const hole = course.holes[safe]!
  const [route, setRoute] = useState<string[]>(saved.route?.length ? saved.route : [hole.from])
  const [scores, setScores] = useState<number[]>(saved.scores ?? [])
  const [trails, setTrails] = useState<number[]>(saved.trails ?? [])
  const [gave, setGave] = useState(saved.gave ?? false)
  const [mastered, setMastered] = useState<Set<string>>(new Set(saved.mastered ?? []))
  const map = useMemo(() => graph(index, scope.countries), [index, scope])
  const current = route.at(-1) ?? hole.from
  const options = map.adj.get(current) ?? []
  const status = play(index, hole, route, scope.countries)
  const complete = status.reached || gave
  useEffect(() => { localStorage.setItem(key, JSON.stringify({ at, route, scores, trails, gave, mastered: [...mastered], holes: length })) }, [at, route, scores, trails, gave, mastered, key, length])

  function move(id: string) {
    if (complete) return
    const edge = [current, id].sort().join(':')
    setMastered(old => old.has(edge) ? old : new Set([...old, edge]))
    setRoute([...route, id])
  }
  function next() {
    const hops = status.reached ? status.hops : hole.par + 2
    const nextscores = [...scores, hops]
    setScores(nextscores)
    setTrails([...trails, status.hops])
    if (at + 1 === course.holes.length) { setAt(course.holes.length); return }
    const next = course.holes[at + 1]!
    setAt(at + 1); setRoute([next.from]); setGave(false)
  }
  if (at >= course.holes.length) {
    const scored = scores.reduce((sum, value) => sum + value, 0)
    const actual = trails.reduce((sum, value) => sum + value, 0)
    return <section className="gp-shell"><div className="gp-card gp-result"><div className="result-kicker">Course complete</div><h1>{scored - course.totalPar > 0 ? '+' : ''}{scored - course.totalPar}</h1><p>Total course par {course.totalPar} · actual hops {actual}</p><button className="btn" onClick={back}>Return to modes</button></div></section>
  }
  return <section className="gp-shell"><header className="gp-head"><button className="mr-back" onClick={back}>← End course</button><span>Hole {at + 1} / {length}</span><strong>{scores.reduce((sum, value, index) => sum + value - course.holes[index]!.par, 0)} score</strong></header><div className="gp-card"><div className="result-kicker">{complete ? hole.tier : `${hole.tier} · par ${hole.par}`}</div><h2>{index.byId.get(hole.from)!.name} → {index.byId.get(hole.to)!.name}</h2><div className="gp-trail">{route.map((id, position) => <span key={`${id}:${position}`}>{index.byId.get(id)!.name}</span>)}</div><div className="gp-dogstats"><span><b>{status.hops}</b>hops</span><span><b>{Math.round(status.distance).toLocaleString()}</b>km</span><span><b>{mastered.size}</b>unique borders</span></div>{!complete && <><p className="gp-note">Choose only a country adjacent to {index.byId.get(current)!.name}.</p><div className="gp-options">{options.map(id => <button onClick={() => move(id)} key={id}>{index.byId.get(id)!.name}</button>)}</div><button className="btn ghost sm" onClick={() => setGave(true)}>Concede hole</button></>}{complete && <div className="gp-feedback yes"><strong>{gave ? 'Hole conceded' : `${status.hops - hole.par > 0 ? '+' : ''}${status.hops - hole.par} on the hole`}</strong>{gave && <span>Canonical route: {hole.parPath.map(id => index.byId.get(id)!.name).join(' → ')}</span>}<button className="btn sm" onClick={next}>{at + 1 === length ? 'Finish course' : 'Next hole'}</button></div>}</div></section>
}

export default function Gameplay(props: Props) {
  const [index, setIndex] = useState<Countries | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { fetch('/meridian/data/countries.json').then(value => { if (!value.ok) throw new Error('Country atlas could not be loaded.'); return value.json() }).then((raw: MeridianSource) => setIndex(source(raw))).catch(value => setError(value instanceof Error ? value.message : 'Country atlas could not be loaded.')) }, [])
  if (error) return <section className="gp-shell"><div className="gp-card"><h2>{error}</h2><button className="btn" onClick={props.back}>Back</button></div><Style /></section>
  if (!index) return <section className="gp-shell"><div className="gp-card"><div className="result-kicker">Loading atlas</div><h2>Preparing your run…</h2></div><Style /></section>
  let scopeid = props.scope
  if (props.mode.group === 'daily' && typeof window !== 'undefined') {
    try { scopeid = (JSON.parse(localStorage.getItem(stamp(props.mode, props.seed)) || '{}') as { scope?: string }).scope ?? scopeid } catch {}
  }
  const selected = getscopes(index).find(item => item.id === scopeid) ?? getscope(index)
  return <>{props.mode.group === 'ranked' ? <Ranked mode={props.mode} scope={selected} back={props.back} /> : props.mode.id.endsWith('dogleg') ? <Dogleg index={index} scope={getscope(index)} holes={props.holes} seed={props.seed} mode={props.mode} back={props.back} /> : <Quiz index={index} mode={props.mode} scope={selected} seed={props.seed} back={props.back} />}<Style /></>
}

function Style() { return <style data-meridian="gameplay">{`
.gp-shell{min-height:calc(100dvh - 170px);padding:36px 0 80px}.gp-head{max-width:780px;margin:0 auto 14px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;color:var(--ink-3);font-size:12px}.gp-head .mr-back{margin:0;text-align:left}.gp-head strong{text-align:right;color:var(--ink)}.gp-card{max-width:780px;min-height:500px;margin:auto;padding:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-l);box-shadow:var(--shadow)}.gp-card h2{max-width:600px;margin:12px 0 26px;font-size:clamp(28px,5vw,46px);line-height:1.05;letter-spacing:-.04em}.gp-flag{width:min(300px,75%);max-height:190px;object-fit:contain;margin:0 0 24px;border-radius:8px;box-shadow:0 12px 30px -20px #000}.gp-options{width:min(100%,580px);display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:8px 0 20px}.gp-options button{min-height:58px;padding:12px;border:1px solid var(--line);border-radius:var(--r-s);background:var(--surface-2);color:var(--ink);font-weight:650;cursor:pointer}.gp-options button:hover{border-color:var(--brass)}.gp-options button:disabled{cursor:default;opacity:.55}.gp-form{width:min(100%,520px);display:flex;gap:8px}.gp-form input{flex:1}.gp-feedback{width:min(100%,580px);display:flex;align-items:center;gap:12px;margin-top:20px;padding:14px;border-radius:var(--r-s);background:var(--surface-2);text-align:left}.gp-feedback.no strong{color:#b3463d}.gp-feedback.yes strong{color:#377b54}.gp-feedback span{color:var(--ink-3);font-size:12px}.gp-feedback .btn{margin-left:auto;flex:none}.gp-tiles{width:100%}.gp-word{min-height:52px;font-size:25px;font-weight:700;letter-spacing:.12em}.gp-letters{display:flex;justify-content:center;flex-wrap:wrap;gap:5px}.gp-letters .chip{min-width:38px}.gp-actions{display:flex;justify-content:center;gap:8px;margin-top:22px}.gp-dial{width:min(100%,560px);display:flex;flex-direction:column;gap:10px}.gp-dial strong{font-size:44px;letter-spacing:-.04em}.gp-dial>span{margin-top:-14px;color:var(--ink-3)}.gp-dial input{width:100%;accent-color:var(--brass)}.gp-scale{display:flex;justify-content:space-between;color:var(--ink-3);font-size:10px}.gp-dial .btn{align-self:center;margin-top:12px}.gp-note{color:var(--ink-3);font-size:13px;margin:-12px 0 18px}.gp-result h1{font-size:80px;line-height:1;margin:18px}.gp-result h1 small{font-size:24px;color:var(--ink-3)}.gp-result p{color:var(--ink-2);margin-bottom:26px}.gp-withheld{max-width:550px;margin:-8px 0 26px;padding:12px;border:1px solid var(--line);border-radius:var(--r-s);color:var(--ink-3);font-size:12px}.gp-trail{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-bottom:18px}.gp-trail span{padding:7px 10px;background:var(--surface-2);border-radius:999px;font-size:12px}.gp-trail span+span:before{content:'→';margin-right:10px;color:var(--ink-3)}.gp-dogstats{display:flex;gap:1px;margin-bottom:25px;background:var(--line)}.gp-dogstats span{padding:12px 20px;background:var(--surface);font-size:10px;text-transform:uppercase;color:var(--ink-3)}.gp-dogstats b{display:block;color:var(--ink);font-size:17px}.gp-card>button.ghost{margin-top:4px}@media(max-width:600px){.gp-card{padding:30px 18px;min-height:450px}.gp-options{grid-template-columns:1fr}.gp-form{flex-direction:column}.gp-feedback{align-items:flex-start;flex-wrap:wrap}.gp-feedback .btn{margin-left:0}.gp-head{grid-template-columns:1fr auto}.gp-head span{display:none}.gp-dogstats span{padding:10px}.gp-result h1{font-size:60px}}
`}</style> }
