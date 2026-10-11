import './StudyPage.css'
import { advance } from './data/useStudyTracker'
import type { useStudyTracker } from './data/useStudyTracker'

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
    <div className="study-heading"><div><span className="section-overline">STUDY TIME</span><h1>学习记录</h1><p>浏览词库、测验与复习闪卡时，时间会自动记录。</p></div><a href="#vocab">返回词库</a></div>
    <section className="timer-card" aria-labelledby="timer-title"><div><span className="timer-kicker" id="timer-title">本次自动记录</span><div className="timer-value" role="timer" aria-live="off">{formatClock(activeMs)}</div><p>{active ? '正在记录学习时间。' : '打开词库或测验页，开始操作后便会自动记录。'}</p></div>{active && <div className="timer-reviewed">本次查看 <strong>{active.reviewedTerms.length}</strong> 个词条</div>}</section>

    <section className="study-stats" aria-label="学习数据"><div><span>今天</span><strong>{formatDuration(todayMs)}</strong></div><div><span>近 7 天</span><strong>{formatDuration(weekMs)}</strong></div><div><span>学习天数</span><strong>{studyDays} / 7 天</strong></div><div><span>累计查看</span><strong>{reviewed} 词次</strong></div></section>

    <section className="study-section" aria-labelledby="week-title"><div className="study-section-head"><h2 id="week-title">近 7 天学习时间</h2><span>完成的记录按结束日期统计</span></div><div className="study-chart" role="img" aria-label={`近 7 天共学习 ${formatDuration(weekMs)}`}>{days.map((day) => <div className="study-day" key={day.key}><div className="study-bar-track"><div className="study-bar" style={{ height: `${Math.max(day.ms ? 5 : 0, day.ms / maxMs * 100)}%` }} /></div><strong>{Math.floor(day.ms / 60000)}</strong><span>{day.label}</span></div>)}</div></section>

    <section className="study-section" aria-labelledby="history-title"><div className="study-section-head"><h2 id="history-title">最近的学习</h2><span>{sessions.length} 次记录</span></div>{sessions.length ? <ul className="study-history">{sessions.slice(0, 8).map((session) => <li key={session.id}><div><strong>{new Date(session.endedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</strong><span>{new Date(session.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 开始</span></div><div><strong>{formatDuration(session.durationMs)}</strong><span>查看 {session.reviewedTerms.length} 词条</span></div></li>)}</ul> : <p className="study-empty">还没有学习记录。去词库查看单词后，这里会自动显示你的学习历史。</p>}</section>
    <p className="study-storage-note">只统计词库、测验与闪卡的活跃时间。隐藏页面或连续 60 秒无操作便停止；{tracker.synced ? '完成的记录会同步至账户。' : '访客记录仅保存在当前浏览器。'}</p>
  </main>
}
