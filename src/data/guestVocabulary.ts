import type { Form, VocabEntry } from './model'
import { readJson } from './storage'

const storageKey = 'ipa-sound-lab-vocabulary-v1'
const starterSeedKey = 'ipa-sound-lab-photo-starter-v1'
const appleUsageNote: NonNullable<VocabEntry['usageNotes']>[number] = {
  label: '俚语 · 常与修饰词连用',
  meaning: '人；家伙',
  example: 'He is a good apple who always helps his neighbors.',
  exampleMeaning: '他是个好人，总是帮助邻居。',
  sourceUrl: 'https://en.wiktionary.org/wiki/apple',
}

export function enrichEntry(entry: VocabEntry): VocabEntry {
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
export function loadEntries(): VocabEntry[] {
  try {
    const parsed: unknown = readJson(storageKey) ?? []
    const saved = Array.isArray(parsed) ? parsed.filter((item): item is VocabEntry => item && typeof item === 'object' && typeof item.term === 'string' && typeof item.meaning === 'string' && Array.isArray(item.parts)).map(enrichEntry) : []
    if (readJson(starterSeedKey)) {
      return saved
    }
    const existing = new Set(saved.map((entry) => entry.term.toLowerCase()))
    const seeded = [...saved, ...starterEntries.filter((entry) => !existing.has(entry.term))]
    return seeded
  } catch { return starterEntries }
}


