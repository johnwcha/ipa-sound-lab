// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { dictionaryExamples, entryParts, exampleGroups, meaningGroups, meaningSummary, parseTranslations } from '../src/data/dictionary'
import { WordExamples, WordMeanings } from '../src/WordDefinitions'
import type { VocabEntry } from '../src/data/model'
import { canonicalEntry, emptyData, parseRecovery, validEntry } from '../src/data/model'

afterEach(cleanup)
const raw = 'vt. 剽窃；偷偷地做；偷窃；vi. 窃取；偷偷地行动；[棒球]偷垒；n. [口]偷窃；便宜货；偷垒；[篮球]断球'
const entry: VocabEntry = { term: 'steal', parts: ['verb', 'noun'], translations: [raw], uk: { ipa: '', audio: '' }, us: { ipa: '', audio: '' }, forms: [], examples: [], sourceUrl: '', addedAt: 1 }

describe('dictionary meanings and examples', () => {
  it('saves edited text and deleted items to the same translations while retaining vt and noun markers', () => {
    const save = vi.fn((_entry: VocabEntry) => true)
    render(<WordMeanings entry={entry} canEdit onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: '编辑释义' }))
    fireEvent.change(screen.getByLabelText('及物动词 vt.'), { target: { value: '偷窃；窃取' } })
    fireEvent.click(screen.getByRole('button', { name: '删除不及物动词 vi.' }))
    fireEvent.click(screen.getByRole('button', { name: '保存释义' }))
    const saved = save.mock.calls[0][0] as VocabEntry
    expect(saved.translations).toEqual(['vt. 偷窃；窃取', 'n. [口]偷窃；便宜货；偷垒；[篮球]断球'])
    expect(saved.parts).toEqual(['verb', 'noun'])
    expect(saved).not.toHaveProperty('meaning')
  })
  it('cancels without writing, blocks empty text, and allows deleting every item', () => {
    const save = vi.fn((_entry: VocabEntry) => true)
    render(<WordMeanings entry={entry} canEdit onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: '编辑释义' }))
    fireEvent.change(screen.getByLabelText('及物动词 vt.'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '保存释义' }))
    expect(screen.getByRole('alert').textContent).toContain('空白')
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(screen.getByRole('button', { name: '编辑释义' }))
    for (const name of ['删除及物动词 vt.', '删除不及物动词 vi.', '删除名词']) fireEvent.click(screen.getByRole('button', { name }))
    fireEvent.click(screen.getByRole('button', { name: '保存释义' }))
    expect(save.mock.calls[0][0].translations).toEqual([])
    expect(save.mock.calls[0][0].parts).toEqual([])
  })
  it('blocks saves when another device updates the translations and respects edit restrictions', () => {
    const save = vi.fn((_entry: VocabEntry) => true)
    const view = render(<WordMeanings entry={entry} canEdit onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: '编辑释义' }))
    view.rerender(<WordMeanings entry={{ ...entry, translations: ['n. 云端新释义'] }} canEdit onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: '保存释义' }))
    expect(screen.getByRole('alert').textContent).toContain('其他页面或设备')
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    view.rerender(<WordMeanings entry={entry} canEdit={false} onSave={save} />)
    expect((screen.getByRole('button', { name: '编辑释义' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('derives summaries from translations and strips stale summaries from old records and backups', () => {
    const old = { ...entry, meaning: 'stale vi. n. text' }
    expect(meaningSummary(old)).toBe('动词：剽窃；偷偷地做；偷窃；窃取；偷偷地行动；[棒球]偷垒 ｜ 名词：[口]偷窃；便宜货；偷垒；[篮球]断球')
    const canonical = canonicalEntry(old)
    expect(canonical).not.toHaveProperty('meaning')
    expect(meaningSummary(canonical)).toBe(meaningSummary(old))
    expect(meaningSummary({ ...canonical, translations: ['n. 新释义'] })).toBe('名词：新释义')
    const imported = parseRecovery({ format: 'vocab-notebook', version: 1, data: { ...emptyData(), vocabulary: [{ entry: old, deleted: false, updatedAt: 1 }] } })
    expect(imported.vocabulary[0].entry).not.toHaveProperty('meaning')
    expect(canonicalEntry({ ...old, translations: [] }).translations).toEqual(['stale vi. n. text'])
  })
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
