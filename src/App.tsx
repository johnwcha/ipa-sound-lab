import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { StudyPage, useStudyTracker } from './StudyPage'

type Accent = 'uk' | 'us'
type Pronunciation = { ipa: string; audio: string }
type Form = { label: string; value: string }
type Example = { text: string; author: string; url: string }
type UsageNote = { label: string; meaning: string; example: string; exampleMeaning: string; sourceUrl: string }
type VocabEntry = {
  term: string
  meaning: string
  translations: string[]
  parts: string[]
  uk: Pronunciation
  us: Pronunciation
  forms: Form[]
  examples: Example[]
  usageNotes?: UsageNote[]
  sourceUrl: string
  addedAt: number
}
type DictionaryRow = [string, string, string]
type ApiEntry = {
  phonetics?: { text?: string; audio?: string }[]
  meanings?: { partOfSpeech?: string; definitions?: { example?: string }[] }[]
  sourceUrls?: string[]
}

const storageKey = 'ipa-sound-lab-vocabulary-v1'
const starterSeedKey = 'ipa-sound-lab-photo-starter-v1'
const appleUsageNote: UsageNote = {
  label: '俚语 · 常与修饰词连用',
  meaning: '人；家伙',
  example: 'He is a good apple who always helps his neighbors.',
  exampleMeaning: '他是个好人，总是帮助邻居。',
  sourceUrl: 'https://en.wiktionary.org/wiki/apple',
}

