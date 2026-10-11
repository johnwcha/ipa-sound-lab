import { useMemo, useRef, useState } from 'react'
import './QuizPage.css'
import { newId } from './data/model'
import { meaningSummary } from './data/dictionary'
import type { VocabEntry } from './data/model'
import type { Progress, QuizRound } from './data/model'

type Accent = 'uk' | 'us'
type Entry = VocabEntry
type Mode = 'choice' | 'mixed' | 'audio'
type Deck = 'all' | 'nouns' | 'verbs' | 'phrases' | 'missed'
type Question = { term: string; kind: 'choice' | 'type' | 'audio'; options: string[] }

const deckLabels: Record<Deck, string> = { all: '全部词汇', nouns: '名词', verbs: '动词', phrases: '短语', missed: '待复习' }


function shuffle<T,>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function inDeck(entry: Entry, deck: Deck, missed: string[]) {
  return deck === 'all' || deck === 'missed' && missed.includes(entry.term) || deck === 'nouns' && entry.parts.includes('noun') || deck === 'verbs' && entry.parts.includes('verb') || deck === 'phrases' && entry.term.includes(' ')
}

function makeQuestions(entries: Entry[], pool: Entry[], mode: Mode): Question[] {
  return shuffle(pool).slice(0, 10).map((entry, index) => ({
    term: entry.term,
    kind: mode === 'choice' || mode === 'mixed' && index % 2 === 0 ? 'choice' : mode === 'mixed' ? 'type' : 'audio',
    options: shuffle([meaningSummary(entry), ...shuffle(entries.filter((item) => item.term !== entry.term && meaningSummary(item) !== meaningSummary(entry)).map((item) => meaningSummary(item)).filter((meaning, i, all) => all.indexOf(meaning) === i)).slice(0, 3)]),
  }))
}

