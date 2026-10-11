import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, disableNetwork, enableNetwork, onSnapshot, waitForPendingWrites } from 'firebase/firestore'
import { importCloudData } from '../src/data/cloudImport'
import { deriveProgress, emptyData, emptyProgress } from '../src/data/model'
import type { QuizRound } from '../src/data/model'

const entry = { term: 'apple', translations: ['苹果'], parts: ['noun'], uk: { ipa: '', audio: '' }, us: { ipa: '', audio: '' }, forms: [], examples: [], sourceUrl: '', addedAt: 1 }
const vocabulary = { entry, deleted: false, updatedAt: 1 }
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Firestore security and resumable import', () => {
  let environment: RulesTestEnvironment
  beforeAll(async () => { environment = await initializeTestEnvironment({ projectId: 'demo-vocab-sync', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }) })
  beforeEach(async () => { await environment.clearFirestore() })
  afterAll(async () => { await environment.cleanup() })
  const ownDb = () => environment.authenticatedContext('alice').firestore()
  const ref = (db: ReturnType<typeof ownDb>, path = 'vocabulary/apple') => doc(db, 'users/alice/' + path)
  it('allows owners and denies signed-out/cross-account reads and writes', async () => {
    await assertSucceeds(setDoc(ref(ownDb()), vocabulary))
    for (const other of [environment.unauthenticatedContext().firestore(), environment.authenticatedContext('bob').firestore()]) {
      await assertFails(getDoc(ref(other)))
      await assertFails(setDoc(ref(other), vocabulary))
      await assertFails(getDocs(collection(other, 'users/alice/vocabulary')))
    }
  })
  it('validates shape and forbids physical vocabulary deletion and term reassignment', async () => {
    const target = ref(ownDb())
    await assertFails(setDoc(target, { ...vocabulary, deleted: 'yes' }))
    await assertFails(setDoc(target, { ...vocabulary, entry: { ...entry, meaning: 'x'.repeat(4001) } }))
    await assertFails(setDoc(target, { ...vocabulary, injected: true }))
    await assertSucceeds(setDoc(target, vocabulary))
    await assertSucceeds(setDoc(ref(ownDb(), 'vocabulary/take%20a%20break'), { ...vocabulary, entry: { ...entry, term: 'take a break' } }))
    await assertFails(setDoc(ref(ownDb(), 'vocabulary/wrong-id'), vocabulary))
    await assertFails(setDoc(target, { ...vocabulary, entry: { ...entry, term: 'banana' } }))
    await assertSucceeds(setDoc(target, { ...vocabulary, deleted: true }))
    await assertFails(deleteDoc(target))
  })
  it('keeps rounds, sessions, and import baselines immutable while allowing identical retries', async () => {
    const data = {
      quizRounds: { id: 'r', mode: 'choice', score: 1, total: 1, completedAt: 10, outcomes: [{ term: 'apple', correct: true }] },
      studySessions: { id: 's', startedAt: 1, endedAt: 6001, durationMs: 6000, reviewedTerms: ['apple'] },
      imports: { id: 'i', baseline: emptyProgress, completedAt: 10 },
    }
    for (const [name, value] of Object.entries(data)) {
      const target = ref(ownDb(), name + '/' + value.id)
      await assertSucceeds(setDoc(target, value)); await assertSucceeds(setDoc(target, value))
      await assertFails(setDoc(target, { ...value, id: 'changed' })); await assertFails(deleteDoc(target))
    }
    await assertFails(setDoc(ref(ownDb(), 'quizRounds/bad'), { ...data.quizRounds, score: 2 }))
    await assertFails(setDoc(ref(ownDb(), 'studySessions/bad'), { ...data.studySessions, durationMs: 10000 }))
  })
  it('resumes a partial migration, preserves tombstones, and does not duplicate history', async () => {
    const database = ownDb()
    await setDoc(ref(database), { ...vocabulary, deleted: true })
    const source = { ...emptyData(), vocabulary: [vocabulary], sessions: [{ id: 'session-1', startedAt: 1, endedAt: 6001, durationMs: 6000, reviewedTerms: [] }], imports: [{ id: 'legacy-browser-v1', baseline: { ...emptyProgress, rounds: 2 }, completedAt: 0 }] }
    // Simulates records committed before an interrupted import.
    await setDoc(ref(database, 'studySessions/session-1'), source.sessions[0])
    await importCloudData(database, 'alice', source)
    await importCloudData(database, 'alice', source)
    expect((await getDoc(ref(database))).data()?.deleted).toBe(true)
    expect((await getDocs(collection(database, 'users/alice/studySessions'))).size).toBe(1)
    expect((await getDocs(collection(database, 'users/alice/imports'))).size).toBe(2)
  })
  it('syncs queued offline edits and concurrent rounds between two clients', async () => {
    const first = ownDb()
    const second = environment.authenticatedContext('alice', { device: 'second' }).firestore()
    await setDoc(ref(first), vocabulary)
    // Prime both clients before taking one offline.
    await getDoc(ref(first)); await getDoc(ref(second))
    await disableNetwork(first)
    let sawPending = false
    const stop = onSnapshot(ref(first), { includeMetadataChanges: true }, snapshot => { if (snapshot.metadata.hasPendingWrites && snapshot.data()?.deleted) sawPending = true })
    const deletion = setDoc(ref(first), { ...vocabulary, deleted: true, updatedAt: 2 })
    await vi.waitFor(() => expect(sawPending).toBe(true))
    expect((await getDoc(ref(second))).data()?.deleted).toBe(false)
    await enableNetwork(first); await deletion; await waitForPendingWrites(first)
    expect((await getDoc(ref(second))).data()?.deleted).toBe(true)
    stop()
    const result: QuizRound = { id: 'one', mode: 'choice', score: 1, total: 1, completedAt: 10, outcomes: [{ term: 'apple', correct: true }] }
    await Promise.all([setDoc(ref(first, 'quizRounds/one'), result), setDoc(ref(second, 'quizRounds/two'), { ...result, id: 'two' })])
    const rounds = (await getDocs(collection(first, 'users/alice/quizRounds'))).docs.map(item => item.data() as QuizRound)
    expect(deriveProgress([], rounds)).toEqual({ rounds: 2, choiceWins: 2, mixedWins: 0, missed: [] })
  })
})
