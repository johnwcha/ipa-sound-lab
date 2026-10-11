import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { collection, doc, onSnapshot, runTransaction, setDoc, waitForPendingWrites } from 'firebase/firestore'
import { auth, db, firebaseConfigured, firebaseReady, persistentCacheAvailable } from './firebase'
import { importCloudData } from './cloudImport'
import { canonicalEntry, deriveProgress, emptyData, historyId, mergePersonalData, newId, normalizeTerm, parseRecovery, termId, validImport, validRecord, validRound, validSession } from './model'
import type { PersonalData, QuizRound, StudySession, SyncStatus, VocabEntry } from './model'
import { guestKey, loadGuest, readJson, writeJson } from './storage'
import { acknowledge, journal, readOutbox } from './outbox'
import type { Mutation } from './outbox'

const collections = { vocabulary: 'vocabulary', rounds: 'quizRounds', sessions: 'studySessions', imports: 'imports' } as const
const validators = { vocabulary: validRecord, rounds: validRound, sessions: validSession, imports: validImport }
const errorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code ?? ''
  if (code.includes('permission-denied')) return '没有同步权限，请检查账户和数据库规则。'
  if (code.includes('resource-exhausted')) return '今日同步额度已用完；本机数据仍保留，请稍后重试。'
  if (code.includes('unauthorized-domain')) return '当前网站尚未获准使用 Google 登录。'
  if (code.includes('network')) return '网络连接失败，请检查网络后重试。'
  return '操作失败，请稍后重试。'
}

