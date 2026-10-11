// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { dictionaryExamples, entryParts, exampleGroups, meaningGroups, parseTranslations } from '../src/data/dictionary'
import { WordExamples, WordMeanings } from '../src/WordDefinitions'
import type { VocabEntry } from '../src/data/model'
import { validEntry } from '../src/data/model'

afterEach(cleanup)
const raw = 'vt. 剽窃；偷偷地做；偷窃；vi. 窃取；偷偷地行动；[棒球]偷垒；n. [口]偷窃；便宜货；偷垒；[篮球]断球'
const entry: VocabEntry = { term: 'steal', meaning: '偷窃', parts: ['verb', 'noun'], translations: [raw], uk: { ipa: '', audio: '' }, us: { ipa: '', audio: '' }, forms: [], examples: [], sourceUrl: '', addedAt: 1 }

describe('dictionary meanings and examples', () => {
  it('parses inline steal meanings into noun and verb, retaining vt / vi and register notes', () => {
    expect(meaningGroups([raw])).toEqual([
      { part: 'verb', senses: [{ label: '及物动词 vt.', text: '剽窃；偷偷地做；偷窃' }, { label: '不及物动词 vi.', text: '窃取；偷偷地行动；[棒球]偷垒' }] },
      { part: 'noun', senses: [{ label: '', text: '[口]偷窃；便宜货；偷垒；[篮球]断球' }] },
    ])
    expect(meaningGroups(parseTranslations(raw))).toEqual(meaningGroups([raw]))
  })
  it('handles escaped/real newlines and shared verb labels without dropping domain meanings', () => {
    expect(meaningGroups(['n. 苹果\\n[计] 苹果机\nadj. 红色', 'vt/vi. 走动']).map(group => group.part)).toEqual(['noun', 'adjective', 'verb'])
    expect(parseTranslations('[化] 化学用语')).toEqual(['[化] 化学用语'])
    expect(meaningGroups(['便宜货'], ['noun'])[0].part).toBe('noun')
    expect(meaningGroups(['手工释义'], ['verb', 'noun'])[0].part).toBe('unclassified')
  })
  it('keeps dictionary example word classes and takes examples from every meaning', () => {
    const examples = dictionaryExamples([
      { partOfSpeech: 'verb', definitions: [{ example: 'Do not steal my bike.' }, { example: 'Do not steal my bike.' }] },
      { partOfSpeech: 'noun', definitions: [{ example: 'This bike was a steal.' }] },
    ], 'https://en.wiktionary.org/wiki/steal')
    expect(examples.map(example => example.partOfSpeech)).toEqual(['verb', 'noun'])
    expect(validEntry({ ...entry, examples })).toBe(true)
    expect(validEntry({ ...entry, examples: [{ ...examples[0], partOfSpeech: 1 }] })).toBe(false)
    expect(exampleGroups({ ...entry, examples: [...examples, { text: 'They steal away.', author: '', url: '', partOfSpeech: 'unclassified' }] }).map(group => group.part)).toEqual(['verb', 'noun', 'unclassified'])
    expect(exampleGroups({ ...entry, examples: [{ text: 'A legacy sentence.', author: '', url: '' }] })[0].part).toBe('unclassified')
    const legacy = { ...entry, parts: ['verb'], examples: [{ text: 'A legacy sentence.', author: '', url: '' }] }
    expect(entryParts(legacy)).toEqual(['verb', 'noun'])
    expect(exampleGroups(legacy)[0].part).toBe('unclassified')
  })
  it('renders separate word-class sections and explicit example headings', () => {
    const examples = dictionaryExamples([{ partOfSpeech: 'verb', definitions: [{ example: 'Do not steal my bike.' }] }, { partOfSpeech: 'noun', definitions: [{ example: 'This bike was a steal.' }] }], '')
    render(<><WordMeanings entry={entry} /><WordExamples entry={{ ...entry, examples }} /></>)
    for (const name of ['动词', '名词', '及物动词 vt.', '不及物动词 vi.', '动词例句', '名词例句']) expect(screen.getByRole('heading', { name })).toBeTruthy()
  })
})
