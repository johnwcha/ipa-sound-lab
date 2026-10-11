export type Accent = 'uk' | 'us'
export type Form = { label: string; value: string }
export type VocabEntry = {
  term: string; meaning: string; translations: string[]; parts: string[]
  uk: { ipa: string; audio: string }; us: { ipa: string; audio: string }
  forms: Form[]; examples: { text: string; author: string; url: string; partOfSpeech?: string }[]
  usageNotes?: { label: string; meaning: string; example: string; exampleMeaning: string; sourceUrl: string }[]
  sourceUrl: string; addedAt: number
}
export type Progress = { choiceWins: number; mixedWins: number; rounds: number; missed: string[] }
export type QuizRound = { id: string; mode: 'choice' | 'mixed' | 'audio'; score: number; total: number; completedAt: number; outcomes: { term: string; correct: boolean }[] }
export type StudySession = { id: string; startedAt: number; endedAt: number; durationMs: number; reviewedTerms: string[] }
export type ActiveSession = { id: string; startedAt: number; lastActivityAt: number; lastTickAt: number; durationMs: number; reviewedTerms: string[] }
export type VocabularyRecord = { entry: VocabEntry; deleted: boolean; updatedAt: number }
export type ImportRecord = { id: string; baseline: Progress; completedAt: number }
export type PersonalData = { vocabulary: VocabularyRecord[]; rounds: QuizRound[]; sessions: StudySession[]; imports: ImportRecord[] }
export type RecoveryFile = { format: 'vocab-notebook'; version: 1; data: PersonalData }
export type ImportSummary = { words: number; rounds: number; sessions: number }
export type SyncStatus = 'guest' | 'loading' | 'syncing' | 'synced' | 'offline' | 'offline-pending' | 'error'
export const emptyProgress: Progress = { choiceWins: 0, mixedWins: 0, rounds: 0, missed: [] }
export const emptyData = (): PersonalData => ({ vocabulary: [], rounds: [], sessions: [], imports: [] })
export const normalizeTerm = (term: string) => term.trim().replace(/\s+/g, ' ').toLowerCase()
export const termId = (term: string) => encodeURIComponent(normalizeTerm(term)).replace(/\./g, '%2E')
export const historyId = (id: string) => encodeURIComponent(id).replace(/\./g, '%2E')
export const newId = () => crypto.randomUUID()

export function deriveProgress(imports: ImportRecord[], rounds: QuizRound[]): Progress {
  const result: Progress = { ...emptyProgress, missed: [] }
  const missed = new Set<string>()
  for (const { baseline } of imports) {
    result.choiceWins = Math.max(result.choiceWins, baseline.choiceWins)
    result.mixedWins = Math.max(result.mixedWins, baseline.mixedWins)
    result.rounds = Math.max(result.rounds, baseline.rounds)
    baseline.missed.forEach(term => missed.add(normalizeTerm(term)))
  }
  for (const round of [...new Map(rounds.map(round => [round.id, round])).values()].sort((a, b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id))) {
    result.rounds++
    if (round.score / round.total >= .8) {
      if (round.mode === 'choice') result.choiceWins++
      if (round.mode === 'mixed') result.mixedWins++
    }
    for (const outcome of round.outcomes) {
      const term = normalizeTerm(outcome.term)
      if (outcome.correct) missed.delete(term)
      else missed.add(term)
    }
  }
  return { ...result, missed: [...missed].sort() }
}