function enrichEntry(entry: VocabEntry): VocabEntry {
  if (entry.term.toLowerCase() !== 'apple' || entry.usageNotes?.length) return entry
  const meaning = /^(?:苹果\s*[,，]\s*家伙|家伙)$/.test(entry.meaning.trim()) ? '苹果' : entry.meaning
  const translations = (Array.isArray(entry.translations) ? entry.translations : ['n. 苹果']).map((line) => line.replace(/([,，]\s*)?家伙(?=$|\n|\\n)/, '').trim()).filter((line) => line && line !== 'n.')
  if (!translations.some((line) => line.includes('苹果'))) translations.unshift('n. 苹果')
  return { ...entry, meaning, translations, usageNotes: [appleUsageNote] }
}
const starterDate = new Date('2026-10-02T00:00:00Z').getTime()
function starter(term: string, meaning: string, parts: string[], uk: string, us: string, example: string, forms: Form[] = []): VocabEntry {
  return {
    term, meaning, translations: [meaning], parts,
    uk: { ipa: uk, audio: '' }, us: { ipa: us, audio: '' }, forms,
    examples: [{ text: example, author: '', url: '' }], sourceUrl: '', addedAt: starterDate,
  }
}
const starterEntries: VocabEntry[] = [
  starter('financial', '金融的', ['adjective'], '/faɪˈnænʃəl/', '/ˌfaɪˈnænʃəl/', 'She asked for financial advice.'),
  starter('finance', '金融', ['noun'], '/ˈfaɪnæns/', '/ˈfaɪnæns/', 'He works in finance.'),
  starter('credit union', '信用合作社', ['noun'], '/ˈkredɪt ˈjuːniən/', '/ˈkredɪt ˈjuːnjən/', 'She opened an account at a credit union.', [{ label: '复数', value: 'credit unions' }]),
  starter('credit card', '信用卡', ['noun'], '/ˈkredɪt kɑːd/', '/ˈkredɪt kɑrd/', 'I paid for the ticket with a credit card.', [{ label: '复数', value: 'credit cards' }]),
  starter('check', '支票', ['noun'], '/tʃek/', '/tʃek/', 'He wrote a check for the rent.', [{ label: '复数', value: 'checks' }]),
  starter('means', '方法', ['noun'], '/miːnz/', '/miːnz/', 'We need to find a means of solving the problem.', [{ label: '单数与复数', value: 'means' }]),
  starter('secure', '安全的', ['adjective'], '/sɪˈkjʊə/', '/sɪˈkjʊr/', 'Use a secure password for your account.'),
  starter('services', '服务', ['noun'], '/ˈsɜːvɪsɪz/', '/ˈsɝvɪsɪz/', 'The bank offers online services.', [{ label: '单数', value: 'service' }, { label: '复数', value: 'services' }]),
  starter('cost', '花费', ['verb', 'noun'], '/kɒst/', '/kɑst/', 'The repair may cost more than expected.', [{ label: '复数', value: 'costs' }, { label: '过去式', value: 'cost' }, { label: '过去分词', value: 'cost' }, { label: '现在分词', value: 'costing' }, { label: '第三人称单数', value: 'costs' }]),
  starter('costs', '成本', ['noun'], '/kɒsts/', '/kɑsts/', 'The company is trying to reduce costs.', [{ label: '单数', value: 'cost' }, { label: '复数', value: 'costs' }]),
  starter('members', '成员', ['noun'], '/ˈmembəz/', '/ˈmembɚz/', 'All members can vote at the meeting.', [{ label: '单数', value: 'member' }, { label: '复数', value: 'members' }]),
  starter('transfer', '转移', ['verb'], '/trænsˈfɜː/', '/trænsˈfɝ/', 'You can transfer money between accounts.', [{ label: '过去式', value: 'transferred' }, { label: '过去分词', value: 'transferred' }, { label: '现在分词', value: 'transferring' }, { label: '第三人称单数', value: 'transfers' }]),
  starter('accounts', '账户', ['noun'], '/əˈkaʊnts/', '/əˈkaʊnts/', 'She checks her accounts every morning.', [{ label: '单数', value: 'account' }, { label: '复数', value: 'accounts' }]),
  starter('countries', '国家', ['noun'], '/ˈkʌntriz/', '/ˈkʌntriz/', 'People from many countries attended the event.', [{ label: '单数', value: 'country' }, { label: '复数', value: 'countries' }]),
  starter('deposit', '汇款', ['noun', 'verb'], '/dɪˈpɒzɪt/', '/dɪˈpɑzɪt/', 'I made a deposit at the bank.', [{ label: '复数', value: 'deposits' }, { label: '过去式', value: 'deposited' }, { label: '过去分词', value: 'deposited' }, { label: '现在分词', value: 'depositing' }, { label: '第三人称单数', value: 'deposits' }]),
  starter('direct', '直接', ['adjective', 'verb'], '/dɪˈrekt/', '/dəˈrekt/', 'There is a direct train to the city.', [{ label: '过去式', value: 'directed' }, { label: '过去分词', value: 'directed' }, { label: '现在分词', value: 'directing' }, { label: '第三人称单数', value: 'directs' }]),
  starter('retirement', '退休', ['noun'], '/rɪˈtaɪəmənt/', '/rɪˈtaɪɚmənt/', 'She is saving money for retirement.', [{ label: '复数', value: 'retirements' }]),
  starter('anymore', '再也不', ['adverb'], '/ˌeniˈmɔː/', '/ˌeniˈmɔr/', 'I do not live there anymore.'),
  starter('save', '节约', ['verb'], '/seɪv/', '/seɪv/', 'We can save money by cooking at home.', [{ label: '过去式', value: 'saved' }, { label: '过去分词', value: 'saved' }, { label: '现在分词', value: 'saving' }, { label: '第三人称单数', value: 'saves' }]),
  starter('debit', '借方', ['noun'], '/ˈdebɪt/', '/ˈdebɪt/', 'A debit appears on the bank statement.', [{ label: '复数', value: 'debits' }]),
  starter('small town', '小镇', ['noun'], '/smɔːl taʊn/', '/smɔl taʊn/', 'He grew up in a small town.', [{ label: '复数', value: 'small towns' }]),
  starter('leader', '领导人', ['noun'], '/ˈliːdə/', '/ˈliːdɚ/', 'The team chose a new leader.', [{ label: '复数', value: 'leaders' }]),
  starter('withdrawal', '提款', ['noun'], '/wɪðˈdrɔːəl/', '/wɪðˈdrɔəl/', 'She made a cash withdrawal at the bank.', [{ label: '复数', value: 'withdrawals' }]),
]
const suggestions = ['apple', 'take', 'look up']
const posLabels: Record<string, string> = {
  noun: '名词', verb: '动词', adjective: '形容词', adverb: '副词', pronoun: '代词',
  preposition: '介词', conjunction: '连词', interjection: '感叹词', exclamation: '感叹词',
  determiner: '限定词', phrase: '短语', numeral: '数词', auxiliary: '助动词',
}
const exchangeLabels: Record<string, string> = {
  s: '复数', p: '过去式', d: '过去分词', i: '现在分词', '3': '第三人称单数',
}
const knownIpa: Record<string, { uk: string; us: string }> = {
  car: { uk: '/kɑː/', us: '/kɑr/' }, water: { uk: '/ˈwɔːtə/', us: '/ˈwɔtər/' },
  dance: { uk: '/dɑːns/', us: '/dæns/' }, hot: { uk: '/hɒt/', us: '/hɑt/' },
  better: { uk: '/ˈbetə/', us: '/ˈbetər/' }, new: { uk: '/njuː/', us: '/nuː/' },
}

