import { useEffect, useMemo, useState } from 'react'
import './QuizPage.css'

type Accent = 'uk' | 'us'
type Entry = { term: string; meaning: string; parts: string[]; uk: { ipa: string }; us: { ipa: string }; usageNotes?: { label: string }[] }
type Mode = 'choice' | 'mixed' | 'audio'
type Deck = 'all' | 'nouns' | 'verbs' | 'phrases' | 'missed'
type Progress = { choiceWins: number; mixedWins: number; missed: string[]; rounds: number }
type Question = { term: string; kind: 'choice' | 'type' | 'audio'; options: string[] }

const progressKey = 'ipa-sound-lab-quiz-v1'
const emptyProgress: Progress = { choiceWins: 0, mixedWins: 0, missed: [], rounds: 0 }
const deckLabels: Record<Deck, string> = { all: '全部词汇', nouns: '名词', verbs: '动词', phrases: '短语', missed: '待复习' }

function loadProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(progressKey) ?? 'null') as Partial<Progress> | null
    return value ? { choiceWins: Number(value.choiceWins) || 0, mixedWins: Number(value.mixedWins) || 0, rounds: Number(value.rounds) || 0, missed: Array.isArray(value.missed) ? value.missed.filter((term): term is string => typeof term === 'string') : [] } : emptyProgress
  } catch { return emptyProgress }
}

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
    options: shuffle([entry.meaning, ...shuffle(entries.filter((item) => item.term !== entry.term && item.meaning !== entry.meaning).map((item) => item.meaning).filter((meaning, i, all) => all.indexOf(meaning) === i)).slice(0, 3)]),
  }))
}

