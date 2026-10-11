// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { acknowledge, journal, readOutbox, withOutbox } from '../src/data/outbox'
import { emptyData } from '../src/data/model'
import type { Mutation } from '../src/data/outbox'

const entry = { term: 'apple', translations: ['苹果'], parts: ['noun'], uk: { ipa: '', audio: '' }, us: { ipa: '', audio: '' }, forms: [], examples: [], sourceUrl: '', addedAt: 1 }
const mutation = (id: string, deleted = false): Mutation => ({ id, collection: 'vocabulary', documentId: 'apple', value: { entry, deleted, updatedAt: 1 } })
beforeEach(() => localStorage.clear())
describe('write recovery journal', () => {
  it('retains the newest local intent when an older write is acknowledged', () => {
    const first = mutation('first'); const later = mutation('later', true)
    journal('alice', first); journal('alice', later); acknowledge('alice', first)
    expect(readOutbox('alice')).toEqual([later])
    acknowledge('alice', later); expect(readOutbox('alice')).toEqual([])
  })
  it('keeps accounts separate and exports pending/rejected vocabulary and history', () => {
    journal('alice', mutation('delete', true))
    expect(readOutbox('bob')).toEqual([])
    const round: Mutation = { id: 'round-write', collection: 'quizRounds', documentId: 'r1', value: { id: 'r1', mode: 'choice', score: 1, total: 1, completedAt: 1, outcomes: [{ term: 'apple', correct: true }] } }
    journal('alice', round)
    const backup = withOutbox({ ...emptyData(), vocabulary: [{ entry, deleted: false, updatedAt: 0 }] }, 'alice')
    expect(backup.vocabulary[0].deleted).toBe(true)
    expect(backup.rounds).toHaveLength(1)
    expect(withOutbox(backup, 'alice').rounds).toHaveLength(1)
  })
  it('includes in-memory pending writes when browser storage is blocked', () => {
    expect(withOutbox(emptyData(), 'alice', [mutation('memory')]).vocabulary).toHaveLength(1)
  })
})
