import { emptyData, emptyProgress, normalizeTerm, parseRecovery, validEntry, validProgress, validSession } from './model'
import type { ActiveSession, PersonalData, VocabEntry } from './model'

export function readJson(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}
export function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage blocked/full; runtime remains usable. */ }
}
export const guestKey = 'ipa-sound-lab-guest-v2'
export function loadGuest(seed: () => VocabEntry[]): PersonalData {
  const saved = readJson(guestKey)
  if (saved) {
    try { return parseRecovery({ format: 'vocab-notebook', version: 1, data: saved }) } catch { /* Recover from preserved v1 keys below. */ }
  }
  const study = readJson('ipa-sound-lab-study-v1') as { sessions?: unknown[]; active?: Partial<ActiveSession> & { elapsedMs?: number } } | null
  const progress = readJson('ipa-sound-lab-quiz-v1')
  const sessions = (study?.sessions ?? []).filter(validSession)
  const active = study?.active
  if (active && typeof active.startedAt === 'number') {
    const durationMs = active.durationMs ?? active.elapsedMs ?? 0
    const session = { id: active.id ?? `recovered-${active.startedAt}`, startedAt: active.startedAt, endedAt: Math.max(active.startedAt + durationMs, active.lastTickAt ?? 0), durationMs, reviewedTerms: active.reviewedTerms ?? [] }
    if (durationMs >= 5000 && validSession(session) && !sessions.some(item => item.id === session.id)) sessions.push(session)
  }
  const entries = seed().map(entry => ({ ...entry, term: normalizeTerm(entry.term) })).filter(validEntry)
  const result: PersonalData = { ...emptyData(), vocabulary: entries.map(entry => ({ entry, deleted: false, updatedAt: entry.addedAt })), sessions, imports: [{ id: 'legacy-browser-v1', baseline: validProgress(progress) ? progress : { ...emptyProgress }, completedAt: 0 }] }
  writeJson(guestKey, result)
  return result
}
export function readActive(scope: string): ActiveSession | null {
  const active = readJson(`ipa-sound-lab-active-${scope}`) as ActiveSession | null
  if (!active || typeof active.id !== 'string' || !Number.isFinite(active.startedAt) || !Number.isFinite(active.lastTickAt) || !Number.isFinite(active.durationMs) || !Array.isArray(active.reviewedTerms)) return null
  return active
}
export function saveActive(scope: string, active: ActiveSession | null) { writeJson(`ipa-sound-lab-active-${scope}`, active) }
