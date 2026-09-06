'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { deck, dogleg, graph, play, scope as getscope, scopes as getscopes, source, validate, type Countries, type DoglegCourse, type MeridianSource, type PublicQuestion, type Reveal, type Scope } from '@meridian/core'
import { Back } from './icons'
import type { Format, Mode } from './taxonomy'

type Props = { mode: Mode; scope: string; holes: 9 | 18; format: Format; seed: string; back: () => void }
type Entry = { ok: boolean; flag?: string; label: string }
type Saved = { at: number; right: number; wrong: number; done: boolean; log?: Entry[] }

const stamp = (mode: Mode, seed: string) => `meridian:daily:${seed}:${mode.id}`
const flag = (value: string) => value.startsWith('/') || value.startsWith('data:') ? value : `/meridian/flags/${value.toLowerCase()}.svg`
const warm = (value?: string) => { if (!value) return; const url = flag(value); if (url.startsWith('data:')) return; const img = new Image(); img.src = url; if (typeof img.decode === 'function') img.decode().catch(() => {}) }
const format = (value: number) => new Intl.NumberFormat('en', { notation: value >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

let atlas: Promise<Countries> | null = null
const load = () => { if (!atlas) atlas = fetch('/meridian/data/countries.json').then(value => { if (!value.ok) throw new Error('country atlas could not be loaded.'); return value.json() }).then((raw: MeridianSource) => source(raw)).catch(reason => { atlas = null; throw reason }); return atlas }

function Tiles({ item, locked, right, submit }: { item: PublicQuestion; locked: boolean; right?: boolean | null; submit: (value: string) => void }) {
  const [used, setUsed] = useState<number[]>([])
  useEffect(() => setUsed([]), [item.id])
  const word = used.map(index => item.letters[index]).join('')
  return <div className="gp-tiles">
    <div className={`gp-word ${locked && right !== null ? (right ? 'correct' : 'wrong') : ''}`}>{word || 'build the answer'}</div>
    <div className="gp-letters">{item.letters.map((letter, index) => <button type="button" className="chip" disabled={locked || used.includes(index)} onClick={() => setUsed(prev => [...prev, index])} key={`${letter}:${index}`}>{letter}</button>)}</div>
    <div className="gp-actions"><button className="btn ghost" type="button" disabled={locked || !used.length} onClick={() => setUsed(prev => prev.slice(0, -1))}>undo</button><button className="btn" type="button" disabled={locked || used.length !== item.letters.length} onClick={() => submit(word)}>check</button></div>
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
  return <button className="btn" type="button" onClick={onClick}>{label}</button>
}

function Head({ back, label, score, meter }: { back: () => void; label: string; score: ReactNode; meter: ReactNode }) {
  return <header className="gp-head">
    <button className="btn quiet mr-back" type="button" onClick={back}><Back />{label}</button>
    <strong className="gp-score">score: {score}</strong>
    <span className="gp-meter">{meter}</span>
  </header>
}

type Stat = { value: ReactNode; label: string }
type Miss = { flag?: string; label: string }

function Stats({ items }: { items: Stat[] }) {
  return <div className="gp-stats">{items.map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>
}

function Marks({ marks }: { marks: boolean[] }) {
  if (!marks.length) return null
  return <div className="gp-marks" aria-hidden="true">{marks.map((ok, at) => <span key={at} className={ok ? 'on' : ''} />)}</div>
}

function Review({ misses }: { misses: Miss[] }) {
  if (!misses.length) return null
  return <div className="gp-review">
    <div className="kicker">worth another look</div>
    <ul>{misses.map((miss, at) => <li key={`${miss.label}:${at}`}>{miss.flag ? <img src={flag(miss.flag)} alt="" width="34" height="26" loading="lazy" decoding="async" /> : <span className="gp-review-mark" />}<span>{miss.label}</span></li>)}</ul>
  </div>
}

const bestkey = (id: string) => `meridian:best:${id}`
function record(id: string, score: number, lower = false) {
  try {
    const raw = localStorage.getItem(bestkey(id))
    const prev = raw === null ? null : Number(raw)
    const beaten = prev !== null && Number.isFinite(prev) && (lower ? score < prev : score > prev)
    if (prev === null || beaten) localStorage.setItem(bestkey(id), String(score))
    return beaten
  } catch { return false }
}

function shareScore(title: string, score: string, marks: boolean[]) {
  const grid = marks.map((ok, at) => (ok ? '\u25a0' : '\u25a1') + ((at + 1) % 10 === 0 ? '\n' : '')).join('')
  const text = `meridian ${title} \u2014 ${score}\n${grid}\nmeridianflags.com`
  try {
    if (typeof navigator !== 'undefined' && navigator.share) { void navigator.share({ text }).catch(() => {}); return }
    void navigator.clipboard?.writeText(text).catch(() => {})
  } catch {}
}

function Quiz({ index, mode, scope, format: run, seed, back }: { index: Countries; mode: Mode; scope: Scope; format: Format; seed: string; back: () => void }) {
  const cycle = mode.group === 'casual' && run === 'cycle'
  const timed = mode.group === 'casual' && run === 'minute'
  const count = mode.group === 'daily' ? undefined : cycle ? scope.countries.length : timed ? 120 : 25
  const questions = useMemo(() => deck(index, { mode: mode.id, seed: `${seed}:${mode.id}:${scope.id}:${run}`, scope, count }), [count, index, mode.id, run, scope, seed])
  const key = stamp(mode, seed)
  const initial = useMemo(() => { if (mode.group !== 'daily') return null; try { const raw = JSON.parse(localStorage.getItem(key) || '') as Partial<Saved>; return { at: Math.min(Math.max(0, Number(raw.at) || 0), Math.max(0, questions.length - 1)), right: Math.max(0, Number(raw.right) || 0), wrong: Math.max(0, Number(raw.wrong) || 0), done: Boolean(raw.done), log: Array.isArray(raw.log) ? raw.log : [] } } catch { return null } }, [key, mode.group, questions.length])
  const [at, setAt] = useState(initial?.at ?? 0)
  const [right, setRight] = useState(initial?.right ?? 0)
  const [wrong, setWrong] = useState(initial?.wrong ?? 0)
  const [done, setDone] = useState(initial?.done ?? false)
  const [log, setLog] = useState<Entry[]>(initial?.log ?? [])
  const [picked, setPicked] = useState<string | number | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const started = useRef(Date.now())
  const [expires] = useState(() => new Date(Date.now() + 60_000).toISOString())
  const finish = useCallback(() => setDone(true), [])
  const item = questions[Math.min(at, questions.length - 1)]!

  useEffect(() => {
    if (mode.group === 'daily') localStorage.setItem(key, JSON.stringify({ at, right, wrong, done, log, scope: scope.id }))
  }, [at, right, wrong, done, log, key, mode.group, scope.id])
  useEffect(() => {
    for (let i = at + 1; i < Math.min(at + 4, questions.length); i++) warm(questions[i]?.flag)
  }, [at, questions])

  function answer(value: string | number) {
    if (result !== null || done) return
    const good = validate(index, item, value)
    setPicked(value)
    setResult(good)
    setLog(prev => [...prev, { ok: good, flag: item.flag, label: String(item.answer) }])
    if (good) setRight(value => value + 1); else setWrong(value => value + 1)
  }
  const last = (cycle && wrong >= 3) || at + 1 >= questions.length
  function next() {
    if (last) setDone(true)
    else { setAt(value => value + 1); setResult(null); setPicked(null) }
  }

  if (done) {
    const total = right + wrong
    const accuracy = total ? Math.round(right / total * 100) : 0
    const elapsed = Date.now() - started.current
    const kind: Format | 'daily' = mode.group === 'daily' ? 'daily' : run
    const label = kind === 'best' ? 'best of 25' : kind === 'minute' ? 'one minute' : kind === 'cycle' ? 'the cycle' : 'daily complete'
    const marks = log.map(entry => entry.ok)
    const misses = log.filter(entry => !entry.ok).map(entry => ({ flag: entry.flag, label: entry.label }))
    const beaten = record(`${mode.id}:${scope.id}:${run}`, right)
    const stats: Stat[] = [
      { value: `${accuracy}%`, label: 'accuracy' },
      { value: right, label: 'correct' },
      { value: total, label: 'questions' },
      { value: kind === 'minute' ? `${Math.min(60, elapsed / 1000).toFixed(1)}s` : wrong, label: kind === 'minute' ? 'time' : 'missed' },
    ]
    return <Result sub={label} headline={right} tag={beaten ? 'new personal best' : undefined} marks={marks} stats={stats} misses={misses} share={mode.group === 'daily' ? () => shareScore(`${mode.name} daily`, String(right), marks) : undefined} back={back} />
  }
  return <section className="gp-shell">
    <Head back={back} label="end run" score={right} meter={timed ? <Clock expires={expires} expire={finish} /> : <>{at + 1} / {questions.length}{cycle ? ` · ${wrong}/3` : ''}</>} />
    <div className="gp-card">
      <div className="gp-body">
        <div className="kicker">{item.topic}</div>
        <Prompt item={item} locked={result !== null} picked={picked} correct={result !== null ? item.answer : null} right={result} reveal={result !== null && item.value !== undefined && item.kind !== 'dial' ? `${format(item.value)} ${item.unit}` : null} answer={answer} />
      </div>
      <div className="gp-toolbar">{result !== null && <Next label={last ? 'finish' : 'next'} onClick={next} />}</div>
    </div>
  </section>
}

function Result({ sub, headline, tag, marks, stats, misses, board, share, back }: {
  sub: string
  headline: ReactNode
  tag?: string
  marks?: boolean[]
  stats: Stat[]
  misses?: Miss[]
  board?: { title: string; rows: Row[] }
  share?: () => void
  back: () => void
}) {
  return <section className="gp-shell"><div className="gp-card gp-result">
    <div className="gp-result-body">
      <div className="kicker">{sub}</div>
      <h1>{headline}</h1>
      {tag ? <p className="gp-best">{tag}</p> : null}
      {marks ? <Marks marks={marks} /> : null}
      <Stats items={stats} />
      {misses ? <Review misses={misses} /> : null}
      {board && board.rows.length ? <div className="gp-board"><strong>{board.title}</strong>{board.rows.map((row, at) => <span key={row.username}>{at + 1}. {row.username} · {row.best}</span>)}</div> : null}
    </div>
    <div className="gp-endbtns">
      {share ? <button className="btn ghost" type="button" onClick={share}>share score</button> : null}
      <button className="btn" type="button" onClick={back}>return to modes</button>
    </div>
  </div></section>
}

type Issued = { run: string; season: string; q: number; qcount: number; expires: string; question: PublicQuestion }
type Answered = { q: number; correct: boolean; points: number; reveal: Reveal; next: { q: number; question: PublicQuestion } | null }
type Final = { score: number; correct: number; answered: number; elapsed: number; proof: string }
type Row = { username: string; best: number; runs: number }

const Clock = memo(function Clock({ expires, expire }: { expires: string; expire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, (new Date(expires).valueOf() - Date.now()) / 1000))
  const fired = useRef(false)
  useEffect(() => {
    fired.current = false
    const end = new Date(expires).valueOf()
    const next = Math.max(0, (end - Date.now()) / 1000)
    setLeft(next)
    let frame = 0
    const tick = () => {
      const remaining = Math.max(0, (end - Date.now()) / 1000)
      setLeft(remaining)
      if (remaining <= 0) { if (!fired.current) { fired.current = true; expire() } return }
      frame = window.setTimeout(tick, 100)
    }
    frame = window.setTimeout(tick, 100)
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
  const [log, setLog] = useState<Entry[]>([])
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
    setIssued(null); setItem(null); setQ(1); setPoints(0); setLog([]); setFeedback(null); setResult(null); setError(''); setBusy(false); setPicked(null)
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
    const shown = item
    // one idempotent retry: the server dedupes by (run, q), so re-sending is safe
    const send = async (attempt = 0): Promise<Response> => {
      try { return await post('/api/ranked/answer', { run: issued.run, q, answer: value }) }
      catch { if (attempt < 1) return send(attempt + 1); throw new Error('offline') }
    }
    try {
      const response = await send()
      const data = await response.json().catch(() => null) as (Answered & { error?: string }) | null
      if (!alive.current) return
      if (!response.ok || !data) {
        // any rejection here means the run is over or unrecoverable: settle it so
        // the verified score and leaderboard still show, never a dead-end error
        await finish()
        return
      }
      setFeedback(data)
      setPoints(total => total + data.points)
      setLog(prev => [...prev, { ok: Boolean(data.correct), flag: shown?.flag, label: String(data.reveal.answer) }])
      setError('')
    } catch {
      // both network attempts failed: settle the run rather than losing it
      if (alive.current) await finish()
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
  if (result) {
    const accuracy = result.answered ? Math.round(result.correct / result.answered * 100) : 0
    const marks = log.map(entry => entry.ok)
    const misses = log.filter(entry => !entry.ok).map(entry => ({ flag: entry.flag, label: entry.label }))
    const beaten = record(`${mode.id}:${scope.id}`, result.score)
    const stats: Stat[] = [
      { value: `${accuracy}%`, label: 'accuracy' },
      { value: result.correct, label: 'correct' },
      { value: result.answered, label: 'questions' },
      { value: `${(result.elapsed / 1000).toFixed(1)}s`, label: 'time' },
    ]
    return <Result sub="verified result" headline={result.score} tag={beaten ? 'new personal best' : undefined} marks={marks} stats={stats} misses={misses} board={{ title: `${issued.season} leaderboard`, rows }} back={back} />
  }
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
  return <Holes key={`${key}:${length}`} index={index} scope={scope} course={course} saved={saved} length={length} mode={mode} storage={mode.group === 'daily' ? key : null} back={back} />
}

function Holes({ index, scope, course, saved, length, mode, storage, back }: { index: Countries; scope: Scope; course: DoglegCourse; saved: Course; length: 9 | 18; mode: Mode; storage: string | null; back: () => void }) {
  const [at, setAt] = useState(Math.min(saved.at ?? 0, course.holes.length))
  const safe = Math.min(at, course.holes.length)
  const hole = course.holes[Math.min(at, course.holes.length - 1)]!
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
    setRoute(prev => [...prev, id])
  }
  function next() {
    const hops = status.reached ? status.hops : hole.par + 2
    setScores(prev => [...prev, hops])
    setTrails(prev => [...prev, status.hops])
    if (at + 1 === course.holes.length) { setAt(course.holes.length); return }
    setAt(at + 1); setRoute([course.holes[at + 1]!.from]); setGave(false)
  }
  if (at >= course.holes.length) {
    const scored = scores.reduce((sum, value) => sum + value, 0)
    const actual = trails.reduce((sum, value) => sum + value, 0)
    const delta = scored - course.totalPar
    const marks = scores.map((value, i) => value <= course.holes[i]!.par)
    const misses = scores
      .map((value, i) => ({ value, i }))
      .filter(entry => entry.value > course.holes[entry.i]!.par)
      .map(entry => ({ flag: course.holes[entry.i]!.to, label: `${name(course.holes[entry.i]!.from)} → ${name(course.holes[entry.i]!.to)}` }))
    const beaten = record(`${mode.id}:${scope.id}:${length}`, delta, true)
    const stats: Stat[] = [
      { value: course.totalPar, label: 'course par' },
      { value: scored, label: 'strokes' },
      { value: actual, label: 'hops' },
      { value: `${Math.round(course.totalDistance).toLocaleString()} km`, label: 'distance' },
    ]
    return <Result sub="course complete" headline={<>{delta > 0 ? '+' : ''}{delta} <span className="gp-unit">to par</span></>} tag={beaten ? 'new personal best' : undefined} marks={marks} stats={stats} misses={misses} share={mode.group === 'daily' ? () => shareScore(`${mode.name} daily`, `${delta > 0 ? '+' : ''}${delta} to par`, marks) : undefined} back={back} />
  }
  const standing = scores.reduce((sum, value, i) => sum + value - course.holes[i]!.par, 0)
  return <section className="gp-shell">
    <Head back={back} label="end course" score={<>{standing > 0 ? '+' : ''}{standing}</>} meter={<>hole {at + 1} / {length}</>} />
    <div className="gp-card">
      <div className="gp-body">
        <div className="gp-holes" aria-hidden="true">{course.holes.map((_, i) => <span key={i} className={i < at ? 'done' : i === at ? 'on' : ''} />)}</div>
        <div className="gp-legs">
          <div className="gp-leg"><img className="gp-legflag" src={flag(hole.from)} alt="" width="120" height="90" decoding="async" /><strong>{name(hole.from)}</strong><span className="kicker">from</span></div>
          <span className="gp-arrow" aria-hidden="true">→</span>
          <div className="gp-leg"><img className="gp-legflag" src={flag(hole.to)} alt="" width="120" height="90" decoding="async" /><strong>{name(hole.to)}</strong><span className="kicker">to</span></div>
        </div>
        <div className="kicker gp-parline">par {hole.par} · <b>{status.hops}</b> hops · <b>{Math.round(status.distance).toLocaleString()}</b> km</div>
        <div className="gp-trail">{route.map((id, position) => <span key={`${id}:${position}`}>{name(id)}</span>)}</div>
        <p className="gp-note">{!complete ? <>from <b>{name(current)}</b> — where next?</> : ''}</p>
        <div className="gp-options gp-neighbours">{options.map(id => <button type="button" className="gp-neighbour" onClick={() => move(id)} disabled={complete} key={id}><img src={flag(id)} alt="" width="40" height="30" decoding="async" loading="lazy" /><span>{name(id)}</span></button>)}</div>
        <p className={`gp-caption ${complete ? (gave ? 'wrong' : 'correct') : ''}`}>{complete ? (gave ? `conceded · scored as par +2 · shortest route: ${hole.parPath.map(name).join(' → ')}` : `${status.hops - hole.par > 0 ? '+' : ''}${status.hops - hole.par} on the hole`) : ''}</p>
        {!complete && <button className="btn quiet" type="button" onClick={() => setGave(true)}>show the way</button>}
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
    const root = document.documentElement
    root.setAttribute('data-locked', '')
    return () => root.removeAttribute('data-locked')
  }, [])
  const selected = useMemo(() => index ? (getscopes(index).find(item => item.id === props.scope) ?? getscope(index)) : null, [index, props.scope])
  if (error) return <section className="gp-shell"><div className="gp-card"><h2>{error}</h2><button className="btn" onClick={props.back}>back</button></div></section>
  if (!index || !selected) return <section className="gp-shell"><div className="gp-card"><div className="kicker">loading atlas</div><h2>preparing your run</h2></div></section>
  if (props.mode.group === 'ranked') return <Ranked mode={props.mode} scope={selected} back={props.back} />
  if (props.mode.id.endsWith('dogleg')) return <Dogleg index={index} scope={selected} holes={props.holes} seed={props.seed} mode={props.mode} back={props.back} />
  return <Quiz index={index} mode={props.mode} scope={selected} format={props.format} seed={props.seed} back={props.back} />
}
