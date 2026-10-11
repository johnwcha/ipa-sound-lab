import { describe, expect, it } from 'vitest'
import { deriveProgress, emptyData, emptyProgress, mergePersonalData, normalizeTerm, parseRecovery, termId } from '../src/data/model'
import type { ImportRecord, QuizRound, VocabEntry } from '../src/data/model'

export const word: VocabEntry = { term: 'apple', translations: ['苹果'], parts: ['noun'], uk: { ipa: '/a/', audio: '' }, us: { ipa: '/a/', audio: '' }, forms: [], examples: [], sourceUrl: '', addedAt: 1 }
const baseline = (id: string, rounds: number, missed: string[] = []): ImportRecord => ({ id, baseline: { choiceWins: 2, mixedWins: 0, rounds, missed }, completedAt: 0 })
const round = (id: string, correct: boolean, completedAt = 1): QuizRound => ({ id, mode: 'mixed', score: correct ? 1 : 0, total: 1, completedAt, outcomes: [{ term: 'apple', correct }] })

describe('migration and progress', () => {
  it('normalizes terms into path-safe deterministic IDs', () => {
    expect(normalizeTerm('  LOOK   UP ')).toBe('look up')
    expect(termId('Look up')).toBe(termId('look   up'))
    expect(termId('a/b')).not.toContain('/')
    expect(termId('.')).not.toBe('.')
  })
  it('preserves current vocabulary and tombstones on repeated import', () => {
    const current = { ...emptyData(), vocabulary: [{ entry: word, deleted: true, updatedAt: 5 }] }
    const source = { ...emptyData(), vocabulary: [{ entry: { ...word, translations: ['changed'] }, deleted: false, updatedAt: 10 }], rounds: [round('r1', true)] }
    const once = mergePersonalData(current, source)
    expect(once.vocabulary[0].deleted).toBe(true)
    expect(once.vocabulary[0].entry.translations).toEqual(['苹果'])
    expect(mergePersonalData(once, source)).toEqual(once)
  })
  it('takes maximum legacy counters and deduplicates actual rounds', () => {
    const progress = deriveProgress([baseline('a', 5), baseline('b', 8)], [round('a', true), round('a', true), round('b', true)])
    expect(progress).toEqual({ choiceWins: 2, mixedWins: 2, rounds: 10, missed: [] })
  })
  it('lets outcomes override all imported missed terms, independent of import timing', () => {
    expect(deriveProgress([baseline('old', 2, ['apple']), baseline('later', 3, ['apple'])], [round('r', true)]).missed).toEqual([])
    expect(deriveProgress([], [round('correct', true, 2), round('wrong', false, 3)]).missed).toEqual(['apple'])
  })
  it('uses a stable tiebreaker for simultaneous rounds', () => {
    expect(deriveProgress([], [round('b', false), round('a', true)]).missed).toEqual(['apple'])
    expect(deriveProgress([], [round('a', true), round('b', false)]).missed).toEqual(['apple'])
  })
  it('keeps identical sessions and imports idempotent', () => {
    const source = { ...emptyData(), sessions: [{ id: 's', startedAt: 1, endedAt: 6001, durationMs: 6000, reviewedTerms: ['apple'] }], imports: [baseline('seed', 8)] }
    const once = mergePersonalData(emptyData(), source)
    expect(mergePersonalData(once, source)).toEqual(once)
  })
  it('roundtrips backups and rejects malformed/duplicate records', () => {
    const data = { ...emptyData(), vocabulary: [{ entry: word, deleted: false, updatedAt: 1 }], imports: [{ id: 'seed', baseline: emptyProgress, completedAt: 0 }] }
    expect(parseRecovery(JSON.parse(JSON.stringify({ format: 'vocab-notebook', version: 1, data })))).toEqual(data)
    expect(() => parseRecovery({ format: 'vocab-notebook', version: 2, data })).toThrow()
    expect(() => parseRecovery({ format: 'vocab-notebook', version: 1, data: { ...data, rounds: [{ ...round('a', true), score: -1 }] } })).toThrow()
    expect(() => parseRecovery({ format: 'vocab-notebook', version: 1, data: { ...data, vocabulary: [...data.vocabulary, ...data.vocabulary] } })).toThrow()
  })
})