function Icon({ name, size = 20 }: { name: 'plus' | 'search' | 'sound' | 'details' | 'close' | 'trash' | 'book' | 'arrow'; size?: number }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    sound: <><path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" /><path d="M15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12" /></>,
    details: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    close: <path d="M5 5 19 19M19 5 5 19" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>,
    book: <><path d="M12 5c-2-2-5-2-9-1v15c4-1 7-1 9 1 2-2 5-2 9-1V4c-4-1-7-1-9 1ZM12 5v15" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function loadEntries(): VocabEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    const saved = Array.isArray(parsed) ? parsed.filter((item): item is VocabEntry => item && typeof item === 'object' && typeof item.term === 'string' && typeof item.meaning === 'string' && Array.isArray(item.parts)).map(enrichEntry) : []
    if (localStorage.getItem(starterSeedKey)) {
      if (JSON.stringify(parsed) !== JSON.stringify(saved)) localStorage.setItem(storageKey, JSON.stringify(saved))
      return saved
    }
    const existing = new Set(saved.map((entry) => entry.term.toLowerCase()))
    const seeded = [...saved, ...starterEntries.filter((entry) => !existing.has(entry.term))]
    localStorage.setItem(storageKey, JSON.stringify(seeded))
    localStorage.setItem(starterSeedKey, '1')
    return seeded
  } catch { return starterEntries }
}

function saveEntries(entries: VocabEntry[]) {
  try { localStorage.setItem(storageKey, JSON.stringify(entries)) } catch { /* Private browsing may block storage. */ }
}

const shardCache = new Map<string, Record<string, DictionaryRow>>()
const ipaCache = new Map<string, Record<string, [string, string]>>()
async function getDictionaryRow(term: string): Promise<DictionaryRow | null> {
  const prefix = term.slice(0, 2).replace(/[^a-z]/g, '_').padEnd(2, '_')
  if (!shardCache.has(prefix)) {
    const response = await fetch(`/dictionary/${prefix}.json`)
    if (!response.ok) return null
    shardCache.set(prefix, await response.json() as Record<string, DictionaryRow>)
  }
  return shardCache.get(prefix)?.[term] ?? null
}

async function getIpaRow(term: string): Promise<[string, string] | null> {
  const prefix = term.slice(0, 2).replace(/[^a-z]/g, '_').padEnd(2, '_')
  if (!ipaCache.has(prefix)) {
    const response = await fetch(`/ipa/${prefix}.json`)
    if (!response.ok) return null
    ipaCache.set(prefix, await response.json() as Record<string, [string, string]>)
  }
  const direct = ipaCache.get(prefix)?.[term]
  if (direct) return direct
  if (!term.includes(' ')) return null
  const components = await Promise.all(term.split(' ').map(getIpaRow))
  if (components.some((component) => !component)) return null
  return ([0, 1] as const).map((index) => {
    const pieces = components.map((component) => component?.[index]?.replace(/^\//, '').replace(/\/$/, '') ?? '')
    return pieces.every(Boolean) ? `/${pieces.join(' ')}/` : ''
  }) as [string, string]
}

async function getEnglishEntry(term: string): Promise<ApiEntry | null> {
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`, { signal: controller.signal })
      if (!response.ok) return null
      const data: unknown = await response.json()
      return Array.isArray(data) ? (data[0] as ApiEntry) : null
    } finally { window.clearTimeout(timer) }
  } catch { return null }
}

async function getTatoebaExamples(term: string): Promise<Example[]> {
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 3000)
    try {
      const url = new URL('https://api.tatoeba.org/v1/sentences')
      url.searchParams.set('q', term)
      url.searchParams.set('lang', 'eng')
      url.searchParams.set('sort', 'relevance')
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) return []
      const data: { data?: { id: number; text: string; owner?: string }[] } = await response.json()
      const exact = new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i')
      return (data.data ?? []).filter((item) => exact.test(item.text) && item.text.length >= 18 && item.text.length <= 120).slice(0, 3).map((item) => ({ text: item.text, author: item.owner ?? 'Tatoeba 用户', url: `https://tatoeba.org/en/sentences/show/${item.id}` }))
    } finally { window.clearTimeout(timer) }
  } catch { return [] }
}

