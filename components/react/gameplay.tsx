'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { deck, dogleg, graph, play, scope as getscope, scopes as getscopes, source, validate, type Countries, type DoglegCourse, type MeridianSource, type PublicQuestion, type Reveal, type Scope } from '@meridian/core'
import type { Mode } from './taxonomy'

type Props = { mode: Mode; scope: string; holes: 9 | 18; seed: string; back: () => void }
type Saved = { at: number; right: number; wrong: number; done: boolean }

const stamp = (mode: Mode, seed: string) => `meridian:daily:${seed}:${mode.id}`
const flag = (value: string) => value.startsWith('/') || value.startsWith('data:') ? value : `/meridian/flags/${value.toLowerCase()}.svg`
const warm = (value?: string) => { if (!value) return; const url = flag(value); if (url.startsWith('data:')) return; const img = new Image(); img.src = url; img.decode?.().catch(() => {}) }
const format = (value: number) => new Intl.NumberFormat('en', { notation: value >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

let atlas: Promise<Countries> | null = null
const load = () => atlas ??= fetch('/meridian/data/countries.json').then(value => { if (!value.ok) throw new Error('country atlas could not be loaded.'); return value.json() }).then((raw: MeridianSource) => source(raw))

function Tiles({ item, locked, right, submit }: { item: PublicQuestion; locked: boolean; right?: boolean | null; submit: (value: string) => void }) {
  const [used, setUsed] = useState<number[]>([])
  useEffect(() => setUsed([]), [item.id])
  const word = used.map(index => item.letters[index]).join('')
  return <div className="gp-tiles">
    <div className={`gp-word ${locked && right !== null ? (right ? 'correct' : 'wrong') : ''}`}>{word || 'build the answer'}</div>
    <div className="gp-letters">{item.letters.map((letter, index) => <button type="button" className="chip" disabled={locked || used.includes(index)} onClick={() => setUsed([...used, index])} key={`${letter}:${index}`}>{letter}</button>)}</div>
    <div className="gp-actions"><button className="btn ghost" type="button" disabled={locked || !used.length} onClick={() => setUsed(used.slice(0, -1))}>undo</button><button className="btn" type="button" disabled={locked || used.length !== item.letters.length} onClick={() => submit(word)}>check</button></div>
  </div>
}

function Dial({ item, locked, right, submit }: { item: PublicQuestion; locked: boolean; right?: boolean | null; submit: (value: number) => void }) {
  const [step, setStep] = useState(50)
  useEffect(() => setStep(50), [item.id])
  const value = Math.round(10 ** (3 + step / 100 * Math.log10(2e6)))
  return <div className="gp-dial"><strong className={locked && right !== null ? (right ? 'correct' : 'wrong') : ''}>{format(value)}</strong><span className="kicker">people</span><input type="range" min="0" max="100" step="0.1" value={step} disabled={locked} aria-label="population estimate" onChange={event => setStep(Number(event.target.value))} /><div className="gp-scale"><span>1 thousand</span><span>2 billion</span></div><button className="btn" type="button" disabled={locked} onClick={() => submit(value)}>lock estimate</button></div>
}

function Prompt({ item, locked, picked, correct, right, reveal, answer }: { item: PublicQuestion; locked: boolean; picked?: string | number | null; correct?: string | null; right?: boolean | null; reveal?: string | null; answer: (value: string | number) => void }) {
  const [input, setInput] = useState('')
  useEffect(() => setInput(''), [item.id])
  function send(event: FormEvent) { event.preventDefault(); if (input.trim()) answer(input) }
  const mark = (option: string) => {
    if (!locked) return ''
    if (correct === null) return option === picked ? 'picked' : ''
    return option === correct ? 'yes' : option === picked ? 'no' : ''
  }
  const typed = item.kind !== 'choice' && item.kind !== 'compare'
  return <>
    {item.flag && <img className="gp-flag" src={flag(item.flag)} alt="country flag" width="520" height="390" decoding="async" fetchPriority="high" />}
    <div className="gp-reveal">{reveal ?? ''}</div>
    <h2>{item.prompt}</h2>
    {item.note && <p className="gp-note">{item.note}</p>}
    {(item.kind === 'choice' || item.kind === 'compare') && <div className="gp-options">{item.options.map(option => <button type="button" className={mark(option)} disabled={locked} onClick={() => answer(option)} key={option}>{option}</button>)}</div>}
    {item.kind === 'text' && <form className="gp-form" onSubmit={send}><input className={`field ${locked && right !== null ? (right ? 'correct' : 'wrong') : ''}`} autoFocus value={input} disabled={locked} onChange={event => setInput(event.target.value)} placeholder="type a country" aria-label="answer" /><button className="btn" disabled={locked}>check</button></form>}
    {item.kind === 'tiles' && <Tiles item={item} locked={locked} right={right} submit={answer} />}
    {item.kind === 'dial' && <Dial item={item} locked={locked} right={right} submit={answer} />}
    {typed && <p className="gp-caption">{locked && !right && correct ? `answer: ${correct}` : ''}</p>}
  </>
}

function Next({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="btn gp-next" type="button" onClick={onClick}>{label}</button>
}

function Head({ back, label, score, meter }: { back: () => void; label: string; score: ReactNode; meter: ReactNode }) {
  return <header className="gp-head">
    <button className="btn quiet mr-back" type="button" onClick={back}>← {label}</button>
    <strong className="gp-score">score: {score}</strong>
    <span className="gp-meter">{meter}</span>
  </header>
}

function Quiz({ index, mode, scope, seed, back }: { index: Countries; mode: Mode; scope: Scope; seed: string; back: () => void }) {
  const survival = mode.id === 'casual-world'
  const questions = useMemo(() => deck(index, { mode: mode.id, seed: `${seed}:${mode.id}:${scope.id}`, scope, count: survival ? 100 : undefined }), [index, mode.id, scope, seed, survival])
  const key = stamp(mode, seed)
  const initial = useMemo(() => { if (mode.group !== 'daily') return null; try { const raw = JSON.parse(localStorage.getItem(key) || '') as Partial<Saved>; return { at: Math.min(Math.max(0, Number(raw.at) || 0), questions.length), right: Math.max(0, Number(raw.right) || 0), wrong: Math.max(0, Number(raw.wrong) || 0), done: Boolean(raw.done) } } catch { return null } }, [key, mode.group, questions.length])
  const [at, setAt] = useState(initial?.at ?? 0)
  const [right, setRight] = useState(initial?.right ?? 0)
  const [wrong, setWrong] = useState(initial?.wrong ?? 0)
  const [done, setDone] = useState(initial?.done ?? false)
  const [picked, setPicked] = useState<string | number | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const item = questions[Math.min(at, questions.length - 1)]!

  useEffect(() => {
    if (mode.group === 'daily') localStorage.setItem(key, JSON.stringify({ at, right, wrong, done, scope: scope.id }))
  }, [at, right, wrong, done, key, mode.group, scope.id])
  useEffect(() => {
    for (let i = at + 1; i < Math.min(at + 4, questions.length); i++) warm(questions[i]?.flag)
  }, [at, questions])

  function answer(value: string | number) {
    if (result !== null || done) return
    const good = validate(index, item, value)
    setPicked(value)
    setResult(good)
    if (good) setRight(value => value + 1); else setWrong(value => value + 1)
  }
  const last = survival ? wrong >= 3 || at + 1 >= questions.length : at + 1 >= questions.length
  function next() {
    if (last) setDone(true)
    else { setAt(value => value + 1); setResult(null); setPicked(null) }
  }

  if (done) return <Result right={right} wrong={wrong} back={back} />
  return <section className="gp-shell">
    <Head back={back} label="end run" score={right} meter={<>{at + 1} / {questions.length}{survival ? ` · ${wrong}/3` : ''}</>} />
    <div className="gp-card">
      <div className="gp-body">
        <div className="kicker">{item.topic}</div>
        <Prompt item={item} locked={result !== null} picked={picked} correct={result !== null ? item.answer : null} right={result} reveal={result !== null && item.value !== undefined && item.kind !== 'dial' ? `${format(item.value)} ${item.unit}` : null} answer={answer} />
      </div>
      <div className="gp-toolbar">{result !== null && <Next label={last ? 'finish' : 'next'} onClick={next} />}</div>
    </div>
  </section>
}

function Result({ right, wrong, back }: { right: number; wrong: number; back: () => void }) {
  const total = right + wrong
  return <section className="gp-shell"><div className="gp-card gp-result"><div className="kicker">run complete</div><h1>{right}<small> / {total}</small></h1><p>{total ? Math.round(right / total * 100) : 0}% accuracy · {wrong} missed</p><button className="btn" type="button" onClick={back}>return to modes</button></div></section>
}

type Issued = { run: string; season: string; q: number; qcount: number; expires: string; question: PublicQuestion }
type Answered = { q: number; correct: boolean; points: number; reveal: Reveal; next: { q: number; question: PublicQuestion } | null }
type Final = { score: number; correct: number; answered: number; elapsed: number; proof: string }
type Row = { username: string; best: number; runs: number }

const Clock = memo(function Clock({ expires, expire }: { expires: string; expire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, (new Date(expires).valueOf() - Date.now()) / 1000))
  const fired = useRef(false)
  useEffect(() => {
    const end = new Date(expires).valueOf()
    let frame = 0
    const tick = () => {
      const next = Math.max(0, (end - Date.now()) / 1000)
      setLeft(next)
      if (next <= 0) { if (!fired.current) { fired.current = true; expire() } return }
      frame = window.setTimeout(tick, 100)
    }
    tick()
    return () => window.clearTimeout(frame)
  }, [expires, expire])
  return <span aria-live="off">{left.toFixed(1)}s</span>
})

function Ranked({ mode, scope, back }: { mode: Mode; scope: Scope; back: () => void }) {
  const [issued, setIssued] = useState<Issued | null>(null)
  const [item, setItem] = useState<PublicQuestion | null>(null)
  const [q, setQ] = useState(1)
  const [picked, setPicked] = useState<string | number | null>(null)
  const [feedback, setFeedback] = useState<Answered | null>(null)
  const [result, setResult] = useState<Final | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [points, setPoints] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const finishing = useRef(false)
  const retry = useRef(0)
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(retry.current) } }, [])

  const finish = useCallback(async () => {
    if (!issued || finishing.current || result) return
    finishing.current = true
    try {
      const response = await post('/api/ranked/finish', { run: issued.run })
      const data = await response.json().catch(() => null) as (Final & { error?: string }) | null
      if (!alive.current) return
      if (response.status === 409) { finishing.current = false; retry.current = window.setTimeout(() => void finish(), 250); return }
      if (!response.ok || !data) throw new Error(data?.error || 'ranked result unavailable')
      setResult(data)
    } catch (value) {
      if (alive.current) setError(value instanceof Error ? value.message : 'ranked result unavailable')
    } finally {
      finishing.current = false
    }
  }, [issued, result])

  useEffect(() => {
    let live = true
    setIssued(null); setItem(null); setQ(1); setPoints(0); setFeedback(null); setResult(null); setError('')
    post('/api/ranked/issue', { game: mode.id, scope: scope.id })
      .then(async response => {
        const data = await response.json().catch(() => null) as (Issued & { error?: string }) | null
        if (!live) return
        if (!response.ok || !data) throw new Error(data?.error || 'ranked is unavailable')
        setIssued(data); setItem(data.question); setQ(data.q)
      })
      .catch(value => live && setError(value instanceof Error ? value.message : 'ranked is unavailable'))
    return () => { live = false }
  }, [mode.id, scope.id])

  useEffect(() => {
    if (!result || !issued) return
    const query = new URLSearchParams({ board: 'ranked', game: mode.id, scope: scope.id, season: issued.season, limit: '5' })
    fetch(`/api/leaderboard?${query}`).then(response => response.ok ? response.json() : null).then((data: { rows?: Row[] } | null) => alive.current && setRows(data?.rows ?? [])).catch(() => {})
  }, [issued, mode.id, result, scope.id])

  async function answer(value: string | number) {
    if (!issued || !item || feedback || busy || result) return
    setBusy(true)
    setPicked(value)
    const send = async (attempt = 0): Promise<Response> => {
      try { return await post('/api/ranked/answer', { run: issued.run, q, answer: value }) }
      catch { if (attempt < 1) return send(attempt + 1); throw new Error('ranked request failed') }
    }
    try {
      const response = await send()
      const data = await response.json().catch(() => null) as (Answered & { error?: string }) | null
      if (!alive.current) return
      if (!response.ok || !data) {
        if (response.status === 409) { await finish(); return }
        throw new Error(data?.error || 'answer could not be saved')
      }
      setFeedback(data)
      setPoints(total => total + data.points)
      setError('')
    } catch (value) {
      if (alive.current) setError(value instanceof Error ? value.message : 'answer could not be saved')
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  function next() {
    if (!feedback?.next) { void finish(); return }
    setQ(feedback.next.q); setItem(feedback.next.question); setFeedback(null); setPicked(null); setError('')
  }

  if (error && !issued) return <section className="gp-shell"><div className="gp-card gp-result"><div className="kicker">ranked unavailable</div><h2>{error === 'login required' ? 'log in to play ranked.' : error}</h2><button className="btn" type="button" onClick={back}>return to modes</button></div></section>
  if (!issued || !item) return <section className="gp-shell"><div className="gp-card gp-result"><div className="kicker">ranked</div><h2>issuing your server run</h2></div></section>
  if (result) return <section className="gp-shell"><div className="gp-card gp-result"><div className="kicker">verified result</div><h1>{result.score}<small> points</small></h1><p>{result.correct} correct · {result.answered} answered · {(result.elapsed / 1000).toFixed(1)} seconds</p>{rows.length > 0 && <div className="gp-board"><strong>{issued.season} leaderboard</strong>{rows.map((row, at) => <span key={row.username}>{at + 1}. {row.username} · {row.best}</span>)}</div>}<button className="btn" type="button" onClick={back}>return to modes</button></div></section>
  return <section className="gp-shell">
    <Head back={back} label="end run" score={points} meter={<Clock expires={issued.expires} expire={finish} />} />
    <div className="gp-card">
      <div className="gp-body">
        <div className="kicker">{item.topic} · {q}</div>
        <Prompt item={item} locked={Boolean(feedback) || busy} picked={picked} correct={feedback?.reveal.answer ?? null} right={feedback?.correct ?? null} reveal={feedback?.reveal.value !== undefined && item.kind !== 'dial' ? `${format(feedback.reveal.value)} ${feedback.reveal.unit}` : null} answer={answer} />
        {error && <div className="mr-notice">{error}</div>}
      </div>
      <div className="gp-toolbar">{feedback && <Next label={feedback.next ? 'next' : 'finish'} onClick={next} />}</div>
    </div>
  </section>
}

type Course = { at?: number; route?: string[]; scores?: number[]; trails?: number[]; gave?: boolean; mastered?: string[]; holes?: 9 | 18 }

function Dogleg({ index, scope, holes, seed, mode, back }: { index: Countries; scope: Scope; holes: 9 | 18; seed: string; mode: Mode; back: () => void }) {
  const key = stamp(mode, seed)
  const saved = useMemo<Course>(() => { if (mode.group !== 'daily') return {}; try { const raw = JSON.parse(localStorage.getItem(key) || '{}') as Course; return { ...raw, holes: raw.holes === 18 ? 18 : raw.holes === 9 ? 9 : undefined, at: Math.max(0, Number(raw.at) || 0) } } catch { return {} } }, [key, mode.group])
  const length = saved.holes ?? holes
  const course = useMemo(() => { try { return dogleg(index, { holes: length, seed: `${seed}:${scope.id}:${length}`, scope: scope.countries }) } catch { return null } }, [index, length, scope, seed])
  if (!course) return <section className="gp-shell"><div className="gp-card gp-result"><div className="kicker">dogleg</div><h2>{scope.label} is too small for a full course.</h2><p>pick a larger region and try again.</p><button className="btn" onClick={back}>back</button></div></section>
  return <Holes key={`${key}:${length}`} index={index} scope={scope} course={course} saved={saved} length={length} storage={mode.group === 'daily' ? key : null} back={back} />
}

function Holes({ index, scope, course, saved, length, storage, back }: { index: Countries; scope: Scope; course: DoglegCourse; saved: Course; length: 9 | 18; storage: string | null; back: () => void }) {
  const [at, setAt] = useState(Math.min(saved.at ?? 0, course.holes.length))
  const safe = Math.min(at, course.holes.length - 1)
  const hole = course.holes[safe]!
  const valid = Array.isArray(saved.route) && saved.route.length > 0 && saved.route[0] === hole.from && saved.route.every(id => index.byId.has(id))
  const [route, setRoute] = useState<string[]>(valid ? saved.route! : [hole.from])
  const [scores, setScores] = useState<number[]>(Array.isArray(saved.scores) ? saved.scores.slice(0, safe) : [])
  const [trails, setTrails] = useState<number[]>(Array.isArray(saved.trails) ? saved.trails.slice(0, safe) : [])
  const [gave, setGave] = useState(Boolean(saved.gave))
  const [mastered, setMastered] = useState<Set<string>>(new Set(Array.isArray(saved.mastered) ? saved.mastered : []))
  const map = useMemo(() => graph(index, scope.countries), [index, scope])
  const current = route.at(-1) ?? hole.from
  const options = map.adj.get(current) ?? []
  const status = play(index, hole, route, scope.countries)
  const complete = status.reached || gave
  const name = (id: string) => index.byId.get(id)!.name
  useEffect(() => { if (storage) localStorage.setItem(storage, JSON.stringify({ at, route, scores, trails, gave, mastered: [...mastered], holes: length })) }, [at, route, scores, trails, gave, mastered, storage, length])

  function move(id: string) {
    if (complete) return
    const edge = [current, id].sort().join(':')
    setMastered(old => old.has(edge) ? old : new Set([...old, edge]))
    setRoute([...route, id])
  }
  function next() {
    const hops = status.reached ? status.hops : hole.par + 2
    setScores([...scores, hops])
    setTrails([...trails, status.hops])
    if (at + 1 === course.holes.length) { setAt(course.holes.length); return }
    setAt(at + 1); setRoute([course.holes[at + 1]!.from]); setGave(false)
  }
  if (at >= course.holes.length) {
    const scored = scores.reduce((sum, value) => sum + value, 0)
    const actual = trails.reduce((sum, value) => sum + value, 0)
    const delta = scored - course.totalPar
    return <section className="gp-shell"><div className="gp-card gp-result"><div className="kicker">course complete</div><h1>{delta > 0 ? '+' : ''}{delta}</h1><p>par {course.totalPar} · scored {scored} · {actual} hops traveled · {Math.round(course.totalDistance).toLocaleString()} km</p><button className="btn" onClick={back}>return to modes</button></div></section>
  }
  const standing = scores.reduce((sum, value, i) => sum + value - course.holes[i]!.par, 0)
  return <section className="gp-shell">
    <Head back={back} label="end course" score={<>{standing > 0 ? '+' : ''}{standing}</>} meter={<>hole {at + 1} / {length}</>} />
    <div className="gp-card">
      <div className="gp-body">
        <div className="kicker">par {hole.par}</div>
        <h2>{name(hole.from)} → {name(hole.to)}</h2>
        <div className="gp-trail">{route.map((id, position) => <span key={`${id}:${position}`}>{name(id)}</span>)}</div>
        <div className="gp-dogstats"><span><b>{status.hops}</b>hops</span><span><b>{Math.round(status.distance).toLocaleString()}</b>km</span><span><b>{mastered.size}</b>borders</span></div>
        <p className="gp-note">{!complete ? `choose a country adjacent to ${name(current)}.` : ''}</p>
        <div className="gp-options">{options.map(id => <button type="button" onClick={() => move(id)} disabled={complete} key={id}>{name(id)}</button>)}</div>
        <p className={`gp-caption ${complete ? (gave ? 'wrong' : 'correct') : ''}`}>{complete ? (gave ? `conceded · scored as par +2 · shortest route: ${hole.parPath.map(name).join(' → ')}` : `${status.hops - hole.par > 0 ? '+' : ''}${status.hops - hole.par} on the hole`) : ''}</p>
        {!complete && <button className="btn quiet" type="button" onClick={() => setGave(true)}>concede hole</button>}
      </div>
      <div className="gp-toolbar">{complete && <Next label={at + 1 === length ? 'finish course' : 'next hole'} onClick={next} />}</div>
    </div>
  </section>
}

export default function Gameplay(props: Props) {
  const [index, setIndex] = useState<Countries | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { let live = true; load().then(value => live && setIndex(value)).catch(value => live && setError(value instanceof Error ? value.message : 'country atlas could not be loaded.')); return () => { live = false } }, [])
  useEffect(() => {
    const body = document.body
    const previous = body.style.overflow
    body.style.overflow = 'hidden'
    return () => { body.style.overflow = previous }
  }, [])
  if (error) return <section className="gp-shell"><div className="gp-card"><h2>{error}</h2><button className="btn" onClick={props.back}>back</button></div></section>
  if (!index) return <section className="gp-shell"><div className="gp-card"><div className="kicker">loading atlas</div><h2>preparing your run</h2></div></section>
  let scopeid = props.scope
  if (props.mode.group === 'daily') {
    try { scopeid = (JSON.parse(localStorage.getItem(stamp(props.mode, props.seed)) || '{}') as { scope?: string }).scope ?? scopeid } catch {}
  }
  const selected = getscopes(index).find(item => item.id === scopeid) ?? getscope(index)
  if (props.mode.group === 'ranked') return <Ranked mode={props.mode} scope={selected} back={props.back} />
  if (props.mode.id.endsWith('dogleg')) return <Dogleg index={index} scope={selected} holes={props.holes} seed={props.seed} mode={props.mode} back={props.back} />
  return <Quiz index={index} mode={props.mode} scope={selected} seed={props.seed} back={props.back} />
}
