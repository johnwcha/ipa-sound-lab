import { useRef, useState } from 'react'
import type { PersonalStore } from './data/usePersonalData'
import { deriveProgress, emptyData, mergePersonalData, parseRecovery, validSession } from './data/model'
import type { PersonalData, StudySession } from './data/model'
import { readJson, writeJson } from './data/storage'
import { withOutbox } from './data/outbox'
import './AccountControls.css'

const labels = { guest: '仅保存在本机', loading: '正在加载账户…', syncing: '正在同步…', synced: '已同步', offline: '离线 · 显示本机缓存', 'offline-pending': '离线 · 更改已保存在本机', error: '同步失败' }
export function AccountControls({ store, beforeAccountChange }: { store: PersonalStore; beforeAccountChange: () => void }) {
  const [showImport, setShowImport] = useState(false)
  const [recovery, setRecovery] = useState<PersonalData | null>(null)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const dismissedKey = `ipa-sound-lab-import-offer-${store.scope}`
  const [dismissed, setDismissed] = useState(() => !!readJson(dismissedKey))
  const offer = !!store.user && store.serverReady && !dismissed
  const incoming = recovery ?? store.guest
  const summary = { words: incoming.vocabulary.filter(row => !row.deleted).length, rounds: deriveProgress(incoming.imports, incoming.rounds).rounds, sessions: incoming.sessions.length }
  function dismiss() { writeJson(dismissedKey, true); setDismissed(true); setShowImport(false); setRecovery(null) }
  async function applyImport() {
    if (await store.importData(incoming)) { dismiss(); setMessage('导入完成。已有词条和删除记录已保留。') }
  }
  function exportData() {
    beforeAccountChange()
    // Include locally finalized sessions even while Firestore acknowledgements are pending.
    const journal = (readJson(`ipa-sound-lab-session-outbox-${store.scope}`) as StudySession[] | null) ?? []
    const current = store.scope === 'guest' ? (readJson('ipa-sound-lab-guest-v2') as PersonalData | null) ?? store.data : store.data
    const data = withOutbox(mergePersonalData(current, { ...emptyData(), sessions: journal.filter(validSession) }), store.scope, store.getUnacknowledged())
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'vocab-notebook', version: 1, data }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `vocab-notebook-${new Date().toISOString().slice(0, 10)}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('备份已导出。请妥善保存文件。')
  }
  return <section className="account-area" aria-label="账户与同步">
    <div className="account-bar">
      <span className={`sync-status status-${store.status}`} role="status">{labels[store.status]}</span>
      <details className="account-menu"><summary>{store.user ? store.user.displayName || store.user.email || '我的账户' : '账户与备份'}</summary><div className="account-menu-body">
        {store.user && <p>{store.user.email}</p>}
        {!store.user && store.configured && <button type="button" onClick={() => void store.login(beforeAccountChange)} disabled={store.busy || !store.authReady || !store.online}>使用 Google 登录</button>}
        {store.user && <button type="button" onClick={() => { setRecovery(null); setShowImport(true) }} disabled={store.busy}>导入本机数据</button>}
        <button type="button" onClick={exportData} disabled={!store.ready || store.busy}>导出 JSON 备份</button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={!store.ready || store.busy}>从 JSON 备份导入</button>
        {store.user && <button type="button" onClick={() => void store.logout(beforeAccountChange)} disabled={store.busy}>退出登录</button>}
      </div></details>
      <input ref={fileInput} className="sr-only" aria-label="选择 JSON 备份" type="file" accept="application/json,.json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
        try {
          if (file.size > 20 * 1024 * 1024) throw new Error('备份文件不能超过 20 MB。')
          setRecovery(parseRecovery(JSON.parse(await file.text()))); setShowImport(true); setMessage('')
        } catch (reason) { setMessage(reason instanceof Error ? reason.message : '无法读取备份。') }
      }} />
    </div>
    {store.error && <p className="account-error" role="alert">{store.error} <button type="button" onClick={store.retry} disabled={store.busy}>重试</button></p>}
    {store.user && !store.persistentCacheAvailable && <p className="account-note">当前浏览器无法保存离线缓存；离线时仅可查看本次已加载的内容。</p>}
    {(offer || showImport) && <div className="import-card"><div><strong>{recovery ? '导入备份' : '将本机数据加入账户'}</strong><p>{summary.words} 个词条 · {summary.rounds} 轮测验 · {summary.sessions} 次学习记录</p><small>合并已有数据，保留已有词条和删除记录。旧测验总数取各设备的最大值。</small></div><div className="import-actions"><button type="button" onClick={() => void applyImport()} disabled={store.busy || (!!store.user && (!store.online || !store.serverReady || store.pending))}>{store.busy ? '正在导入…' : '合并导入'}</button><button type="button" onClick={dismiss} disabled={store.busy}>暂不导入</button></div></div>}
    {message && <p className="account-note" role="status">{message}</p>}
  </section>
}
