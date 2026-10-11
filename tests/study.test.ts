// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudyTracker } from '../src/data/useStudyTracker'
import { loadGuest, readActive, saveActive, writeJson } from '../src/data/storage'
import type { PersonalStore } from '../src/data/usePersonalData'
import type { StudySession } from '../src/data/model'

beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(100000)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const mockStore = (scope = 'guest') => ({ scope, user: scope === 'guest' ? null : { uid: scope }, canEdit: true, sessions: [], finishSession: vi.fn() }) as unknown as PersonalStore
describe('study session durability', () => {
  it('persists timer ticks locally and emits one stable session only when finished', () => {
    const store = mockStore('alice')
    const { result } = renderHook(() => useStudyTracker(store))
    act(() => result.current.recordActivity('apple'))
    const id = readActive('alice')!.id
    act(() => vi.advanceTimersByTime(10000))
    expect(store.finishSession).not.toHaveBeenCalled()
    expect(readActive('alice')?.durationMs).toBe(10000)
    act(() => result.current.finish())
    expect(store.finishSession).toHaveBeenCalledWith(expect.objectContaining({ id, durationMs: 10000, reviewedTerms: ['apple'] }), 'alice')
    expect(readActive('alice')).toBeNull()
    act(() => result.current.finish())
    expect(store.finishSession).toHaveBeenCalledOnce()
  })
  it('stops counting at the idle cutoff', () => {
    const store = mockStore()
    const { result } = renderHook(() => useStudyTracker(store))
    act(() => result.current.recordActivity())
    act(() => vi.advanceTimersByTime(90000))
    expect(store.finishSession).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 60000, endedAt: 160000 }), 'guest')
    expect(result.current.active).toBeNull()
  })
  it('recovers only persisted time with the original session ID', () => {
    saveActive('alice', { id: 'crash-session', startedAt: 1000, lastActivityAt: 7000, lastTickAt: 7000, durationMs: 6000, reviewedTerms: ['apple'] })
    const store = mockStore('alice')
    renderHook(() => useStudyTracker(store))
    expect(store.finishSession).toHaveBeenCalledWith({ id: 'crash-session', startedAt: 1000, endedAt: 7000, durationMs: 6000, reviewedTerms: ['apple'] }, 'alice')
    expect(readActive('alice')).toBeNull()
  })
  it('finalizes into the original account on unmount', () => {
    const store = mockStore('alice')
    const { result, unmount } = renderHook(() => useStudyTracker(store))
    act(() => result.current.recordActivity())
    act(() => vi.advanceTimersByTime(6000))
    unmount()
    expect(store.finishSession).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 6000 }), 'alice')
  })
  it('migrates a v1 interrupted timer without overwriting preserved keys', () => {
    const old = { sessions: [] as StudySession[], active: { startedAt: 1000, lastTickAt: 7000, durationMs: 6000, reviewedTerms: [] } }
    writeJson('ipa-sound-lab-study-v1', old)
    const migrated = loadGuest(() => [])
    expect(migrated.sessions[0].id).toBe('recovered-1000')
    expect(JSON.parse(localStorage.getItem('ipa-sound-lab-study-v1')!)).toEqual(old)
    expect(loadGuest(() => []).sessions).toHaveLength(1)
  })
})