function parseTranslations(raw: string): string[] {
  return raw.split(/\n|\\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('[')).slice(0, 6)
}

function parseParts(row: DictionaryRow, api: ApiEntry | null, term: string): string[] {
  const fromApi = api?.meanings?.map((item) => item.partOfSpeech?.toLowerCase() ?? '').filter(Boolean) ?? []
  const fromTranslation = row[0].match(/(?:^|\n|\\n)\s*(?:n|v|vt|vi|adj|adv|prep|pron|conj|interj)\./g)?.map((match) => {
    const key = match.replace(/\\n|\n/g, '').trim().replace('.', '')
    return key === 'n' ? 'noun' : ['v', 'vt', 'vi'].includes(key) ? 'verb' : key === 'adj' ? 'adjective' : key === 'adv' ? 'adverb' : key === 'prep' ? 'preposition' : key === 'pron' ? 'pronoun' : key === 'conj' ? 'conjunction' : 'interjection'
  }) ?? []
  const fromPos = row[1].split('/').map((part) => part.split(':')[0]).map((key) => key === 'n' ? 'noun' : key === 'v' ? 'verb' : key === 'a' ? 'adjective' : key === 'r' ? 'adverb' : '')
  const combined = (fromTranslation.length ? fromTranslation : fromApi.length ? fromApi : fromPos).filter(Boolean)
  return [...new Set(combined.length ? combined : [term.includes(' ') ? 'phrase' : 'word'])].slice(0, 4)
}

function parseForms(raw: string, parts: string[]): Form[] {
  const values = Object.fromEntries(raw.split('/').map((item) => item.split(':')).filter((pair) => pair.length === 2))
  const keys = [...(parts.includes('noun') ? ['s'] : []), ...(parts.includes('verb') ? ['p', 'd', 'i', '3'] : [])]
  return keys.filter((key) => values[key]).map((key) => ({ label: exchangeLabels[key], value: values[key] }))
}

function parsePronunciations(api: ApiEntry | null, term: string, offline: [string, string] | null): { uk: Pronunciation; us: Pronunciation } {
  const result = { uk: { ipa: knownIpa[term]?.uk ?? offline?.[0] ?? '', audio: '' }, us: { ipa: knownIpa[term]?.us ?? offline?.[1] ?? '', audio: '' } }
  for (const phonetic of api?.phonetics ?? []) {
    const url = phonetic.audio ?? ''
    const accent = /(?:uk|gb)(?:\d|\.|-|_)/i.test(url) ? 'uk' : /(?:us|american)(?:\d|\.|-|_)/i.test(url) ? 'us' : null
    if (!accent) continue
    if (phonetic.text) result[accent].ipa = phonetic.text.startsWith('/') ? phonetic.text : `/${phonetic.text}/`
    if (url) result[accent].audio = url.startsWith('//') ? `https:${url}` : url
  }
  return result
}

async function lookup(term: string): Promise<VocabEntry | null> {
  const [row, offline] = await Promise.all([getDictionaryRow(term), getIpaRow(term)])
  if (!row) return null
  const [api, tatoeba] = await Promise.all([getEnglishEntry(term), getTatoebaExamples(term)])
  const parts = parseParts(row, api, term)
  const translations = parseTranslations(row[0])
  const apiExamples = [...new Set((api?.meanings ?? []).flatMap((meaning) => meaning.definitions ?? []).map((definition) => definition.example?.trim() ?? '').filter(Boolean))].slice(0, 3).map((text) => ({ text, author: 'Wiktionary', url: api?.sourceUrls?.[0] ?? '' }))
  const examples = tatoeba.length ? tatoeba : apiExamples
  return enrichEntry({
    term, meaning: translations[0]?.replace(/^(?:n|v|vt|vi|adj|adv|prep|pron|conj|interj)\.\s*/i, '').slice(0, 88) ?? row[0].slice(0, 88),
    translations, parts, ...parsePronunciations(api, term, offline), forms: parseForms(row[2], parts), examples,
    sourceUrl: api?.sourceUrls?.find((url) => url.includes('wiktionary.org')) ?? '', addedAt: Date.now(),
  })
}

