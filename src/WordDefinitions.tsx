import { useState } from 'react'
import type { VocabEntry } from './data/model'
import { exampleGroups, meaningGroups, posLabels, serializeMeaning } from './data/dictionary'

type DraftMeaning = { id: number; part: string; label: string; text: string }
export function WordMeanings({ entry, canEdit = false, onSave }: { entry: VocabEntry; canEdit?: boolean; onSave?: (entry: VocabEntry) => boolean }) {
  const [draft, setDraft] = useState<DraftMeaning[] | null>(null)
  const [original, setOriginal] = useState('')
  const [error, setError] = useState('')
  const start = () => {
    let id = 0
    setDraft(meaningGroups(entry.translations, entry.parts).flatMap(group => group.senses.map(sense => ({ ...sense, part: group.part, id: id++ }))))
    setOriginal(JSON.stringify(entry.translations)); setError('')
  }
  const save = () => {
    if (!draft || !canEdit || !onSave) return
    if (JSON.stringify(entry.translations) !== original) { setError('释义已在其他页面或设备更新，请取消后重新编辑。'); return }
    if (draft.some(item => !item.text.trim())) { setError('请填写释义，或删除空白条目。'); return }
    const translations = draft.map(item => serializeMeaning(item.part, item))
    if (translations.length > 100 || translations.some(text => text.length > 4000)) { setError('释义内容过长，请缩短后保存。'); return }
    const parts = [...new Set(draft.map(item => item.part).filter(part => part !== 'unclassified'))]
    if (onSave({ ...entry, translations, parts })) { setDraft(null); setError('') }
    else setError('暂时无法保存，请等待账户加载或恢复网络后重试。')
  }
  if (draft) return <div className="meaning-editor">
    <p className="example-note">修改或删除条目后，点击保存。词库摘要与测验将同步更新。</p>
    {[...new Set(draft.map(item => item.part))].map(part => <section className="meaning-group" key={part}>
      <h4>{posLabels[part]}</h4>
      {draft.filter(item => item.part === part).map(item => <div className="meaning-edit-row" key={item.id}>
        <div className="meaning-edit-heading"><label htmlFor={`meaning-${item.id}`}>{item.label || posLabels[item.part]}</label><button type="button" disabled={!canEdit} aria-label={`删除${item.label || posLabels[item.part]}`} onClick={() => setDraft(draft.filter(row => row.id !== item.id))}>删除</button></div>
        <textarea id={`meaning-${item.id}`} maxLength={3900} rows={3} disabled={!canEdit} value={item.text} onChange={event => setDraft(draft.map(row => row.id === item.id ? { ...row, text: event.target.value } : row))} />
      </div>)}
    </section>)}
    {!draft.length && <p className="no-example">所有释义已删除；保存后该词暂不参与测验。</p>}
    <button className="meaning-add" type="button" disabled={!canEdit} onClick={() => setDraft([...draft, { id: Math.max(-1, ...draft.map(item => item.id)) + 1, part: 'unclassified', label: '', text: '' }])}>添加释义</button>
    {error && <p role="alert" className="meaning-edit-error">{error}</p>}
    <div className="meaning-edit-actions"><button type="button" onClick={() => { setDraft(null); setError('') }}>取消</button><button type="button" disabled={!canEdit} onClick={save}>保存释义</button></div>
  </div>
  return <>{onSave && <div className="meaning-edit-toolbar"><button type="button" disabled={!canEdit} onClick={start}>编辑释义</button></div>}<div className="translation-list">{meaningGroups(entry.translations, entry.parts).map(group => <section className="meaning-group" key={group.part}>
    <h4>{posLabels[group.part]}</h4>
    {group.senses.map((sense, index) => <div key={index}>{sense.label && <h5>{sense.label}</h5>}<p>{sense.text}</p></div>)}
  </section>)}{!entry.translations.length && <p className="no-example">暂无释义，可点击编辑添加。</p>}</div></>
}

export function WordExamples({ entry }: { entry: VocabEntry }) {
  return entry.examples.length ? <>{exampleGroups(entry).map(group => <section className="example-group" key={group.part}>
    <h4>{group.part === 'unclassified' ? '词性未确认的例句' : `${posLabels[group.part]}例句`}</h4>
    {group.part === 'unclassified' && <p className="example-note">来源未标注此句中该词的词性。</p>}
    <ol className="example-list">{group.examples.map((example, index) => <li key={`${index}-${example.text}`}>{example.text}{example.url && <a href={example.url} target="_blank" rel="noreferrer">{example.author ? `来源：${example.author}` : '来源'}</a>}</li>)}</ol>
  </section>)}</> : <p className="no-example">这条词目暂时没有可用例句。</p>
}