export function mergePersonalData(current: PersonalData, incoming: PersonalData): PersonalData {
  // Import never replaces cloud vocabulary, including tombstones.
  const vocabulary = new Map(current.vocabulary.map(record => [termId(record.entry.term), record]))
  incoming.vocabulary.forEach(record => { if (!vocabulary.has(termId(record.entry.term))) vocabulary.set(termId(record.entry.term), record) })
  const merge = <T extends { id: string }>(a: T[], b: T[]) => [...new Map([...b, ...a].map(record => [record.id, record])).values()]
  return { vocabulary: [...vocabulary.values()], rounds: merge(current.rounds, incoming.rounds), sessions: merge(current.sessions, incoming.sessions), imports: merge(current.imports, incoming.imports) }
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
const text = (value: unknown, max = 4000): value is string => typeof value === 'string' && value.length <= max
const texts = (value: unknown, max = 1000): value is string[] => Array.isArray(value) && value.length <= max && value.every(item => text(item))
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value)
export function validEntry(value: unknown): value is VocabEntry {
  if (!object(value) || !text(value.term, 56) || !/^[a-z][a-z '-]*[a-z]$|^[a-z]$/.test(value.term) || normalizeTerm(value.term) !== value.term || !text(value.meaning) || !texts(value.parts, 30) || !texts(value.translations, 100) || !number(value.addedAt) || !text(value.sourceUrl)) return false
  if (!object(value.uk) || !object(value.us) || ![value.uk, value.us].every(sound => text(sound.ipa, 500) && text(sound.audio))) return false
  if (!Array.isArray(value.forms) || value.forms.length > 100 || !value.forms.every(form => object(form) && text(form.label) && text(form.value))) return false
  if (!Array.isArray(value.examples) || value.examples.length > 100 || !value.examples.every(example => object(example) && text(example.text) && text(example.author) && text(example.url) && (example.partOfSpeech === undefined || text(example.partOfSpeech, 30)))) return false
  return value.usageNotes === undefined || (Array.isArray(value.usageNotes) && value.usageNotes.length <= 30 && value.usageNotes.every(note => object(note) && ['label', 'meaning', 'example', 'exampleMeaning', 'sourceUrl'].every(key => text(note[key]))))
}
export function validProgress(value: unknown): value is Progress {
  return object(value) && [value.choiceWins, value.mixedWins, value.rounds].every(n => number(n) && Number.isInteger(n)) && texts(value.missed)
}
export function validSession(value: unknown): value is StudySession {
  return object(value) && validId(value.id) && number(value.startedAt) && number(value.endedAt) && number(value.durationMs) && Number(value.endedAt) >= Number(value.startedAt) && Number(value.durationMs) <= Number(value.endedAt) - Number(value.startedAt) && texts(value.reviewedTerms)
}
export function validRound(value: unknown): value is QuizRound {
  return object(value) && validId(value.id) && ['choice', 'mixed', 'audio'].includes(String(value.mode)) && number(value.completedAt) && Number.isInteger(value.score) && Number.isInteger(value.total) && Number(value.total) > 0 && Number(value.total) <= 100 && Number(value.score) >= 0 && Number(value.score) <= Number(value.total) && Array.isArray(value.outcomes) && value.outcomes.length === value.total && value.outcomes.every(outcome => object(outcome) && text(outcome.term, 56) && typeof outcome.correct === 'boolean') && value.outcomes.filter(outcome => outcome.correct).length === value.score
}
export function validImport(value: unknown): value is ImportRecord {
  return object(value) && validId(value.id) && validProgress(value.baseline) && number(value.completedAt)
}
export function validRecord(value: unknown): value is VocabularyRecord {
  return object(value) && validEntry(value.entry) && typeof value.deleted === 'boolean' && number(value.updatedAt)
}
export function parseRecovery(value: unknown): PersonalData {
  if (!object(value) || value.format !== 'vocab-notebook' || value.version !== 1 || !object(value.data)) throw new Error('备份文件格式不正确。')
  const data = value.data
  const checks = { vocabulary: validRecord, rounds: validRound, sessions: validSession, imports: validImport }
  for (const [key, check] of Object.entries(checks)) if (!Array.isArray(data[key]) || data[key].length > 20000 || !data[key].every(check)) throw new Error('备份内容无效或过大。')
  const parsed = data as unknown as PersonalData
  for (const rows of [parsed.rounds, parsed.sessions, parsed.imports]) if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('备份含有重复记录。')
  if (new Set(parsed.vocabulary.map(row => termId(row.entry.term))).size !== parsed.vocabulary.length) throw new Error('备份含有重复词条。')
  return parsed
}