export function QuizPage({ entries, onPlay, onActivity }: { entries: Entry[]; onPlay: (entry: Entry, accent: Accent) => void; onActivity: (term?: string) => void }) {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [deck, setDeck] = useState<Deck>('all')
  const [mode, setMode] = useState<Mode>('choice')
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [roundMissed, setRoundMissed] = useState<string[]>([])
  const [finished, setFinished] = useState(false)
  const [faceUp, setFaceUp] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const [accent, setAccent] = useState<Accent>('us')

  const available = useMemo(() => entries.filter((entry) => inDeck(entry, deck, progress.missed)), [entries, deck, progress.missed])
  const question = questions[index]
  const current = entries.find((entry) => entry.term === question?.term)
  const card = available[cardIndex % Math.max(available.length, 1)]
  const mixedUnlocked = progress.choiceWins >= 2
  const audioUnlocked = progress.mixedWins >= 2

  function saveProgress(next: Progress) {
    setProgress(next)
    try { localStorage.setItem(progressKey, JSON.stringify(next)) } catch { /* Device storage may be unavailable. */ }
  }

  function selectDeck(next: Deck) { setDeck(next); setCardIndex(0); setFaceUp(false); setQuestions([]); setFinished(false) }
  function selectMode(next: Mode) { if (next === 'mixed' && !mixedUnlocked || next === 'audio' && !audioUnlocked) return; setMode(next); setQuestions([]); setFinished(false) }

  function start() {
    if (!available.length || new Set(entries.map((entry) => entry.meaning)).size < 4) return
    const next = makeQuestions(entries, available, mode)
    setQuestions(next); setIndex(0); setAnswer(''); setCorrect(null); setScore(0); setRoundMissed([]); setFinished(false)
    onActivity(next[0]?.term)
  }

  function submit(value: string) {
    if (!current || correct !== null) return
    const isCorrect = question.kind === 'choice' ? value === current.meaning : value.trim().replace(/\s+/g, ' ').toLowerCase() === current.term.toLowerCase()
    setAnswer(value); setCorrect(isCorrect)
    if (isCorrect) setScore((count) => count + 1)
    else setRoundMissed((missed) => [...missed, current.term])
    onActivity(current.term)
  }

  function advance() {
    if (index < questions.length - 1) { setIndex(index + 1); setAnswer(''); setCorrect(null); onActivity(questions[index + 1].term); return }
    const finalScore = score
    const passed = finalScore / questions.length >= .8
    saveProgress({
      choiceWins: progress.choiceWins + (passed && mode === 'choice' ? 1 : 0),
      mixedWins: progress.mixedWins + (passed && mode === 'mixed' ? 1 : 0),
      rounds: progress.rounds + 1,
      missed: [...new Set([...progress.missed.filter((term) => !questions.some((item) => item.term === term && !roundMissed.includes(term))), ...roundMissed])],
    })
    setFinished(true)
  }

  useEffect(() => { setCardIndex(0); setFaceUp(false) }, [entries.length])

  return <main id="quiz" className="quiz-page main-content" onPointerDownCapture={() => onActivity()} onKeyDownCapture={() => onActivity()} onInputCapture={() => onActivity()}>
    <div className="quiz-heading"><div><span className="section-overline">PRACTICE</span><h1>测验与卡片</h1><p>从自己的词库出题，答错的词会进入待复习。</p></div><span className="quiz-rounds">已完成 {progress.rounds} 轮</span></div>

    <div className="practice-grid"><section className="quiz-panel" aria-labelledby="quiz-title"><div className="practice-panel-head"><div><span className="section-overline">QUIZ</span><h2 id="quiz-title">词汇测验</h2></div><span>每轮最多 10 题</span></div>
      <div className="deck-picker" role="group" aria-label="测验词组">{(Object.keys(deckLabels) as Deck[]).map((item) => <button key={item} type="button" className={deck === item ? 'selected' : ''} onClick={() => selectDeck(item)}>{deckLabels[item]} <small>{entries.filter((entry) => inDeck(entry, item, progress.missed)).length}</small></button>)}</div>
      <div className="mode-picker" role="group" aria-label="测验难度"><button type="button" className={mode === 'choice' ? 'selected' : ''} onClick={() => selectMode('choice')}><strong>01 · 选择题</strong><span>英文选中文释义</span></button><button type="button" className={mode === 'mixed' ? 'selected' : ''} onClick={() => selectMode('mixed')} disabled={!mixedUnlocked}><strong>02 · 混合题 {!mixedUnlocked && '🔒'}</strong><span>{mixedUnlocked ? '选择 + 拼写' : `选择题达标 ${progress.choiceWins}/2 轮`}</span></button><button type="button" className={mode === 'audio' ? 'selected' : ''} onClick={() => selectMode('audio')} disabled={!audioUnlocked}><strong>03 · 听音拼写 {!audioUnlocked && '🔒'}</strong><span>{audioUnlocked ? '听发音，输入英文' : `混合题达标 ${progress.mixedWins}/2 轮`}</span></button></div>
      {!questions.length || finished ? <div className="quiz-start">{finished ? <><h3>{score} / {questions.length} 答对</h3><p>{score / questions.length >= .8 ? '这一轮达到 80% 目标。' : '继续练习，答错的词已加入待复习。'}{roundMissed.length ? ` 本轮需复习：${roundMissed.join('、')}` : ''}</p></> : <><h3>{available.length && new Set(entries.map((entry) => entry.meaning)).size >= 4 ? '准备好了吗？' : '这组词还不够出题'}</h3><p>{available.length && new Set(entries.map((entry) => entry.meaning)).size >= 4 ? '选择词组和难度，开始一轮练习。达到 80% 的两轮可解锁下一难度。' : '选择有词汇的卡组，词库中至少需要 4 个不同释义才能生成选项。'}</p></>}<button className="quiz-primary" type="button" onClick={start} disabled={!available.length || new Set(entries.map((entry) => entry.meaning)).size < 4}>{finished ? '再来一轮' : '开始测验'}</button></div> : current && <div className="quiz-question"><div className="quiz-progress"><span>第 {index + 1} / {questions.length} 题</span><span>{score} 答对</span></div><div className="quiz-progress-track"><span style={{ width: `${(index + 1) / questions.length * 100}%` }} /></div>{question.kind === 'audio' ? <><span className="quiz-prompt">听发音，输入英文词汇</span><div className="quiz-audio"><button type="button" onClick={() => onPlay(current, accent)} aria-label="播放题目发音">🔊 播放发音</button><select value={accent} onChange={(event) => setAccent(event.target.value as Accent)} aria-label="选择发音"><option value="us">美式</option><option value="uk">英式</option></select></div></> : <><span className="quiz-prompt">{question.kind === 'choice' ? '选择正确的简体中文释义' : '输入对应的英文词汇'}</span><h3>{question.kind === 'choice' ? current.term : current.meaning}</h3>{question.kind === 'choice' && <button className="quiz-sound" type="button" onClick={() => onPlay(current, accent)}>🔊 听发音</button>}</>}
        {question.kind === 'choice' ? <div className="quiz-options">{question.options.map((option) => <button key={option} type="button" disabled={correct !== null} className={correct !== null && option === current.meaning ? 'right' : correct !== null && option === answer ? 'wrong' : ''} onClick={() => submit(option)}>{option}</button>)}</div> : <form className="quiz-type" onSubmit={(event) => { event.preventDefault(); submit(answer) }}><label className="sr-only" htmlFor="quiz-answer">英文词汇</label><input id="quiz-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={correct !== null} placeholder="输入英文单词或短语" autoComplete="off" autoCapitalize="off" spellCheck={false} /><button type="submit" disabled={!answer.trim() || correct !== null}>确认</button></form>}
        {correct !== null && <div className={`quiz-feedback ${correct ? 'right' : 'wrong'}`} role="status"><strong>{correct ? '答对了！' : `正确答案：${current.term} · ${current.meaning}`}</strong>{current.usageNotes?.length ? <span>这条词还有特别用法，请在词库详情查看。</span> : null}<button type="button" onClick={advance}>{index === questions.length - 1 ? '查看结果' : '下一题'}</button></div>}</div>}
    </section>

    <section className="flash-panel" aria-labelledby="flash-title"><div className="practice-panel-head"><div><span className="section-overline">FLASHCARDS</span><h2 id="flash-title">闪卡复习</h2></div><span>{available.length} 张</span></div>{card ? <><button type="button" className={`flash-card ${faceUp ? 'flipped' : ''}`} onClick={() => { setFaceUp(!faceUp); onActivity(card.term) }} aria-label={faceUp ? '显示英文卡面' : '翻开卡片查看释义'}><span>{faceUp ? '简体中文释义' : '英文词汇'}</span><strong>{faceUp ? card.meaning : card.term}</strong><small>{faceUp ? card.term : '点击翻面'}</small></button><div className="flash-controls"><button type="button" onClick={() => { setCardIndex((cardIndex - 1 + available.length) % available.length); setFaceUp(false); onActivity() }}>上一张</button><span>{cardIndex % available.length + 1} / {available.length}</span><button type="button" onClick={() => { setCardIndex((cardIndex + 1) % available.length); setFaceUp(false); onActivity() }}>下一张</button></div><div className="flash-audio"><button type="button" onClick={() => { onPlay(card, 'uk'); onActivity(card.term) }}>🔊 英式</button><button type="button" onClick={() => { onPlay(card, 'us'); onActivity(card.term) }}>🔊 美式</button></div></> : <div className="flash-empty">这组还没有卡片。选择其他词组，或先完成一轮测验。</div>}<p className="flash-note">上方选择的词组也会用作闪卡组。待复习收集答错的词；答对后会移出。</p></section></div>
  </main>
}
