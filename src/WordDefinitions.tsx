import type { VocabEntry } from './data/model'
import { exampleGroups, meaningGroups, posLabels } from './data/dictionary'

export function WordMeanings({ entry }: { entry: VocabEntry }) {
  return <div className="translation-list">{meaningGroups(entry.translations, entry.parts).map(group => <section className="meaning-group" key={group.part}>
    <h4>{posLabels[group.part]}</h4>
    {group.senses.map((sense, index) => <div key={index}>{sense.label && <h5>{sense.label}</h5>}<p>{sense.text}</p></div>)}
  </section>)}</div>
}

export function WordExamples({ entry }: { entry: VocabEntry }) {
  return entry.examples.length ? <>{exampleGroups(entry).map(group => <section className="example-group" key={group.part}>
    <h4>{group.part === 'unclassified' ? '词性未确认的例句' : `${posLabels[group.part]}例句`}</h4>
    {group.part === 'unclassified' && <p className="example-note">来源未标注此句中该词的词性。</p>}
    <ol className="example-list">{group.examples.map((example, index) => <li key={`${index}-${example.text}`}>{example.text}{example.url && <a href={example.url} target="_blank" rel="noreferrer">{example.author ? `来源：${example.author}` : '来源'}</a>}</li>)}</ol>
  </section>)}</> : <p className="no-example">这条词目暂时没有可用例句。</p>
}
