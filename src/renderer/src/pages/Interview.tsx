import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AskIntent,
  ChatMessage,
  InterviewSettings,
  InterviewStage,
  InterviewStyle,
  MaterialCategory,
  SchoolProfile,
  StylePreset,
  TranscribeResult
} from '../../../shared/types'

type Phase = 'setup' | 'running' | 'done'

const STAGES: Array<{ key: InterviewStage; label: string; icon: string }> = [
  { key: 'intro', label: '自我介绍', icon: '🗣️' },
  { key: 'english', label: '英语口语', icon: '🇬🇧' },
  { key: 'major', label: '专业课', icon: '📖' },
  { key: 'resume', label: '简历提问', icon: '📄' }
]

const PRESETS: Array<{ key: StylePreset; label: string; desc: string }> = [
  { key: 'gentle', label: '温和引导', desc: '多鼓励，不施压' },
  { key: 'standard', label: '标准型', desc: '贴近真实复试' },
  { key: 'strict', label: '压力型', desc: '连环追问施压' },
  { key: 'academic', label: '学术深挖', desc: '重原理与推导' }
]

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function fmtTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Interview({ onReportReady }: { onReportReady: (id: string) => void }): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('setup')

  // 配置
  const [settings, setSettings] = useState<InterviewSettings | null>(null)
  const [schools, setSchools] = useState<SchoolProfile[]>([])
  const [schoolId, setSchoolId] = useState<string>('')
  const [style, setStyle] = useState<InterviewStyle | null>(null)
  const [useVoice, setUseVoice] = useState(true)

  // 会话
  const [stageIdx, setStageIdx] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answersThisQuestion, setAnswersThisQuestion] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [introCountdown, setIntroCountdown] = useState(0)
  const [generating, setGenerating] = useState(false)

  // 上下文缓存
  const stageContexts = useRef<Record<InterviewStage, string>>({
    intro: '',
    english: '',
    major: '',
    resume: ''
  })
  const schoolNotes = useRef('')
  const selfIntro = useRef('')
  const introAnswered = useRef(false)
  const sessionStart = useRef(0)
  const stageStart = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)

  // 录音（累积识别）
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([]) // 全部录音块（拼接后可解码）
  const pendingChunksRef = useRef<Blob[]>([]) // 触发累积识别的信号队列
  const processingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingRef = useRef(false)
  const recStartRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [liveText, setLiveText] = useState('')
  const [recSeconds, setRecSeconds] = useState(0)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const stage = STAGES[stageIdx].key

  useEffect(() => {
    void (async () => {
      const [s, sch] = await Promise.all([window.api.getSettings(), window.api.listSchools()])
      setSettings(s)
      setSchools(sch)
      setStyle(s.style)
    })()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, thinking])

  // 计时器（总用时 + 自我介绍倒计时）
  useEffect(() => {
    if (phase !== 'running') return
    const iv = setInterval(() => {
      // 全局总用时（自我介绍完毕、换环节后持续走）
      setElapsed(Math.floor((Date.now() - sessionStart.current) / 1000))
      // 自我介绍倒计时（仅 intro 阶段）
      if (stage === 'intro' && settings) {
        const remain = Math.max(0, settings.introSeconds - Math.floor((Date.now() - stageStart.current) / 1000))
        setIntroCountdown(remain)
      }
    }, 1000)
    timerRef.current = iv
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, stage, settings])

  // 录音计时（每秒更新显示）
  useEffect(() => {
    if (!recording) return
    const iv = setInterval(() => {
      setRecSeconds(Math.round((Date.now() - recStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [recording])

  const appendAssistant = useCallback((content: string): void => {
    setMessages((m) => [...m, { role: 'assistant', content }])
  }, [])

  const appendUser = useCallback((msg: { content: string; images?: string[] }): void => {
    setMessages((m) => [
      ...m,
      { role: 'user', content: msg.content, images: msg.images && msg.images.length > 0 ? msg.images : undefined }
    ])
  }, [])

  /** 加载某分类资料文本 */
  const loadMaterialsText = useCallback(async (category: MaterialCategory, maxChars: number): Promise<string> => {
    const list = await window.api.listMaterials(category)
    let text = ''
    for (const m of list) {
      if (m.status !== 'ok') continue
      const d = await window.api.previewMaterial(m.id)
      if (d) text += `\n【${m.name}】\n${d.text}`
    }
    return text.trim().slice(0, maxChars)
  }, [])

  /** AI 说话（可选） */
  const speak = useCallback(async (text: string, english: boolean): Promise<void> => {
    if (!settings?.voiceEnabled || !useVoice) return
    const voice = english ? settings.ttsVoiceEn : settings.ttsVoiceZh
    const r = await window.api.speakTts(text, voice, settings.ttsSpeed)
    if (r.ok && audioRef.current) {
      audioRef.current.src = `data:${r.mime};base64,${r.base64}`
      await audioRef.current.play().catch(() => {})
    }
  }, [settings, useVoice])

  /** 调面试官 */
  const ask = useCallback(
    async (intent: AskIntent): Promise<void> => {
      if (!style) return
      setThinking(true)
      setError(null)
      try {
        const payload = {
          stage,
          questionIndex,
          totalQuestions: totalForStage(stage, settings),
          intent,
          answersThisQuestion,
          history: messages,
          stageContext: stageContexts.current[stage],
          style,
          schoolNotes: schoolNotes.current,
          selfIntro: selfIntro.current
        }
        const reply = await window.api.askInterviewer(payload)
        appendAssistant(reply)
        // 只朗读提问，点评/提示/追问不朗读
        if (intent === 'question') {
          await speak(reply, stage === 'english')
        }
      } catch (e) {
      } finally {
        setThinking(false)
      }
    },
    [stage, questionIndex, answersThisQuestion, messages, style, settings, appendAssistant, speak]
  )

  function totalForStage(s: InterviewStage, st: InterviewSettings | null): number {
    if (!st) return 5
    return { intro: 1, english: st.englishQuestions, major: st.majorQuestions, resume: st.resumeQuestions }[s]
  }

  const goNextStage = useCallback((): void => {
    if (stageIdx >= 3) {
      // 全部完成
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase('done')
      return
    }
    const next = stageIdx + 1
    setStageIdx(next)
    setQuestionIndex(0)
    setAnswersThisQuestion(0)
    stageStart.current = Date.now()
    setIntroCountdown(0)
    // 下一阶段开场提问
    void (async () => {
      await new Promise((r) => setTimeout(r, 50))
      setThinking(true)
      try {
        const payload = {
          stage: STAGES[next].key,
          questionIndex: 0,
          totalQuestions: totalForStage(STAGES[next].key, settings),
          intent: 'question' as AskIntent,
          answersThisQuestion: 0,
          history: [], // 各阶段独立开场，不带上一阶段历史，避免串味
          stageContext: stageContexts.current[STAGES[next].key],
          style: style!,
          schoolNotes: schoolNotes.current,
          selfIntro: selfIntro.current
        }
        const reply = await window.api.askInterviewer(payload)
        appendAssistant(reply)
        await speak(reply, STAGES[next].key === 'english')
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setThinking(false)
      }
    })()
  }, [stageIdx, settings, style, appendAssistant, speak])

  /** 发送用户消息（可附带图片） */
  const sendUser = useCallback(
    async (text: string, images?: string[]): Promise<void> => {
      const trimmed = text.trim()
      const imgs = images?.filter((i) => i && i.startsWith('data:image')) ?? []
      if ((!trimmed && imgs.length === 0) || thinking) return
      appendUser({ content: trimmed, images: imgs.length > 0 ? imgs : undefined })

      if (stage === 'intro') {
        // 自我介绍阶段：点过"完毕"后，追问回答要触发 AI 回应
        if (introAnswered.current) {
          setAnswersThisQuestion((n) => n + 1)
          await ask('answer')
          return
        }
        // 自我介绍：累计，点"完毕"后 AI 点评追问
        selfIntro.current = selfIntro.current ? `${selfIntro.current}\n${trimmed}` : trimmed
        return
      }
      setAnswersThisQuestion((n) => n + 1)
      await ask('answer')
    },
    [stage, thinking, appendUser, ask]
  )

  /** 选择图片（多模态：让面试官看图） */
  const pickImages = useCallback(async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    const imgs: string[] = []
    for (const f of Array.from(files).slice(0, 3)) {
      if (!f.type.startsWith('image/')) continue
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = reject
        fr.readAsDataURL(f)
      })
      imgs.push(dataUrl)
    }
    if (imgs.length > 0) setPendingImages((prev) => [...prev, ...imgs])
    if (imageInputRef.current) imageInputRef.current.value = ''
  }, [])

  const handleIntroDone = useCallback((): void => {
    introAnswered.current = true
    void (async () => {
      setThinking(true)
      try {
        const payload = {
          stage: 'intro' as InterviewStage,
          questionIndex: 0,
          totalQuestions: 1,
          intent: 'answer' as AskIntent,
          answersThisQuestion: 1,
          history: messages,
          stageContext: '',
          style: style!,
          schoolNotes: schoolNotes.current,
          selfIntro: selfIntro.current
        }
        const reply = await window.api.askInterviewer(payload)
        appendAssistant(reply)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setThinking(false)
      }
    })()
  }, [messages, style, appendAssistant])

  const handleHint = useCallback((): void => {
    void ask('hint')
  }, [ask])

  const handleSkip = useCallback((): void => {
    setAnswersThisQuestion(0)
    void ask('skip')
  }, [ask])

  const handleNextQuestion = useCallback((): void => {
    setQuestionIndex((i) => i + 1)
    setAnswersThisQuestion(0)
    // 等 state 更新后再出题
    setTimeout(() => {
      void ask('question')
    }, 0)
  }, [ask])

  const handleStart = useCallback(async (): Promise<void> => {
    if (!settings || !style) return
    setError(null)
    // 加载上下文
    stageContexts.current.english = await loadMaterialsText('english', 8000)
    stageContexts.current.major = await loadMaterialsText('major', 8000)
    stageContexts.current.resume = await loadMaterialsText('resume', 6000)
    schoolNotes.current = schoolId ? await window.api.getSchoolNotes(schoolId) : ''

    selfIntro.current = ''
    introAnswered.current = false
    setMessages([])
    setStageIdx(0)
    setQuestionIndex(0)
    setAnswersThisQuestion(0)
    sessionStart.current = Date.now()
    stageStart.current = Date.now()
    setElapsed(0)
    setPhase('running')
    void ask('question')
  }, [settings, style, schoolId, loadMaterialsText, ask])

  const handleEnd = useCallback((): void => {
    if (!window.confirm('确定结束本次面试？将无法生成评分报告。')) return
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('done')
  }, [])

  /** 生成评分报告并跳转报告页 */
  const handleGenerateReport = useCallback(async (): Promise<void> => {
    if (!style) return
    setGenerating(true)
    setError(null)
    try {
      const record = await window.api.generateReport({
        startedAt: new Date(sessionStart.current).toISOString(),
        endedAt: new Date().toISOString(),
        durationSec: elapsed,
        schoolName: schoolId ? (schools.find((s) => s.id === schoolId)?.name ?? '') : '',
        preset: style.preset,
        messages
      })
      onReportReady(record.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
    }
  }, [style, elapsed, schoolId, schools, messages, onReportReady])

  /* ---------- 录音（实时识别 + 完整识别双通道） ---------- */

  /** 累积识别：把已录的全部音频拼接识别（拼接 webm 可解码），替换式更新预览 */
  const transcribeAll = useCallback(async (): Promise<void> => {
    if (processingRef.current) return
    processingRef.current = true
    try {
      while (pendingChunksRef.current.length > 0) {
        pendingChunksRef.current = [] // 累积全量识别，丢弃按块增量
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const buf = new Uint8Array(await blob.arrayBuffer())
        const r: TranscribeResult = await window.api.transcribeAudio(arrayBufferToBase64(buf))
        if (r.ok && r.text) {
          setLiveText(r.text) // 替换式：显示到目前为]的全部识别文本
        } else if (!r.ok) {
          setLiveText('')
        }
      }
    } finally {
      processingRef.current = false
    }
  }, [])

  /** 点击切换：开始 / 停止录音 */
  const toggleRecording = useCallback(async (): Promise<void> => {
    if (recordingRef.current) {
      stopRecording()
      return
    }
    await startRecording()
  }, [])

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      // 单个录音器：2s 分块累积；拼接块可解码（ffmpeg 处理级联 Segment）
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      pendingChunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          pendingChunksRef.current.push(e.data)
          void transcribeAll()
        }
      }
      recorderRef.current = rec
      setLiveText('')
      rec.start(2000)
      recordingRef.current = true
      recStartRef.current = Date.now()
      setRecording(true)
      setRecSeconds(0)
    } catch (e) {
      setError(`无法录音：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [transcribeAll])

  /** 停止录音并发送识别结果 */
  const stopRecording = useCallback((): void => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    try {
      recorderRef.current?.stop()
    } catch {
      /* ignore */
    }

    const durationSec = Math.round((Date.now() - recStartRef.current) / 1000)
    void (async () => {
      // 等实时预览识别队列清空
      while (processingRef.current || pendingChunksRef.current.length > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }
      // 释放麦克风
      streamRef.current?.getTracks().forEach((t) => t.stop())
      setTranscribing(true)
      try {
        const live = liveText.trim()
        // 长录音（>25s）直接用实时识别文本，避免全量识别耗时过长
        if (durationSec > 25 && live) {
          await sendUser(live)
        } else {
          // 全量拼接识别（块拼接可解码，最准）
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const buf = new Uint8Array(await blob.arrayBuffer())
          const r: TranscribeResult = await window.api.transcribeAudio(arrayBufferToBase64(buf))
          if (r.ok && r.text) {
            await sendUser(r.text)
          } else if (live) {
            await sendUser(live)
          } else if (!r.ok) {
            setError(r.error ?? '识别失败')
          }
        }
        setLiveText('')
      } finally {
        setTranscribing(false)
      }
    })()
  }, [sendUser])



  if (!settings || !style) return <div className="page-loading">加载中…</div>

  /* ================= 配置面板 ================= */
  if (phase === 'setup') {
    return (
      <div className="page">
        <header className="page-header">
          <h1>模拟面试</h1>
          <p>按「自我介绍 → 英语口语 → 专业课 → 简历」四阶段进行，AI 扮演你的面试官</p>
        </header>

        <div className="card">
          <h2 className="card-title">🏫 目标学校（可选）</h2>
          <div className="form-row">
            <label>绑定学校</label>
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">不绑定（通用风格）</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{s.target} · {s.notes.length} 条笔记）
                </option>
              ))}
            </select>
          </div>
          {schoolId && (
            <p className="hint">已选择：面试官将参考该校风格笔记出题与追问。</p>
          )}
          {schools.length === 0 && (
            <p className="hint">还没有学校风格资料，可到「学校风格」页录入目标院校的面试风格。</p>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">🎭 面试官风格（本次练习）</h2>
          <div className="preset-row">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`preset-btn${style.preset === p.key ? ' active' : ''}`}
                onClick={() => setStyle({ ...style, preset: p.key })}
              >
                <strong>{p.label}</strong>
                <span>{p.desc}</span>
              </button>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-row">
              <label>追问深度：{style.followUpDepth}</label>
              <input
                type="range"
                min={1}
                max={5}
                value={style.followUpDepth}
                onChange={(e) => setStyle({ ...style, followUpDepth: Number(e.target.value) })}
              />
            </div>
            <div className="form-row">
              <label>英语难度：{style.englishDifficulty}</label>
              <input
                type="range"
                min={1}
                max={5}
                value={style.englishDifficulty}
                onChange={(e) => setStyle({ ...style, englishDifficulty: Number(e.target.value) })}
              />
            </div>
            <div className="form-row">
              <label>压力程度：{style.pressureLevel}</label>
              <input
                type="range"
                min={1}
                max={5}
                value={style.pressureLevel}
                onChange={(e) => setStyle({ ...style, pressureLevel: Number(e.target.value) })}
              />
            </div>
            <div className="form-row">
              <label>语音朗读</label>
              <label className="checkbox-row">
                <input type="checkbox" checked={useVoice} onChange={(e) => setUseVoice(e.target.checked)} />
                AI 回复语音朗读
              </label>
            </div>
          </div>
          <div className="form-row">
            <label>自由描述</label>
            <textarea
              rows={2}
              value={style.customNote}
              placeholder="可选：对面试官补充额外要求，如「多问科研细节」「全程严肃别夸奖」…"
              onChange={(e) => setStyle({ ...style, customNote: e.target.value })}
            />
          </div>
          {error && <div className="err-banner">⚠️ {error}</div>}
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => void handleStart()} disabled={thinking}>
              🚀 开始面试
            </button>
            <span className="hint" style={{ margin: 0 }}>
              共 4 个环节 · 自我介绍 {Math.round(settings.introSeconds / 60)} 分钟 · 英语 {settings.englishQuestions} 题 · 专业课{' '}
              {settings.majorQuestions} 题 · 简历 {settings.resumeQuestions} 题
            </span>
          </div>
        </div>
      </div>
    )
  }

  /* ================= 完成 ================= */
  if (phase === 'done') {
    return (
      <div className="page">
        <div className="card placeholder" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
          <h2>面试结束</h2>
          <p style={{ marginTop: 8 }}>
            本次模拟面试已完成。点击下方按钮生成详细评分报告（分项打分、改进建议、问答回放）。
          </p>
          <p style={{ marginTop: 4, color: 'var(--text-dim)' }}>总用时 {fmtTime(elapsed)}</p>
          {error && <div className="err-banner" style={{ textAlign: 'left' }}>⚠️ {error}</div>}
          <div className="inline-actions" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn primary" onClick={() => void handleGenerateReport()} disabled={generating}>
              {generating ? '⏳ 正在生成评分报告（约 20 秒）…' : '📊 生成评分报告'}
            </button>
            <button
              className="btn"
              onClick={() => {
                setPhase('setup')
              }}
            >
              再来一次
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ================= 面试中 ================= */
  const isEnglish = stage === 'english'
  const stageTotal = totalForStage(stage, settings)
  const canHint = settings.allowHint && (stage === 'major' || stage === 'english' || stage === 'resume')
  const canSkip = settings.allowSkip && stage !== 'intro'

  return (
    <div className="page interview-page">
      {/* 顶部状态 */}
      <div className="interview-top">
        <div className="stage-tabs">
          {STAGES.map((s, i) => (
            <div key={s.key} className={`stage-tab${i === stageIdx ? ' active' : ''}${i < stageIdx ? ' done' : ''}`}>
              <span className="stage-icon">{s.icon}</span>
              {s.label}
              {i < stageIdx && <span className="stage-check">✓</span>}
            </div>
          ))}
        </div>
        <div className="interview-meta">
          <span className="time-badge">⏱ {fmtTime(elapsed)}</span>
          {stage === 'intro' && introCountdown > 0 && (
            <span className={`time-badge${introCountdown <= 15 ? ' danger' : ''}`}>自我介绍剩余 {introCountdown}s</span>
          )}
          {(stage === 'english' || stage === 'major' || stage === 'resume') && (
            <span className="time-badge">
              第 {questionIndex + 1}/{stageTotal} 题
            </span>
          )}
          <span className="school-badge">{schoolId ? schools.find((s) => s.id === schoolId)?.name ?? '' : ''}</span>
        </div>
      </div>

      {/* 对话区 */}
      <div className="chat" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">{m.content}</div>
          </div>
        ))}
        {thinking && (
          <div className="chat-msg assistant">
            <div className="chat-bubble thinking">…</div>
          </div>
        )}
      </div>

      {error && <div className="err-banner">⚠️ {error}</div>}

      {/* 阶段操作 */}
      <div className="stage-actions">
        {stage === 'intro' && (
          <>
            <button className="btn primary" onClick={handleIntroDone} disabled={thinking || !selfIntro.current}>
              {selfIntro.current ? '自我介绍完毕 → 面试官点评追问' : '先完成自我介绍'}
            </button>
            <button className="btn" onClick={() => void ask('introFollowup')} disabled={thinking}>
              跳过追问（收尾）
            </button>
          </>
        )}
        {(stage === 'english' || stage === 'major' || stage === 'resume') && (
          <>
            {canHint && (
              <button className="btn" onClick={handleHint} disabled={thinking}>
                💡 提示
              </button>
            )}
            {canSkip && (
              <button className="btn" onClick={handleSkip} disabled={thinking}>
                🔄 换一题
              </button>
            )}
            <button className="btn" onClick={handleNextQuestion} disabled={thinking}>
              ⏭ 下一题
            </button>
          </>
        )}
        <button className="btn" onClick={goNextStage} disabled={thinking}>
          {stageIdx < 3 ? '进入下一环节 →' : '完成面试 →'}
        </button>
        <button className="btn danger" onClick={handleEnd} disabled={thinking}>
          结束
        </button>
      </div>

      {/* 输入区 */}
      <div className="chat-input">
        <button
          className={`btn ${recording ? 'danger' : 'primary'} record-btn`}
          onClick={() => void toggleRecording()}
          disabled={transcribing || thinking}
        >
          {recording ? `🔴 停止录音（${recSeconds}s）` : transcribing ? '识别中…' : '🎤 开始说话'}
        </button>
        <input
          ref={textInputRef}
          type="text"
          placeholder={isEnglish ? 'Type your answer in English…' : '输入你的回答，回车发送'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = textInputRef.current?.value ?? ''
              textInputRef.current!.value = ''
              void sendUser(v, pendingImages)
              setPendingImages([])
            }
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => void pickImages(e.target.files)}
        />
        <button className="btn" onClick={() => imageInputRef.current?.click()} disabled={thinking} title="发送图片给面试官看（需多模态模型）">
          🖼️
        </button>
        <button
          className="btn"
          onClick={() => {
            const v = textInputRef.current?.value ?? ''
            textInputRef.current!.value = ''
            void sendUser(v, pendingImages)
            setPendingImages([])
          }}
          disabled={thinking}
        >
          发送
        </button>
      </div>
      {pendingImages.length > 0 && (
        <div className="img-preview">
          {pendingImages.map((img, i) => (
            <div className="img-thumb" key={i}>
              <img src={img} alt={`图${i + 1}`} />
              <button className="img-remove" onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <span className="hint" style={{ margin: 0 }}>发送时将附带图片给面试官</span>
        </div>
      )}
      {recording && liveText && (
        <div className="live-text">🎙️ 实时识别：{liveText}</div>
      )}
      {transcribing && !recording && <div className="live-text">⏳ 正在识别完整录音…</div>}
      <audio ref={audioRef} className="hidden-audio" />
    </div>
  )
}
