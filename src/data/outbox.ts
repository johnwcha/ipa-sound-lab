import { canonicalEntry, emptyData, mergePersonalData, validRecord, validRound, validSession } from './model'
import type { PersonalData, QuizRound, StudySession, VocabularyRecord } from './model'
import { readJson, writeJson } from './storage'

export type Mutation = { id: string; collection: 'vocabulary' | 'quizRounds' | 'studySessions'; documentId: string; value: VocabularyRecord | QuizRound | StudySession }
const key = (uid: string) => `ipa-sound-lab-write-outbox-${uid}`
export function readOutbox(uid: string): Mutation[] {
  const rows = readJson(key(uid))
  if (!Array.isArray(rows)) return []
  return rows.filter((row): row is Mutation => {
    if (!row || typeof row.id !== 'string' || typeof row.documentId !== 'string' || row.documentId.includes('/')) return false
    return row.collection === 'vocabulary' ? validRecord(row.value) : row.collection === 'quizRounds' ? validRound(row.value) : row.collection === 'studySessions' && validSession(row.value)
  }).map(row => row.collection === 'vocabulary' ? { ...row, value: { ...(row.value as VocabularyRecord), entry: canonicalEntry((row.value as VocabularyRecord).entry) } } : row)
}
export function journal(uid: string, mutation: Mutation) {
  writeJson(key(uid), [...readOutbox(uid).filter(row => row.collection !== mutation.collection || row.documentId !== mutation.documentId), mutation])
}
export function acknowledge(uid: string, mutation: Mutation) { writeJson(key(uid), readOutbox(uid).filter(row => row.id !== mutation.id)) }
export function withOutbox(data: PersonalData, uid: string, memory: Mutation[] = []): PersonalData {
  const rows = [...new Map([...readOutbox(uid), ...memory].map(row => [row.collection + '/' + row.documentId, row])).values()]
  const result = { ...data, vocabulary: [...data.vocabulary] }
  for (const mutation of rows) {
    if (mutation.collection === 'vocabulary') result.vocabulary = [...result.vocabulary.filter(row => row.entry.term !== (mutation.value as VocabularyRecord).entry.term), mutation.value as VocabularyRecord]
  }
  return mergePersonalData(result, { ...emptyData(), rounds: rows.filter(row => row.collection === 'quizRounds').map(row => row.value as QuizRound), sessions: rows.filter(row => row.collection === 'studySessions').map(row => row.value as StudySession) })
}
