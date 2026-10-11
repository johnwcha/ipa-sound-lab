import type { VocabEntry } from './model'

export const posLabels: Record<string, string> = {
  noun: '名词', verb: '动词', adjective: '形容词', adverb: '副词', pronoun: '代词',
  preposition: '介词', conjunction: '连词', interjection: '感叹词', exclamation: '感叹词',
  determiner: '限定词', phrase: '短语', numeral: '数词', auxiliary: '助动词',
  unclassified: '未标注词性',
}
const abbreviations: Record<string, string> = {
  n: 'noun', v: 'verb', vt: 'verb', vi: 'verb', adj: 'adjective', a: 'adjective',
  adv: 'adverb', r: 'adverb', prep: 'preposition', pron: 'pronoun', conj: 'conjunction',
  interj: 'interjection', int: 'interjection', num: 'numeral', det: 'determiner', aux: 'auxiliary',
}
export type MeaningSense = { label: string; text: string }
export type MeaningGroup = { part: string; senses: MeaningSense[] }

// Markers may be separated by real/escaped newlines, semicolons, or spaces.
// Keep domain/register annotations such as [棒球] and [口] with their meaning.
export function meaningGroups(translations: string[], parts: string[] = []): MeaningGroup[] {
  const groups = new Map<string, MeaningGroup>()
  const fallback = parts.length === 1 && posLabels[parts[0]] ? parts[0] : 'unclassified'
  const append = (part: string, label: string, raw: string) => {
    const text = raw.replace(/^[\s;；]+|[\s;；]+$/g, '').trim()
    if (!text) return
    if (!groups.has(part)) groups.set(part, { part, senses: [] })
    groups.get(part)!.senses.push({ label, text })
  }
  for (const raw of translations) {
    const line = raw.replace(/\\n/g, '\n')
    const markers = [...line.matchAll(/(?:^|[\s;；])((?:vt|vi|adj|adv|prep|pron|conj|interj|int|num|det|aux|n|v|a|r)(?:\s*\/\s*(?:vt|vi|v))?)\.\s*/gi)]
    if (!markers.length) { append(fallback, '', line); continue }
    append(fallback, '', line.slice(0, markers[0].index))
    markers.forEach((marker, index) => {
      const code = marker[1].toLowerCase().replace(/\s/g, '')
      const part = abbreviations[code.split('/')[0]] ?? fallback
      const label = code === 'vt' ? '及物动词 vt.' : code === 'vi' ? '不及物动词 vi.' : code.includes('/') ? '及物 / 不及物动词 vt. / vi.' : ''
      append(part, label, line.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? line.length))
    })
  }
  return [...groups.values()]
}

export function serializeMeaning(part: string, sense: MeaningSense): string {
  const code = sense.label.startsWith('及物 /') ? 'vt/vi' : sense.label.startsWith('及物') ? 'vt' : sense.label.startsWith('不及物') ? 'vi' : Object.keys(abbreviations).find(key => abbreviations[key] === part)
  return code ? `${code}. ${sense.text.trim()}` : sense.text.trim()
}

export function parseTranslations(raw: string): string[] {
  return meaningGroups([raw]).flatMap(group => group.senses.map(sense => serializeMeaning(group.part, sense)))
}

export type ApiMeaning = { partOfSpeech?: string; definitions?: { example?: string }[] }
export function dictionaryExamples(meanings: ApiMeaning[], sourceUrl: string): VocabEntry['examples'] {
  const examples: VocabEntry['examples'] = []
  for (const meaning of meanings) {
    const part = meaning.partOfSpeech?.trim().toLowerCase() ?? ''
    const partOfSpeech = abbreviations[part.replace(/\.$/, '')] ?? (posLabels[part] ? part : 'unclassified')
    for (const definition of meaning.definitions ?? []) {
      const text = definition.example?.trim()
      if (!text || examples.some(example => example.text === text && example.partOfSpeech === partOfSpeech) || examples.filter(example => example.partOfSpeech === partOfSpeech).length >= 2) continue
      examples.push({ text, author: 'Wiktionary', url: sourceUrl, partOfSpeech })
    }
  }
  return examples.slice(0, 20)
}

export function entryParts(entry: Pick<VocabEntry, 'translations' | 'parts'>): string[] {
  const parsed = meaningGroups(entry.translations).map(group => group.part).filter(part => part !== 'unclassified')
  return parsed.length ? parsed : entry.parts
}

export function meaningSummary(entry: Pick<VocabEntry, 'translations' | 'parts'>): string {
  return meaningGroups(entry.translations, entry.parts).map(group => {
    const text = group.senses.map(sense => sense.text).join('；')
    return group.part === 'unclassified' ? text : `${posLabels[group.part]}：${text}`
  }).join(' ｜ ')
}

export function exampleGroups(entry: Pick<VocabEntry, 'examples' | 'parts'> & Partial<Pick<VocabEntry, 'translations'>>) {
  const groups = new Map<string, VocabEntry['examples']>()
  const parts = entry.translations ? entryParts({ translations: entry.translations, parts: entry.parts }) : entry.parts
  for (const example of entry.examples) {
    // Old entries with one known word class can be labelled; mixed entries cannot.
    const part = example.partOfSpeech ?? (parts.length === 1 && posLabels[parts[0]] ? parts[0] : 'unclassified')
    const key = posLabels[part] ? part : 'unclassified'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(example)
  }
  return [...groups].map(([part, examples]) => ({ part, examples }))
}
