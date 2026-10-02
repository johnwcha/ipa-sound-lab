import { useEffect, useState } from 'react'
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
  runStartedAt: number | null
  elapsedMs: number
  reviewedTerms: string[]
}
type StudyData = { sessions: StudySession[]; active: ActiveSession | null }

const storageKey = 'ipa-sound-lab-study-v1'
const emptyData: StudyData = { sessions: [], active: null }

function loadStudy(): StudyData {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!value || typeof value !== 'object') return emptyData
    const data = value as Partial<StudyData>
    const sessions = Array.isArray(data.sessions) ? data.sessions.filter((item): item is StudySession =>
      item && typeof item.startedAt === 'number' && typeof item.endedAt === 'number' &&
      typeof item.durationMs === 'number' && Array.isArray(item.reviewedTerms)) : []
    const active = data.active && typeof data.active.startedAt === 'number' &&
      typeof data.active.elapsedMs === 'number' && Array.isArray(data.active.reviewedTerms) &&
      (data.active.runStartedAt === null || typeof data.active.runStartedAt === 'number') ? data.active : null
    return { sessions, active }
  } catch { return emptyData }
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

export function useStudyTracker() {
  const [data, setData] = useState<StudyData>(loadStudy)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (data.active?.runStartedAt === null || !data.active) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [data.active])

  useEffect(() => {
    if (!data.active || data.active.runStartedAt === null) return
    const pauseOnLeave = () => {
      const active = data.active
      if (!active || active.runStartedAt === null) return
      const paused = { ...active, elapsedMs: active.elapsedMs + Date.now() - active.runStartedAt, runStartedAt: null }
      try { localStorage.setItem(storageKey, JSON.stringify({ ...data, active: paused })) } catch { /* Browser storage may be unavailable. */ }
    }
    window.addEventListener('pagehide', pauseOnLeave)
    return () => window.removeEventListener('pagehide', pauseOnLeave)
  }, [data])

  function commit(next: StudyData) {
    setData(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Browser storage may be unavailable. */ }
  }

  function start() {
    const time = Date.now()
    const active = data.active
      ? { ...data.active, runStartedAt: time }
      : { startedAt: time, runStartedAt: time, elapsedMs: 0, reviewedTerms: [] }
    setNow(time)
    commit({ ...data, active })
  }

  function pause() {
    if (!data.active || data.active.runStartedAt === null) return
    const time = Date.now()
    commit({ ...data, active: { ...data.active, elapsedMs: data.active.elapsedMs + time - data.active.runStartedAt, runStartedAt: null } })
    setNow(time)
  }

  function finish() {
    const active = data.active
    if (!active) return
    const time = Date.now()
    const durationMs = active.elapsedMs + (active.runStartedAt === null ? 0 : time - active.runStartedAt)
    const session: StudySession = { id: `${active.startedAt}-${time}`, startedAt: active.startedAt, endedAt: time, durationMs, reviewedTerms: active.reviewedTerms }
    commit({ sessions: durationMs >= 1000 ? [session, ...data.sessions] : data.sessions, active: null })
  }

  function markReviewed(term: string) {
    if (!data.active || data.active.reviewedTerms.includes(term)) return
    commit({ ...data, active: { ...data.active, reviewedTerms: [...data.active.reviewedTerms, term] } })
  }

  const activeMs = data.active ? data.active.elapsedMs + (data.active.runStartedAt === null ? 0 : now - data.active.runStartedAt) : 0
  return { ...data, activeMs, now, start, pause, finish, markReviewed }
}

type StudyTracker = ReturnType<typeof useStudyTracker>

export function StudyPage({ tracker }: { tracker: StudyTracker }) {
  const { sessions, active, activeMs, now, start, pause, finish } = tracker
  const today = dayKey(now)
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
    <div className="study-heading"><div><span className="section-overline">STUDY TIME</span><h1>学习记录</h1><p>计时学习，看看自己每天积累了多少。</p></div><a href="#vocab">返回词库</a></div>
    <section className="timer-card" aria-labelledby="timer-title">
      <div><span className="timer-kicker" id="timer-title">本次学习</span><div className="timer-value" role="timer" aria-live="off">{formatClock(activeMs)}</div><p>{active ? active.runStartedAt === null ? '已暂停，可以继续计时。' : '正在计时。去词库查看单词，并在详情里标记已复习。' : '准备好后开始计时。'}</p></div>
      <div className="timer-actions">{active?.runStartedAt != null ? <button className="timer-primary" onClick={pause}>暂停</button> : <button className="timer-primary" onClick={start}>{active ? '继续' : '开始学习'}</button>}{active && <button className="timer-secondary" onClick={finish}>结束并保存</button>}</div>
      {active && <div className="timer-reviewed">本次已复习 <strong>{active.reviewedTerms.length}</strong> 个词</div>}
    </section>

    <section className="study-stats" aria-label="学习数据">
      <div><span>今天</span><strong>{formatDuration(todayMs)}</strong></div>
      <div><span>近 7 天</span><strong>{formatDuration(weekMs)}</strong></div>
      <div><span>学习天数</span><strong>{studyDays} / 7 天</strong></div>
      <div><span>累计复习</span><strong>{reviewed} 词次</strong></div>
    </section>

    <section className="study-section" aria-labelledby="week-title"><div className="study-section-head"><h2 id="week-title">近 7 天学习时间</h2><span>完成的记录按结束日期统计</span></div><div className="study-chart" role="img" aria-label={`近 7 天共学习 ${formatDuration(weekMs)}`}>{days.map((day) => <div className="study-day" key={day.key}><div className="study-bar-track"><div className="study-bar" style={{ height: `${Math.max(day.ms ? 5 : 0, day.ms / maxMs * 100)}%` }} /></div><strong>{Math.floor(day.ms / 60000)}</strong><span>{day.label}</span></div>)}</div></section>

    <section className="study-section" aria-labelledby="history-title"><div className="study-section-head"><h2 id="history-title">最近的学习</h2><span>{sessions.length} 次记录</span></div>{sessions.length ? <ul className="study-history">{sessions.slice(0, 8).map((session) => <li key={session.id}><div><strong>{new Date(session.endedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</strong><span>{new Date(session.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 开始</span></div><div><strong>{formatDuration(session.durationMs)}</strong><span>复习 {session.reviewedTerms.length} 词</span></div></li>)}</ul> : <p className="study-empty">还没有学习记录。完成第一次计时后，这里会显示你的历史。</p>}</section>
    <p className="study-storage-note">学习记录仅保存在当前浏览器；清除浏览器数据或换设备后不会同步。</p>
  </main>
}
