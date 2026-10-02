import { useEffect, useRef, useState } from 'react'
import './StudyPage.css'

type StudySession = {
  id: string
  startedAt: number
  endedAt: number
  durationMs: number
  reviewedTerms: string[]
}
type ActiveSession = {
  startedAt: number
  lastActivityAt: number
  lastTickAt: number
  durationMs: number
  reviewedTerms: string[]
}
type StudyData = { sessions: StudySession[]; active: ActiveSession | null }

const storageKey = 'ipa-sound-lab-study-v1'
const idleMs = 60_000
const minimumSessionMs = 5_000

function saveStudy(data: StudyData) {
  try { localStorage.setItem(storageKey, JSON.stringify(data)) } catch { /* Browser storage may be unavailable. */ }
}

function loadStudy(): StudyData {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!value || typeof value !== 'object') return { sessions: [], active: null }
    const data = value as { sessions?: unknown; active?: unknown }
    const sessions = Array.isArray(data.sessions) ? data.sessions.filter((item): item is StudySession =>
      item && typeof item.startedAt === 'number' && typeof item.endedAt === 'number' &&
      typeof item.durationMs === 'number' && Array.isArray(item.reviewedTerms)) : []
    const active = data.active as Record<string, unknown> | null
    // Preserve counted time from a prior manual or interrupted automatic session.
    if (active && typeof active.startedAt === 'number') {
      const durationMs = typeof active.durationMs === 'number' ? active.durationMs : typeof active.elapsedMs === 'number' ? active.elapsedMs : 0
      const id = `recovered-${active.startedAt}`
      if (durationMs >= minimumSessionMs && !sessions.some((session) => session.id === id)) {
        sessions.unshift({ id, startedAt: active.startedAt, endedAt: typeof active.lastTickAt === 'number' ? active.lastTickAt : Date.now(), durationMs, reviewedTerms: Array.isArray(active.reviewedTerms) ? active.reviewedTerms.filter((term): term is string => typeof term === 'string') : [] })
      }
    }
    const result: StudyData = { sessions, active: null }
    if (active) saveStudy(result)
    return result
  } catch { return { sessions: [], active: null } }
}

