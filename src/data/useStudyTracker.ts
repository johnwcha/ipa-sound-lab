import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { newId } from './model'
import type { ActiveSession, StudySession } from './model'
import type { PersonalStore } from './usePersonalData'
import { readActive, saveActive } from './storage'

const idleMs = 60_000
const minimumSessionMs = 5_000

export function advance(active: ActiveSession, time: number): ActiveSession {
  const countedUntil = Math.min(time, active.lastActivityAt + idleMs)
  return { ...active, durationMs: active.durationMs + Math.max(0, countedUntil - active.lastTickAt), lastTickAt: countedUntil }
}

export function useStudyTracker(store: PersonalStore) {
  const [active, setActive] = useState<ActiveSession | null>(null)
  const activeRef = useRef<ActiveSession | null>(null)
  const storeRef = useRef(store)
  useLayoutEffect(() => { storeRef.current = store })
  const [now, setNow] = useState(() => Date.now())
  const scope = store.scope

  const commit = useCallback((next: ActiveSession | null) => {
    activeRef.current = next; setActive(next); saveActive(scope, next)
  }, [scope])
  const finish = useCallback((time = Date.now()) => {
    const current = activeRef.current
    if (!current) return
    const counted = advance(current, time)
    const session: StudySession = { id: counted.id, startedAt: counted.startedAt, endedAt: counted.lastTickAt, durationMs: counted.durationMs, reviewedTerms: counted.reviewedTerms }
    if (session.durationMs >= minimumSessionMs) storeRef.current.finishSession(session, scope)
    commit(null); setNow(time)
  }, [commit, scope])
  function recordActivity(term?: string) {
    if (document.hidden || !storeRef.current.canEdit) return
    const time = Date.now()
    let next = activeRef.current
    if (next && time - next.lastActivityAt > idleMs) { finish(next.lastActivityAt + idleMs); next = null }
    if (!next) next = { id: newId(), startedAt: time, lastActivityAt: time, lastTickAt: time, durationMs: 0, reviewedTerms: [] }
    else next = advance(next, time)
    if (term && !next.reviewedTerms.includes(term)) next = { ...next, reviewedTerms: [...next.reviewedTerms, term].slice(0, 1000) }
    if (!term && time - next.lastActivityAt < 2000 && activeRef.current) return
    commit({ ...next, lastActivityAt: time }); setNow(time)
  }
  useEffect(() => {
    const recovered = readActive(scope)
    if (recovered) {
      if (recovered.durationMs >= minimumSessionMs) storeRef.current.finishSession({ id: recovered.id, startedAt: recovered.startedAt, endedAt: Math.max(recovered.startedAt + recovered.durationMs, recovered.lastTickAt), durationMs: recovered.durationMs, reviewedTerms: recovered.reviewedTerms }, scope)
      saveActive(scope, null)
    }
    const tick = () => {
      const time = Date.now(); const current = activeRef.current
      if (current) {
        if (document.hidden || time - current.lastActivityAt >= idleMs || !storeRef.current.canEdit) finish(time)
        else commit(advance(current, time))
      }
      setNow(time)
    }
    const hidden = () => { if (document.hidden) finish() }
    const leaving = () => finish()
    const timer = window.setInterval(tick, 5000)
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leaving)
    return () => {
      finish(); window.clearInterval(timer)
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving)
    }
  }, [scope, commit, finish])
  return { sessions: store.sessions, active, now, finish, recordActivity, synced: !!store.user }
}