export function QuizPage({ entries, onPlay, onActivity, progress, onComplete, canEdit }: { entries: Entry[]; onPlay: (entry: Entry, accent: Accent) => void; onActivity: (term?: string) => void; progress: Progress; onComplete: (round: QuizRound) => boolean; canEdit: boolean }) {
  const roundId = useRef('')
  const completed = useRef(false)
  const [deck, setDeck] = useState<Deck>('all')
  const [mode, setMode] = useState<Mode>('choice')
  const [questions, setQuestions] = useState<Question[]>([])
  const [roundEntries, setRoundEntries] = useState<Entry[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [roundMissed, setRoundMissed] = useState<string[]>([])
  const [finished, setFinished] = useState(false)
  const [accent, setAccent] = useState<Accent>('us')

  const available = useMemo(() => entries.filter((entry) => inDeck(entry, deck, progress.missed)), [entries, deck, progress.missed])
  const question = questions[index]
  const current = roundEntries.find((entry) => entry.term === question?.term)
  const mixedUnlocked = progress.choiceWins >= 2
  const audioUnlocked = progress.mixedWins >= 2


  function selectDeck(next: Deck) { setDeck(next); setQuestions([]); setFinished(false) }
  function selectMode(next: Mode) { if (next === 'mixed' && !mixedUnlocked || next === 'audio' && !audioUnlocked) return; setMode(next); setQuestions([]); setFinished(false) }

  function start() {
    if (!canEdit) return
    roundId.current = newId(); completed.current = false
    if (!available.length || new Set(entries.map((entry) => meaningSummary(entry))).size < 4) return
    setRoundEntries(entries)
    const next = makeQuestions(entries, available, mode)
    setQuestions(next); setIndex(0); setAnswer(''); setCorrect(null); setScore(0); setRoundMissed([]); setFinished(false)
    onActivity(next[0]?.term)
  }

  function submit(value: string) {
    if (!canEdit || !current || correct !== null) return
    const isCorrect = question.kind === 'choice' ? value === meaningSummary(current) : value.trim().replace(/\s+/g, ' ').toLowerCase() === current.term.toLowerCase()
    setAnswer(value); setCorrect(isCorrect)
    if (isCorrect) setScore((count) => count + 1)
    else setRoundMissed((missed) => [...missed, current.term])
    onActivity(current.term)
  }

  function advance() {
    if (!canEdit || completed.current) return
    if (index < questions.length - 1) { setIndex(index + 1); setAnswer(''); setCorrect(null); onActivity(questions[index + 1].term); return }
    const round: QuizRound = { id: roundId.current, mode, score, total: questions.length, completedAt: Date.now(), outcomes: questions.map(item => ({ term: item.term, correct: !roundMissed.includes(item.term) })) }
    if (!onComplete(round)) return
    completed.current = true
    setFinished(true)
  }


  return <main id="quiz" className="quiz-page main-content" onPointerDownCapture={() => onActivity()} onKeyDownCapture={() => onActivity()} onInputCapture={() => onActivity()}>
    <div className="quiz-heading"><div><span className="section-overline">PRACTICE</span><h1>测验与卡片</h1><p>从自己的词库出题，答错的词会进入待复习。</p></div><span className="quiz-rounds">已完成 {progress.rounds} 轮</span></div>

    <div className="practice-grid"><section className="quiz-panel" aria-labelledby="quiz-title"><div className="practice-panel-head"><div><span className="section-overline">QUIZ</span><h2 id="quiz-title">词汇测验</h2></div><span>每轮最多 10 题</span></div>
      <div className="deck-picker" role="group" aria-label="测验词组">{(Object.keys(deckLabels) as Deck[]).map((item) => <button key={item} type="button" className={deck === item ? 'selected' : ''} onClick={() => selectDeck(item)}>{deckLabels[item]} <small>{entries.filter((entry) => inDeck(entry, item, progress.missed)).length}</small></button>)}</div>
      <div className="mode-picker" role="group" aria-label="测验难度"><button type="button" className={mode === 'choice' ? 'selected' : ''} onClick={() => selectMode('choice')}><strong>01 · 选择题</strong><span>英文选中文释义</span></button><button type="button" className={mode === 'mixed' ? 'selected' : ''} onClick={() => selectMode('mixed')} disabled={!mixedUnlocked}><strong>02 · 混合题 {!mixedUnlocked && '🔒'}</strong><span>{mixedUnlocked ? '选择 + 拼写' : `选择题达标 ${progress.choiceWins}/2 轮`}</span></button><button type="button" className={mode === 'audio' ? 'selected' : ''} onClick={() => selectMode('audio')} disabled={!audioUnlocked}><strong>03 · 听音拼写 {!audioUnlocked && '🔒'}</strong><span>{audioUnlocked ? '听发音，输入英文' : `混合题达标 ${progress.mixedWins}/2 轮`}</span></button></div>
      {!questions.length || finished ? <div className="quiz-start">{finished ? <><h3>{score} / {questions.length} 答对</h3><p>{score / questions.length >= .8 ? '这一轮达到 80% 目标。' : '继续练习，答错的词已加入待复习。'}{roundMissed.length ? ` 本轮需复习：${roundMissed.join('、')}` : ''}</p></> : <><h3>{available.length && new Set(entries.map((entry) => meaningSummary(entry))).size >= 4 ? '准备好了吗？' : '这组词还不够出题'}</h3><p>{available.length && new Set(entries.map((entry) => meaningSummary(entry))).size >= 4 ? '选择词组和难度，开始一轮练习。达到 80% 的两轮可解锁下一难度。' : '选择有词汇的卡组，词库中至少需要 4 个不同释义才能生成选项。'}</p></>}<button className="quiz-primary" type="button" onClick={start} disabled={!canEdit || !available.length || new Set(entries.map((entry) => meaningSummary(entry))).size < 4}>{finished ? '再来一轮' : '开始测验'}</button></div> : current && <div className="quiz-question"><div className="quiz-progress"><span>第 {index + 1} / {questions.length} 题</span><span>{score} 答对</span></div><div className="quiz-progress-track"><span style={{ width: `${(index + 1) / questions.length * 100}%` }} /></div>{question.kind === 'audio' ? <><span className="quiz-prompt">听发音，输入英文词汇</span><div className="quiz-audio"><button type="button" onClick={() => onPlay(current, accent)} aria-label="播放题目发音">🔊 播放发音</button><select value={accent} onChange={(event) => setAccent(event.target.value as Accent)} aria-label="选择发音"><option value="us">美式</option><option value="uk">英式</option></select></div></> : <><span className="quiz-prompt">{question.kind === 'choice' ? '选择正确的简体中文释义' : '输入对应的英文词汇'}</span><h3>{question.kind === 'choice' ? current.term : meaningSummary(current)}</h3>{question.kind === 'choice' && <button className="quiz-sound" type="button" onClick={() => onPlay(current, accent)}>🔊 听发音</button>}</>}
        {question.kind === 'choice' ? <div className="quiz-options">{question.options.map((option) => <button key={option} type="button" disabled={!canEdit || correct !== null} className={correct !== null && option === meaningSummary(current) ? 'right' : correct !== null && option === answer ? 'wrong' : ''} onClick={() => submit(option)}>{option}</button>)}</div> : <form className="quiz-type" onSubmit={(event) => { event.preventDefault(); submit(answer) }}><label className="sr-only" htmlFor="quiz-answer">英文词汇</label><input id="quiz-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={!canEdit || correct !== null} placeholder="输入英文单词或短语" autoComplete="off" autoCapitalize="off" spellCheck={false} /><button type="submit" disabled={!canEdit || !answer.trim() || correct !== null}>确认</button></form>}
        {correct !== null && <div className={`quiz-feedback ${correct ? 'right' : 'wrong'}`} role="status"><strong>{correct ? '答对了！' : `正确答案：${current.term} · ${meaningSummary(current)}`}</strong>{current.usageNotes?.length ? <span>这条词还有特别用法，请在词库详情查看。</span> : null}<button type="button" disabled={!canEdit} onClick={advance}>{index === questions.length - 1 ? '查看结果' : '下一题'}</button></div>}</div>}
    </section>

    <Flashcards key={deck + available.map(entry => entry.term).join("|")} available={available} onPlay={onPlay} onActivity={onActivity} /></div>
  </main>
}

function Flashcards({ available, onPlay, onActivity }: { available: Entry[]; onPlay: (entry: Entry, accent: Accent) => void; onActivity: (term?: string) => void }) {
  const [faceUp, setFaceUp] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const card = available[cardIndex % Math.max(available.length, 1)]
  return <section className="flash-panel" aria-labelledby="flash-title"><div className="practice-panel-head"><div><span className="section-overline">FLASHCARDS</span><h2 id="flash-title">闪卡复习</h2></div><span>{available.length} 张</span></div>{card ? <><button type="button" className={`flash-card ${faceUp ? 'flipped' : ''}`} onClick={() => { setFaceUp(!faceUp); onActivity(card.term) }} aria-label={faceUp ? '显示英文卡面' : '翻开卡片查看释义'}><span>{faceUp ? '简体中文释义' : '英文词汇'}</span><strong>{faceUp ? meaningSummary(card) : card.term}</strong><small>{faceUp ? card.term : '点击翻面'}</small></button><div className="flash-controls"><button type="button" onClick={() => { setCardIndex((cardIndex - 1 + available.length) % available.length); setFaceUp(false); onActivity() }}>上一张</button><span>{cardIndex % available.length + 1} / {available.length}</span><button type="button" onClick={() => { setCardIndex((cardIndex + 1) % available.length); setFaceUp(false); onActivity() }}>下一张</button></div><div className="flash-audio"><button type="button" onClick={() => { onPlay(card, 'uk'); onActivity(card.term) }}>🔊 英式</button><button type="button" onClick={() => { onPlay(card, 'us'); onActivity(card.term) }}>🔊 美式</button></div></> : <div className="flash-empty">这组还没有卡片。选择其他词组，或先完成一轮测验。</div>}<p className="flash-note">上方选择的词组也会用作闪卡组。待复习收集答错的词；答对后会移出。</p></section>
}
