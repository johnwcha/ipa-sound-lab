import { doc, runTransaction } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { historyId, termId } from './model'
import type { PersonalData } from './model'

async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function importCloudData(database: Firestore, uid: string, data: PersonalData) {
  const markerId = `source-${await digest(data)}`
  const marker = doc(database, 'users', uid, 'imports', markerId)
  const complete = await runTransaction(database, async transaction => (await transaction.get(marker)).exists())
  if (complete) return
  // Each transaction preserves records created on another device during import.
  // Completion marker is last, making partial imports safely resumable.
  async function addMissing(collection: string, id: string, value: unknown) {
    const target = doc(database, 'users', uid, collection, id)
    await runTransaction(database, async transaction => {
      if (!(await transaction.get(target)).exists()) transaction.set(target, value as Record<string, unknown>)
    })
  }
  for (const record of data.vocabulary) await addMissing('vocabulary', termId(record.entry.term), record)
  for (const record of data.rounds) await addMissing('quizRounds', historyId(record.id), record)
  for (const record of data.sessions) await addMissing('studySessions', historyId(record.id), record)
  for (const record of data.imports) {
    const id = record.id === 'legacy-browser-v1' ? `legacy-${await digest(record.baseline)}` : record.id
    await addMissing('imports', historyId(id), { ...record, id })
  }
  await addMissing('imports', markerId, { id: markerId, baseline: { choiceWins: 0, mixedWins: 0, rounds: 0, missed: [] }, completedAt: Date.now() })
}
