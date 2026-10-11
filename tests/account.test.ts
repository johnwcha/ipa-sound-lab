// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePersonalData } from '../src/data/usePersonalData'
import { emptyData, emptyProgress } from '../src/data/model'
import { guestKey } from '../src/data/storage'
import { AccountControls } from '../src/AccountControls'

const mocks = vi.hoisted(() => ({
  configured: true, persistent: true,
  authCallback: null as null | ((user: unknown) => void),
  listeners: new Map<string, { next: (snapshot: unknown) => void; stop: ReturnType<typeof vi.fn> }>(),
  setDoc: vi.fn(), signOut: vi.fn(), popup: vi.fn(), redirect: vi.fn(), importData: vi.fn(),
}))
vi.mock('../src/data/firebase', () => ({ get firebaseConfigured() { return mocks.configured }, auth: {}, db: {}, firebaseReady: Promise.resolve(), get persistentCacheAvailable() { return mocks.persistent } }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {}, getRedirectResult: vi.fn().mockResolvedValue(null),
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => { mocks.authCallback = callback; callback(null); return vi.fn() },
  signInWithPopup: mocks.popup, signInWithRedirect: mocks.redirect, signOut: mocks.signOut,
}))
vi.mock('firebase/firestore', () => ({
  collection: (_database: unknown, ...path: string[]) => path.join('/'), doc: (_database: unknown, ...path: string[]) => path.join('/'),
  onSnapshot: (path: string, _options: unknown, next: (snapshot: unknown) => void) => {
    const stop = vi.fn(); mocks.listeners.set(path, { next, stop }); return stop
  },
  setDoc: mocks.setDoc, waitForPendingWrites: vi.fn().mockResolvedValue(undefined),
  runTransaction: vi.fn().mockImplementation(async (_database: unknown, callback: (transaction: unknown) => Promise<void>) => callback({ get: async () => ({ exists: () => false }), set: (_target: unknown, value: unknown) => mocks.setDoc(_target, value) })),
}))
vi.mock('../src/data/cloudImport', () => ({ importCloudData: mocks.importData }))
const word = { term: 'apple', meaning: '苹果', translations: ['苹果'], parts: ['noun'], uk: { ipa: '', audio: '' }, us: { ipa: '', audio: '' }, forms: [], examples: [], sourceUrl: '', addedAt: 1 }
const seed = () => [word]
const session = { id: 's1', startedAt: 1, endedAt: 6001, durationMs: 6000, reviewedTerms: ['apple'] }
async function signIn(uid = 'alice') {
  await act(async () => mocks.authCallback?.({ uid, displayName: uid, email: uid + '@example.test' }))
  await act(async () => {
    for (const [path, listener] of mocks.listeners) if (path.startsWith(`users/${uid}/`)) listener.next({ docs: [], metadata: { fromCache: false, hasPendingWrites: false } })
  })
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.listeners.clear(); mocks.configured = true; mocks.persistent = true
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  mocks.setDoc.mockResolvedValue(undefined); mocks.signOut.mockResolvedValue(undefined); mocks.popup.mockResolvedValue(undefined); mocks.redirect.mockResolvedValue(undefined); mocks.importData.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('account boundaries and failures', () => {
  it('keeps an unconfigured build usable as a guest', () => {
    mocks.configured = false
    const { result } = renderHook(() => usePersonalData(seed))
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.canEdit).toBe(true)
    expect(result.current.configured).toBe(false)
    act(() => result.current.putWord(word, true))
    expect(result.current.entries).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem(guestKey)!).vocabulary[0].deleted).toBe(true)
  })
  it('keeps guest data separate, resets accounts, and unsubscribes old listeners', async () => {
    const { result } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true))
    await signIn()
    expect(result.current.entries).toEqual([])
    expect(result.current.guest.vocabulary).toHaveLength(1)
    const listener = mocks.listeners.get('users/alice/vocabulary')!
    act(() => listener.next({ docs: [{ data: () => ({ entry: word, deleted: false, updatedAt: 1 }) }], metadata: { fromCache: false, hasPendingWrites: false } }))
    expect(result.current.entries).toHaveLength(1)
    await signIn('bob')
    expect(listener.stop).toHaveBeenCalled()
    expect(result.current.entries).toEqual([])
    expect(result.current.contextRef.current).toBe('bob')
    act(() => mocks.authCallback?.(null))
    expect(result.current.entries).toHaveLength(1)
  })
  it('blocks sign-out until a pending write is acknowledged', async () => {
    const { result } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true)); await signIn()
    let resolveWrite!: () => void
    mocks.setDoc.mockImplementation(() => new Promise<void>(resolve => { resolveWrite = resolve }))
    act(() => result.current.putWord(word))
    await act(async () => result.current.logout(() => {}))
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(result.current.error).toContain('未同步')
    await act(async () => resolveWrite())
    await act(async () => result.current.logout(() => {}))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
  it('blocks offline edits without persistent cache and allows cached offline edits otherwise', async () => {
    const { result, rerender } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true)); await signIn()
    mocks.persistent = false
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current.canEdit).toBe(false)
    expect(result.current.putWord(word)).toBe(false)
    expect(mocks.setDoc).not.toHaveBeenCalled()
    mocks.persistent = true
    rerender()
    expect(result.current.canEdit).toBe(true)
  })
  it('retries failed writes and does not send finalized sessions into another account', async () => {
    const { result } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true)); await signIn()
    mocks.setDoc.mockRejectedValueOnce({ code: 'permission-denied' })
    await act(async () => result.current.putWord(word))
    expect(result.current.status).toBe('error')
    await act(async () => result.current.retry())
    expect(mocks.setDoc).toHaveBeenCalledTimes(2)
    await signIn('bob')
    act(() => result.current.finishSession(session, 'alice'))
    expect(mocks.setDoc).toHaveBeenCalledTimes(2)
    expect(JSON.parse(localStorage.getItem('ipa-sound-lab-session-outbox-alice')!)[0].id).toBe('s1')
  })
  it('handles popup cancellation and falls back to redirect for blocked popups', async () => {
    const { result } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true))
    mocks.popup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' })
    await act(async () => result.current.login(() => {}))
    expect(result.current.error).toBe('')
    mocks.popup.mockRejectedValueOnce({ code: 'auth/popup-blocked' })
    await act(async () => result.current.login(() => {}))
    expect(mocks.redirect).toHaveBeenCalledOnce()
  })
  it('requires connectivity for cloud imports without changing the legacy guest data', async () => {
    const { result } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true)); await signIn()
    const guestBefore = localStorage.getItem(guestKey)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('offline')))
    await act(async () => result.current.importData({ ...emptyData(), imports: [{ id: 'seed', baseline: emptyProgress, completedAt: 0 }] }))
    expect(mocks.importData).not.toHaveBeenCalled()
    expect(localStorage.getItem(guestKey)).toBe(guestBefore)
  })
  it('does not resurrect a word when retrying an older failed add after a successful deletion', async () => {
    const { result } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true)); await signIn()
    mocks.setDoc.mockRejectedValueOnce({ code: 'resource-exhausted' })
    await act(async () => result.current.putWord(word))
    expect(result.current.getUnacknowledged()).toHaveLength(1)
    await act(async () => result.current.putWord(word, true))
    expect(result.current.getUnacknowledged()).toHaveLength(0)
    await act(async () => result.current.retry())
    expect(mocks.setDoc).toHaveBeenCalledTimes(2)
    expect(mocks.setDoc.mock.calls[1][1].deleted).toBe(true)
  })
  it('offers a counted import once, remembers dismissal, and lets the account menu reopen it', async () => {
    const { result } = renderHook(() => usePersonalData(seed))
    await waitFor(() => expect(result.current.authReady).toBe(true)); await signIn()
    const props = { store: result.current, beforeAccountChange: () => {} }
    const first = render(createElement(AccountControls, props))
    expect(screen.getByText('1 个词条 · 0 轮测验 · 0 次学习记录')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '暂不导入' }))
    expect(screen.queryByRole('button', { name: '合并导入' })).toBeNull()
    first.unmount()
    render(createElement(AccountControls, props))
    expect(screen.queryByRole('button', { name: '合并导入' })).toBeNull()
    fireEvent.click(screen.getByText('导入本机数据'))
    expect(screen.getByRole('button', { name: '合并导入' })).toBeTruthy()
    expect(mocks.importData).not.toHaveBeenCalled()
  })
})
