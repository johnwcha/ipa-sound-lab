import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const firebaseConfigured = Object.values(config).every(Boolean)
// Test environments and unconfigured guest builds never initialize Firebase.
const app = firebaseConfigured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export let persistentCacheAvailable = false
export let db: ReturnType<typeof initializeFirestore> | null = null
async function checkIndexedDb(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false
  return new Promise(resolve => {
    let finished = false
    const done = (ok: boolean) => { if (!finished) { finished = true; resolve(ok) } }
    try {
      const request = indexedDB.open('vocab-notebook-cache-check', 2)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('check')) request.result.createObjectStore('check')
      }
      request.onerror = () => done(false)
      request.onblocked = () => done(false)
      request.onsuccess = () => {
        try {
          const transaction = request.result.transaction('check', 'readwrite')
          transaction.objectStore('check').put(1, 'ready')
          transaction.oncomplete = () => { request.result.close(); done(true) }
          transaction.onerror = transaction.onabort = () => { request.result.close(); done(false) }
        } catch { request.result.close(); done(false) }
      }
      setTimeout(() => done(false), 2000)
    } catch { done(false) }
  })
}
export const firebaseReady = (async () => {
  if (!app) return
  persistentCacheAvailable = await checkIndexedDb()
  db = initializeFirestore(app, { localCache: persistentCacheAvailable
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() }) : memoryLocalCache() })
})()