function play(entry: VocabEntry, accent: Accent) {
  const source = entry[accent].audio
  if (source) {
    const audio = new Audio(source)
    audio.play().catch(() => speak(entry.term, accent))
  } else speak(entry.term, accent)
}

function speak(term: string, accent: Accent) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(term)
  utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}

function App() {
  const [entries, setEntries] = useState<VocabEntry[]>(loadEntries)
  const study = useStudyTracker()
  const [view, setView] = useState<'vocab' | 'study'>(() => window.location.hash === '#study' ? 'study' : 'vocab')
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [manualMeaning, setManualMeaning] = useState('')
  const [manualTerm, setManualTerm] = useState('')

  const visible = useMemo(() => entries.filter((entry) => {
    const matchesFilter = filter === 'all' || (filter === 'phrase' ? entry.term.includes(' ') : entry.parts.includes(filter))
    return matchesFilter && `${entry.term} ${entry.meaning}`.toLowerCase().includes(search.trim().toLowerCase())
  }), [entries, filter, search])
  const active = entries.find((entry) => entry.term === selected) ?? null

  useEffect(() => {
    const updateView = () => { if (window.location.hash === '#study') study.finish(); setView(window.location.hash === '#study' ? 'study' : 'vocab'); setSelected(null) }
    window.addEventListener('hashchange', updateView)
    return () => window.removeEventListener('hashchange', updateView)
  }, [])

  useEffect(() => {
    const outdated = entries.filter((entry) => !entry.uk.ipa || !entry.us.ipa || entry.parts.includes('interjection'))
    if (!outdated.length) return
    let cancelled = false
    void Promise.all(outdated.map(async (entry) => ({ term: entry.term, ipa: await getIpaRow(entry.term), row: await getDictionaryRow(entry.term) }))).then((updates) => {
      if (cancelled) return
      setEntries((current) => {
        const next = current.map((entry) => {
          const update = updates.find((item) => item.term === entry.term)
          if (!update) return entry
          return { ...entry, uk: { ...entry.uk, ipa: entry.uk.ipa || update.ipa?.[0] || '' }, us: { ...entry.us, ipa: entry.us.ipa || update.ipa?.[1] || '' }, parts: update.row ? parseParts(update.row, null, entry.term) : entry.parts }
        })
        if (JSON.stringify(next) === JSON.stringify(current)) return current
        saveEntries(next)
        return next
      })
    })
    return () => { cancelled = true }
  }, [entries])

  function updateEntries(next: VocabEntry[]) { setEntries(next); saveEntries(next) }

  async function addWord(raw = input) {
    const term = raw.trim().replace(/\s+/g, ' ').toLowerCase()
    if (!term) { setMessage('请输入英文单词或短语。'); return }
    if (!/^[a-z][a-z '-]*[a-z]$|^[a-z]$/i.test(term) || term.length > 56) { setMessage('请输入不超过 56 个字符的英文单词或短语。'); return }
    if (entries.some((entry) => entry.term === term)) { setMessage('这个词已经在你的词库里了。'); setSelected(term); return }
    setBusy(true); setMessage(''); setManualTerm(''); setManualMeaning('')
    try {
      const result = await lookup(term)
      if (result) { updateEntries([result, ...entries]); setInput(''); setMessage(`已添加 “${term}”`); setSelected(term) }
      else { setManualTerm(term); setMessage('词典暂未收录，可填写中文释义后保存。') }
    } catch { setMessage('词典加载失败，请检查网络后重试。') }
    finally { setBusy(false) }
  }

  function addManually() {
    const meaning = manualMeaning.trim()
    if (!meaning) { setMessage('请先填写简体中文释义。'); return }
    const entry: VocabEntry = { term: manualTerm, meaning, translations: [meaning], parts: [manualTerm.includes(' ') ? 'phrase' : 'word'], uk: { ipa: '', audio: '' }, us: { ipa: '', audio: '' }, forms: [], examples: [], sourceUrl: '', addedAt: Date.now() }
    updateEntries([entry, ...entries]); setInput(''); setManualTerm(''); setManualMeaning(''); setMessage(`已添加 “${entry.term}”`); setSelected(entry.term)
  }

  function removeWord(term: string) {
    updateEntries(entries.filter((entry) => entry.term !== term))
    setSelected(null)
    setMessage(`已从词库移除 “${term}”`)
  }

  return <div className="app-shell">
    <header className="site-header">
      <div className="header-inner"><a className="logo" href="#vocab"><span className="logo-mark"><Icon name="book" size={21} /></span><span>词间 <small>VOCAB NOTEBOOK</small></span></a><nav className="site-nav" aria-label="页面导航"><a className={view === 'vocab' ? 'active' : ''} href="#vocab" aria-current={view === 'vocab' ? 'page' : undefined}>词库</a><a className={view === 'study' ? 'active' : ''} href="#study" aria-current={view === 'study' ? 'page' : undefined}>学习记录</a></nav><span className="header-count">已收藏 <strong>{entries.length}</strong> 词</span></div>
    </header>

    {view === 'vocab' && <main id="vocab" className="main-content" onPointerDownCapture={(event) => { if ((event.target as HTMLElement).closest('button,input,a')) study.recordActivity() }} onKeyDownCapture={() => study.recordActivity()} onInputCapture={() => study.recordActivity()} onScrollCapture={() => study.recordActivity()}>
      <section className="intro">
        <div className="eyebrow"><span /> 把遇见的英语，变成自己的词汇</div>
        <h1>你的随身<span>英语词库<span className="title-dot">.</span></span></h1>
        <p>输入一个单词或短语，收藏中文释义、词性与英美发音。想学的时候，随时打开看看。</p>
        <form className="add-form" onSubmit={(event) => { event.preventDefault(); void addWord() }}>
          <label className="sr-only" htmlFor="new-word">英文单词或短语</label>
          <input id="new-word" value={input} onChange={(event) => { setInput(event.target.value); setManualTerm(''); setMessage('') }} placeholder="输入单词或短语，例如 take a break" autoComplete="off" />
          <button type="submit" disabled={busy}><Icon name="plus" size={19} />{busy ? '查询中…' : '加入词库'}</button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
        {manualTerm && <form className="manual-form" onSubmit={(event) => { event.preventDefault(); addManually() }}><label htmlFor="manual-meaning">为 “{manualTerm}” 填写简体中文释义</label><div><input id="manual-meaning" value={manualMeaning} onChange={(event) => setManualMeaning(event.target.value)} placeholder="例如：休息一下" /><button type="submit">保存</button></div></form>}
        <div className="quick-add"><span>试试添加</span>{suggestions.map((term) => <button key={term} onClick={() => void addWord(term)} disabled={busy}>{term}<Icon name="plus" size={14} /></button>)}</div>
      </section>

      <section className="library" aria-labelledby="library-title">
        <div className="section-title"><div><span className="section-overline">YOUR COLLECTION</span><h2 id="library-title">我的词库 <span>{entries.length.toString().padStart(2, '0')}</span></h2></div><div className="section-line" /></div>
        <div className="library-tools"><div className="filters" role="group" aria-label="筛选词汇">{[['all', '全部'], ['noun', '名词'], ['verb', '动词'], ['phrase', '短语']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="search-field"><Icon name="search" size={19} /><span className="sr-only">搜索词库</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索词库" /></label></div>
        {visible.length ? <div className="vocab-list">{visible.map((entry, index) => <article className="vocab-card" key={entry.term}><div className="card-main"><span className="card-index">{(index + 1).toString().padStart(2, '0')}</span><div className="card-content"><div className="term-line"><h3>{entry.term}</h3><span className="pos-badge">{entry.parts.map((part) => posLabels[part] ?? part).join(' · ')}</span>{entry.usageNotes?.length ? <span className="usage-badge">含俚语义</span> : null}</div><p className="chinese-meaning">{entry.meaning}</p><div className="phonetics"><span>英 <b>{entry.uk.ipa || '暂无音标'}</b></span><button onClick={() => { study.recordActivity(entry.term); play(entry, 'uk') }} aria-label={`播放 ${entry.term} 英式发音`}><Icon name="sound" size={16} /></button><i /><span>美 <b>{entry.us.ipa || '暂无音标'}</b></span><button onClick={() => { study.recordActivity(entry.term); play(entry, 'us') }} aria-label={`播放 ${entry.term} 美式发音`}><Icon name="sound" size={16} /></button></div></div></div><button className="details-button" onClick={() => { study.recordActivity(entry.term); setSelected(entry.term) }} aria-label={`查看 ${entry.term} 详情`} title="查看详情"><Icon name="details" size={21} /><span>详情</span></button></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Icon name="book" size={32} /></div><h3>{entries.length ? '没有找到匹配的词' : '从第一个单词开始'}</h3><p>{entries.length ? '试试其他搜索词或筛选条件。' : '在上方输入英文，释义与发音就会加入你的词库。'}</p>{!entries.length && <button onClick={() => document.getElementById('new-word')?.focus()}>添加单词 <Icon name="arrow" size={17} /></button>}</div>}
      </section>
    </main>}
    {view === 'study' && <StudyPage tracker={study} />}

    <footer><div><span>词间</span> · 把语言一点点收藏起来</div><div>词典：<a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noreferrer">ECDICT</a> · <a href="https://github.com/open-dict-data/ipa-dict" target="_blank" rel="noreferrer">ipa-dict</a> · <a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer">Dictionary API</a> · <a href="https://tatoeba.org/" target="_blank" rel="noreferrer">Tatoeba</a></div></footer>

    {active && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><aside className="details-panel" onPointerDownCapture={() => study.recordActivity()} onKeyDownCapture={() => study.recordActivity()} onScrollCapture={() => study.recordActivity()} role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="panel-head"><span>词汇详情 / WORD DETAILS</span><button onClick={() => setSelected(null)} aria-label="关闭详情"><Icon name="close" /></button></div><div className="panel-body"><div className="detail-hero"><div className="detail-kicker">已收藏 · {new Date(active.addedAt).toLocaleDateString('zh-CN')}</div><h2 id="detail-title">{active.term}</h2><div className="detail-parts">{active.parts.map((part) => <span key={part}>{posLabels[part] ?? part}</span>)}</div><p>{active.meaning}</p></div><div className="detail-section"><h3>发音 <small>PRONUNCIATION</small></h3><div className="detail-sounds">{(['uk', 'us'] as Accent[]).map((accent) => <div key={accent}><span>{accent === 'uk' ? '🇬🇧 英式' : '🇺🇸 美式'}</span><strong>{active[accent].ipa || '暂无音标'}</strong><button onClick={() => { study.recordActivity(active.term); play(active, accent) }} aria-label={`播放 ${active.term} ${accent === 'uk' ? '英式' : '美式'}发音`}><Icon name="sound" size={19} /></button></div>)}</div><p className="detail-note">无录音时使用设备语音朗读，声音取决于浏览器。短语音标可能由各单词音标组合。</p></div><div className="detail-section"><h3>词性与释义 <small>MEANINGS</small></h3><div className="translation-list">{active.translations.map((translation, index) => <p key={`${index}-${translation}`}>{translation}</p>)}</div></div>{active.usageNotes?.length ? <div className="detail-section"><h3>特别用法 <small>USAGE</small></h3><div className="usage-notes">{active.usageNotes.map((note, index) => <div className="usage-note" key={`${index}-${note.label}`}><span>{note.label}</span><p>{note.meaning}</p><blockquote>{note.example}<small>{note.exampleMeaning}</small></blockquote><a href={note.sourceUrl} target="_blank" rel="noreferrer">查看用法来源</a></div>)}</div></div> : null}{active.forms.length > 0 && <div className="detail-section"><h3>词形变化 <small>WORD FORMS</small></h3><div className="form-grid">{active.forms.map((form) => <div key={form.label}><span>{form.label}</span><strong>{form.value}</strong></div>)}</div></div>}<div className="detail-section"><h3>例句与表达 <small>EXAMPLES</small></h3>{active.examples.length ? <ol className="example-list">{active.examples.map((example, index) => <li key={`${index}-${example.text}`}>{example.text}{example.url && <a href={example.url} target="_blank" rel="noreferrer">{example.author ? `来源：${example.author}` : '来源'}</a>}</li>)}</ol> : <p className="no-example">这条词目暂时没有可用例句。</p>}</div>{active.sourceUrl && <a className="source-link" href={active.sourceUrl} target="_blank" rel="noreferrer">查看词典来源 <Icon name="arrow" size={15} /></a>}</div><div className="panel-foot"><button className="remove-button" onClick={() => removeWord(active.term)}><Icon name="trash" size={17} /> 从词库移除</button><button className="panel-done" onClick={() => setSelected(null)}>完成</button></div></aside></div>}
  </div>
}

export default App