export function usePersonalData(seed: () => VocabEntry[]) {
  const [guest, setGuest] = useState(() => loadGuest(seed))
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!firebaseConfigured)
  const [cloud, setCloud] = useState<PersonalData>(emptyData)
  const [online, setOnline] = useState(navigator.onLine)
  const [ready, setReady] = useState(false)
  const [serverReady, setServerReady] = useState(false)
  const [pending, setPending] = useState(0)
  const [snapshotPending, setSnapshotPending] = useState(false)
  const [cacheOnly, setCacheOnly] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [subscriptionVersion, setSubscriptionVersion] = useState(0)
  const pendingRef = useRef(0)
  const failures = useRef(new Map<string, () => Promise<void>>())
  const mutations = useRef(new Map<string, Mutation>())
  const authEpoch = useRef(0)
  const userRef = useRef(user)
  const guestRef = useRef(guest)
  useLayoutEffect(() => { guestRef.current = guest }, [guest])
  const scope = user?.uid ?? 'guest'
  const contextRef = useRef(scope)
  const canEditRef = useRef(false)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    const syncGuest = (event: StorageEvent) => {
      if (event.key === guestKey && event.newValue) {
        try { setGuest(parseRecovery({ format: 'vocab-notebook', version: 1, data: JSON.parse(event.newValue) })) } catch { setError('本机数据格式无效，请从备份恢复。') }
      }
    }
    window.addEventListener('storage', syncGuest)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('storage', syncGuest) }
  }, [])

  useEffect(() => {
    if (!auth) return
    let stop = () => {}; let cancelled = false
    void firebaseReady.then(() => {
      if (cancelled) return
      stop = onAuthStateChanged(auth!, next => {
        authEpoch.current++
        contextRef.current = next?.uid ?? 'guest'
        setUser(next); userRef.current = next; setAuthReady(true)
        setCloud(emptyData()); setReady(false); setServerReady(false); setError('')
        failures.current.clear(); pendingRef.current = 0; setPending(0); setSnapshotPending(false)
        mutations.current.clear()
      }, reason => { setError(errorMessage(reason)); setAuthReady(true) })
      void getRedirectResult(auth!).catch(reason => setError(errorMessage(reason)))
    }).catch(reason => { setError(errorMessage(reason)); setAuthReady(true) })
    return () => { cancelled = true; stop() }
  }, [])

  useEffect(() => {
    if (!user || !db) return
    let cancelled = false
    const loaded = new Set<string>(); const fromServer = new Set<string>()
    const pendingByKey = new Map<string, boolean>(); const cacheByKey = new Map<string, boolean>()
    const stops = Object.entries(collections).map(([key, name]) => onSnapshot(collection(db!, 'users', user.uid, name), { includeMetadataChanges: true }, snapshot => {
      if (cancelled) return
      const check = validators[key as keyof typeof validators]
      const rows = snapshot.docs.map(item => item.data()).filter(check)
      if (rows.length !== snapshot.docs.length) setError('部分云端记录格式无效，请导出备份并检查数据。')
      setCloud(current => ({ ...current, [key]: rows }))
      loaded.add(key); if (!snapshot.metadata.fromCache) fromServer.add(key)
      pendingByKey.set(key, snapshot.metadata.hasPendingWrites); cacheByKey.set(key, snapshot.metadata.fromCache)
      setReady(loaded.size === 4); setServerReady(fromServer.size === 4)
      setSnapshotPending([...pendingByKey.values()].some(Boolean)); setCacheOnly([...cacheByKey.values()].some(Boolean))
    }, reason => { if (!cancelled) setError(errorMessage(reason)) }))
    return () => { cancelled = true; stops.forEach(stop => stop()) }
  }, [user, subscriptionVersion])

  const sourceData = user ? cloud : guest
  const data = useMemo(() => ({ ...sourceData, vocabulary: sourceData.vocabulary.map(record => ({ ...record, entry: canonicalEntry(record.entry) })) }), [sourceData])
  const canEdit = authReady && !busy && (!user || (ready && (online || persistentCacheAvailable)))
  useLayoutEffect(() => { canEditRef.current = canEdit }, [canEdit])
  const progress = useMemo(() => deriveProgress(data.imports, data.rounds), [data.imports, data.rounds])
  const entries = useMemo(() => data.vocabulary.filter(record => !record.deleted).map(record => record.entry).sort((a, b) => b.addedAt - a.addedAt || a.term.localeCompare(b.term)), [data.vocabulary])
  const sessions = useMemo(() => [...data.sessions].sort((a, b) => b.endedAt - a.endedAt), [data.sessions])

  function commitGuest(next: PersonalData) { guestRef.current = next; setGuest(next); writeJson(guestKey, next) }
  function track(operation: () => Promise<void>, owner: string, key: string) {
    if (userRef.current?.uid !== owner) return
    const epoch = authEpoch.current
    pendingRef.current++; setPending(pendingRef.current)
    void operation().catch(reason => {
      if (userRef.current?.uid === owner && authEpoch.current === epoch) { failures.current.set(key, operation); setError(errorMessage(reason)) }
    }).finally(() => {
      if (userRef.current?.uid === owner && authEpoch.current === epoch) { pendingRef.current--; setPending(pendingRef.current) }
    })
  }
  function send(mutation: Mutation, owner: string, recovering = false) {
    const mutationKey = owner + '/' + mutation.collection + '/' + mutation.documentId
    mutations.current.set(mutationKey, mutation)
    failures.current.delete(mutationKey)
    journal(owner, mutation)
    track(async () => {
      // A newer local intent supersedes a failed/retried edit to the same word.
      if (mutations.current.get(mutationKey)?.id !== mutation.id) return
      const target = doc(db!, 'users', owner, mutation.collection, mutation.documentId)
      try {
        if (recovering) {
          await runTransaction(db!, async transaction => {
            const snapshot = await transaction.get(target)
            if (mutation.collection !== 'vocabulary' && snapshot.exists()) return
            if (mutation.collection === 'vocabulary' && snapshot.exists() && snapshot.data().updatedAt >= (mutation.value as { updatedAt: number }).updatedAt) return
            transaction.set(target, mutation.value)
          })
        } else await setDoc(target, mutation.value)
      } catch (reason) {
        if (mutations.current.get(mutationKey)?.id === mutation.id) throw reason
        return
      }
      acknowledge(owner, mutation)
      if (mutations.current.get(mutationKey)?.id === mutation.id) mutations.current.delete(mutationKey)
    }, owner, mutationKey)
  }
  function putWord(entry: VocabEntry, deleted = false) {
    if (!canEditRef.current || contextRef.current !== scope || !validRecord({ entry, deleted, updatedAt: Date.now() })) return false
    const record = { entry: { ...canonicalEntry(entry), term: normalizeTerm(entry.term) }, deleted, updatedAt: Date.now() }
    if (!user) {
      const next = guestRef.current
      commitGuest({ ...next, vocabulary: [...next.vocabulary.filter(row => termId(row.entry.term) !== termId(entry.term)), record] })
    } else send({ id: newId(), collection: 'vocabulary', documentId: termId(entry.term), value: record }, user.uid)
    return true
  }
  function finishRound(round: QuizRound) {
    if (!canEditRef.current || contextRef.current !== scope || !validRound(round)) return false
    if (!user) commitGuest(mergePersonalData(guestRef.current, { ...emptyData(), rounds: [round] }))
    else send({ id: newId(), collection: 'quizRounds', documentId: historyId(round.id), value: round }, user.uid)
    return true
  }
  function refreshWord(entry: VocabEntry, expectedUpdatedAt: number) {
    if (!canEditRef.current || contextRef.current !== scope || !online || !validRecord({ entry, deleted: false, updatedAt: Date.now() })) return
    if (!user) {
      const original = guestRef.current.vocabulary.find(row => row.entry.term === entry.term)
      if (original && !original.deleted && original.updatedAt === expectedUpdatedAt) putWord(entry)
    } else track(async () => {
      const target = doc(db!, 'users', user.uid, 'vocabulary', termId(entry.term))
      await runTransaction(db!, async transaction => {
        const snapshot = await transaction.get(target)
        if (!snapshot.exists() || snapshot.data().deleted || snapshot.data().updatedAt !== expectedUpdatedAt) return
        transaction.set(target, { entry: canonicalEntry(entry), deleted: false, updatedAt: Date.now() })
      })
    }, user.uid, 'refresh/' + termId(entry.term))
  }
  function finishSession(session: StudySession, owner = scope) {
    if (!validSession(session)) return
    if (owner === 'guest') commitGuest(mergePersonalData(guestRef.current, { ...emptyData(), sessions: [session] }))
    else {
      // A local journal protects finalized sessions if auth changes or unload interrupts a write.
      const key = `ipa-sound-lab-session-outbox-${owner}`
      const rows = (readJson(key) as StudySession[] | null) ?? []
      writeJson(key, [...rows.filter(row => row.id !== session.id), session])
      if (userRef.current?.uid === owner && db) {
        send({ id: newId(), collection: 'studySessions', documentId: historyId(session.id), value: session }, owner)
        // Session is now in the generic write journal, durable before this older journal is cleared.
        writeJson(key, ((readJson(key) as StudySession[] | null) ?? []).filter(row => row.id !== session.id))
      }
    }
  }
  const finishSessionRef = useRef(finishSession)
  useLayoutEffect(() => { finishSessionRef.current = finishSession })
  useEffect(() => {
    if (!user || !serverReady || !online) return
    readOutbox(user.uid).forEach(mutation => send(mutation, user.uid, true))
    const rows = (readJson(`ipa-sound-lab-session-outbox-${user.uid}`) as StudySession[] | null) ?? []
    rows.filter(validSession).forEach(session => finishSessionRef.current(session, user.uid))
  }, [user, serverReady, online])

  async function login(before: () => void) {
    if (!auth || busy || !online) return
    before(); setError(''); setBusy(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (reason) {
      const code = (reason as { code?: string }).code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try { await signInWithRedirect(auth, new GoogleAuthProvider()) } catch (redirectError) { setError(errorMessage(redirectError)) }
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError(errorMessage(reason))
    } finally { setBusy(false) }
  }
  async function logout(before: () => void) {
    if (!auth || busy) return
    before()
    if (pendingRef.current || snapshotPending || failures.current.size || (user && readOutbox(user.uid).length)) { setError('还有未同步的更改，请联网完成同步后再退出。'); return }
    setBusy(true)
    try { if (db) await waitForPendingWrites(db); await signOut(auth) } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  async function importData(incoming: PersonalData) {
    if (busy || !authReady) return false
    if (user && (!online || !serverReady || pendingRef.current || snapshotPending)) { setError('请联网并等待同步完成后导入。'); return false }
    setBusy(true); setError('')
    const owner = scope
    try {
      if (user && db) await importCloudData(db, user.uid, incoming)
      else commitGuest(mergePersonalData(guestRef.current, incoming))
      return contextRef.current === owner
    } catch (reason) { if (contextRef.current === owner) setError(errorMessage(reason)); return false } finally { setBusy(false) }
  }
  function retry() {
    setError(''); const owner = user?.uid
    const operations = [...failures.current.entries()]; failures.current.clear()
    if (owner) operations.forEach(([key, operation]) => track(operation, owner, key))
    setSubscriptionVersion(version => version + 1)
  }
  const status: SyncStatus = error ? 'error' : !authReady || (user && !ready) ? 'loading' : !user ? 'guest' : !online ? (pending || snapshotPending ? 'offline-pending' : 'offline') : pending || snapshotPending || busy || cacheOnly ? 'syncing' : 'synced'
  return { user, scope, authReady, configured: firebaseConfigured, data, entries, sessions, progress, guest, canEdit, ready: !user || ready, serverReady, online, busy, pending: pending > 0 || snapshotPending, error, status, persistentCacheAvailable, putWord, refreshWord, finishRound, finishSession, login, logout, importData, retry, contextRef, getUnacknowledged: () => [...mutations.current.values()] }
}
export type PersonalStore = ReturnType<typeof usePersonalData>