function formatClock(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatDuration(ms: number) {
  if (ms > 0 && ms < 60000) return '不足 1 分钟'
  const minutes = Math.floor(ms / 60000)
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

function dayKey(time: number) {
  const date = new Date(time)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function advance(active: ActiveSession, time: number): ActiveSession {
  const countedUntil = Math.min(time, active.lastActivityAt + idleMs)
  return { ...active, durationMs: active.durationMs + Math.max(0, countedUntil - active.lastTickAt), lastTickAt: countedUntil }
}

export function useStudyTracker() {
  const [data, setData] = useState<StudyData>(loadStudy)
  const dataRef = useRef(data)
  const [now, setNow] = useState(Date.now())

  function commit(next: StudyData) {
    dataRef.current = next
    setData(next)
    saveStudy(next)
  }

  function finish(time = Date.now()) {
    const current = dataRef.current
    if (!current.active) return
    const active = advance(current.active, time)
    const session: StudySession = { id: `${active.startedAt}-${time}`, startedAt: active.startedAt, endedAt: active.lastTickAt, durationMs: active.durationMs, reviewedTerms: active.reviewedTerms }
    commit({ sessions: active.durationMs >= minimumSessionMs ? [session, ...current.sessions] : current.sessions, active: null })
    setNow(time)
  }

  function recordActivity(term?: string) {
    if (document.hidden) return
    const time = Date.now()
    const current = dataRef.current
    let active = current.active
    if (active && time - active.lastActivityAt > idleMs) {
      finish(active.lastActivityAt + idleMs)
      active = null
    }
    if (!active) active = { startedAt: time, lastActivityAt: time, lastTickAt: time, durationMs: 0, reviewedTerms: [] }
    else active = advance(active, time)
    if (term && !active.reviewedTerms.includes(term)) active = { ...active, reviewedTerms: [...active.reviewedTerms, term] }
    // A burst of pointer or keyboard events should not create a storage write per event.
    if (!term && time - active.lastActivityAt < 2000 && current.active) return
    active = { ...active, lastActivityAt: time }
    commit({ ...dataRef.current, active })
    setNow(time)
  }

  useEffect(() => {
    const tick = () => {
      const time = Date.now()
      const active = dataRef.current.active
      if (active) {
        if (document.hidden || time - active.lastActivityAt >= idleMs) finish(time)
        else commit({ ...dataRef.current, active: advance(active, time) })
      }
      setNow(time)
    }
    const stopWhenHidden = () => { if (document.hidden) finish() }
    const stopWhenLeaving = () => finish()
    const timer = window.setInterval(tick, 5000)
    document.addEventListener('visibilitychange', stopWhenHidden)
    window.addEventListener('pagehide', stopWhenLeaving)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', stopWhenHidden)
      window.removeEventListener('pagehide', stopWhenLeaving)
    }
  }, [])

  return { ...data, now, finish, recordActivity }
}

type StudyTracker = ReturnType<typeof useStudyTracker>

export function StudyPage({ tracker }: { tracker: StudyTracker }) {
  const { sessions, active, now } = tracker
  const today = dayKey(now)
  const activeMs = active ? advance(active, now).durationMs : 0
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const key = dayKey(date.getTime())
    const ms = sessions.filter((session) => dayKey(session.endedAt) === key).reduce((sum, session) => sum + session.durationMs, 0) + (key === today ? activeMs : 0)
    return { key, label: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date), ms }
  })
  const todayMs = days[6].ms
  const weekMs = days.reduce((sum, day) => sum + day.ms, 0)
  const studyDays = days.filter((day) => day.ms >= 60000).length
  const reviewed = sessions.reduce((sum, session) => sum + session.reviewedTerms.length, 0) + (active?.reviewedTerms.length ?? 0)
  const maxMs = Math.max(30 * 60000, ...days.map((day) => day.ms))

  return <main id="study" className="study-page main-content">
    <div className="study-heading"><div><span className="section-overline">STUDY TIME</span><h1>学习记录</h1><p>在词库学习时，时间会自动记录。</p></div><a href="#vocab">返回词库</a></div>
    <section className="timer-card" aria-labelledby="timer-title"><div><span className="timer-kicker" id="timer-title">本次自动记录</span><div className="timer-value" role="timer" aria-live="off">{formatClock(activeMs)}</div><p>{active ? '正在记录学习时间。' : '打开词库，搜索、查看详情或播放发音后便会自动开始。'}</p></div>{active && <div className="timer-reviewed">本次查看 <strong>{active.reviewedTerms.length}</strong> 个词条</div>}</section>

    <section className="study-stats" aria-label="学习数据"><div><span>今天</span><strong>{formatDuration(todayMs)}</strong></div><div><span>近 7 天</span><strong>{formatDuration(weekMs)}</strong></div><div><span>学习天数</span><strong>{studyDays} / 7 天</strong></div><div><span>累计查看</span><strong>{reviewed} 词次</strong></div></section>

    <section className="study-section" aria-labelledby="week-title"><div className="study-section-head"><h2 id="week-title">近 7 天学习时间</h2><span>完成的记录按结束日期统计</span></div><div className="study-chart" role="img" aria-label={`近 7 天共学习 ${formatDuration(weekMs)}`}>{days.map((day) => <div className="study-day" key={day.key}><div className="study-bar-track"><div className="study-bar" style={{ height: `${Math.max(day.ms ? 5 : 0, day.ms / maxMs * 100)}%` }} /></div><strong>{Math.floor(day.ms / 60000)}</strong><span>{day.label}</span></div>)}</div></section>

    <section className="study-section" aria-labelledby="history-title"><div className="study-section-head"><h2 id="history-title">最近的学习</h2><span>{sessions.length} 次记录</span></div>{sessions.length ? <ul className="study-history">{sessions.slice(0, 8).map((session) => <li key={session.id}><div><strong>{new Date(session.endedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</strong><span>{new Date(session.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 开始</span></div><div><strong>{formatDuration(session.durationMs)}</strong><span>查看 {session.reviewedTerms.length} 词条</span></div></li>)}</ul> : <p className="study-empty">还没有学习记录。去词库查看单词后，这里会自动显示你的学习历史。</p>}</section>
    <p className="study-storage-note">只统计词库页面的活跃时间。隐藏页面或连续 60 秒无操作便停止；记录仅保存在当前浏览器。</p>
  </main>
}
