import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AppInfo,
  AsrProgress,
  AsrStatus,
  InterviewSettings,
  MicStatus,
  ProviderConfig,
  TranscribeResult
} from '../../../shared/types'

const PROVIDER_PRESETS: Array<{ id: string; name: string; baseUrl: string; model: string; vision: boolean }> = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', vision: false },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max', vision: true },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v-plus', vision: true },
  { id: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', vision: false },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', vision: true },
  { id: 'ollama', name: '本地 Ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b', vision: false }
]

const ZH_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女声，自然）' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊（女声，活泼）' },
  { id: 'zh-CN-YunxiNeural', label: '云希（男声，自然）' },
  { id: 'zh-CN-YunjianNeural', label: '云健（男声，沉稳）' }
]

const EN_VOICES = [
  { id: 'en-US-AriaNeural', label: 'Aria（美音，女）' },
  { id: 'en-US-JennyNeural', label: 'Jenny（美音，女）' },
  { id: 'en-US-GuyNeural', label: 'Guy（美音，男）' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia（英音，女）' }
]

const MIC_STATUS_TEXT: Record<MicStatus, { text: string; cls: string }> = {
  granted: { text: '✅ 已授权', cls: 'ok' },
  denied: { text: '❌ 已拒绝（需到 系统设置→隐私与安全性→麦克风 中开启）', cls: 'bad' },
  'not-determined': { text: '未授权，点击下方按钮申请', cls: 'warn' },
  restricted: { text: '⛔ 受限（系统策略限制）', cls: 'bad' },
  unknown: { text: '未知状态', cls: 'warn' }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export default function Settings(): React.JSX.Element {
  const [settings, setSettings] = useState<InterviewSettings | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [micStatus, setMicStatus] = useState<MicStatus>('unknown')
  const [saving, setSaving] = useState(false)
  const [savedTip, setSavedTip] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // 服务商编辑
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [providerErr, setProviderErr] = useState<string | null>(null)
  // 语音识别状态
  const [asrStatus, setAsrStatus] = useState<AsrStatus | null>(null)
  const [asrProgress, setAsrProgress] = useState<AsrProgress | null>(null)
  const [asrBusy, setAsrBusy] = useState<'setup' | 'download' | null>(null)
  const [asrError, setAsrError] = useState<string | null>(null)

  // TTS 试听
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [ttsError, setTtsError] = useState<string | null>(null)

  // 录音识别测试
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeResult, setTranscribeResult] = useState<TranscribeResult | null>(null)

  const loadAsrStatus = useCallback(async (): Promise<void> => {
    setAsrStatus(await window.api.getAsrStatus())
  }, [])

  useEffect(() => {
    void (async () => {
      const [s, info, mic] = await Promise.all([
        window.api.getSettings(),
        window.api.getAppInfo(),
        window.api.getMicStatus()
      ])
      setSettings(s)
      setAppInfo(info)
      setMicStatus(mic)
    })()
    void loadAsrStatus()
  }, [loadAsrStatus])

  useEffect(() => {
    return window.api.onAsrProgress((p) => setAsrProgress(p))
  }, [])

  const update = (patch: Partial<InterviewSettings>): void => {
    setSettings((s) => (s ? { ...s, ...patch } : s))
  }

  const handleSave = async (): Promise<void> => {
    if (!settings) return
    setSaving(true)
    try {
      const saved = await window.api.saveSettings(settings)
      setSettings(saved)
      setSavedTip(true)
      setTimeout(() => setSavedTip(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    if (!settings) return
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await window.api.testApiKey())
    } finally {
      setTesting(false)
    }
  }

  /* ---------- 服务商管理 ---------- */
  const startAddProvider = (): void => {
    setProviderErr(null)
    setEditingProvider({
      id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: '',
      baseUrl: '',
      model: '',
      apiKey: '',
      vision: false
    })
  }
  const startEditProvider = (p: ProviderConfig): void => {
    setProviderErr(null)
    setEditingProvider({ ...p })
  }
  const applyPreset = (presetId: string): void => {
    const preset = PROVIDER_PRESETS.find((x) => x.id === presetId)
    if (preset && editingProvider) {
      setEditingProvider({ ...editingProvider, name: preset.name, baseUrl: preset.baseUrl, model: preset.model, vision: preset.vision })
    }
  }
  const saveProvider = (): void => {
    if (!editingProvider || !settings) return
    if (!editingProvider.name.trim() || !editingProvider.baseUrl.trim() || !editingProvider.model.trim()) {
      setProviderErr('请填写名称、API 地址和模型')
      return
    }
    const list = settings.providers ?? []
    const idx = list.findIndex((x) => x.id === editingProvider.id)
    const nextList = idx >= 0 ? list.map((x) => (x.id === editingProvider.id ? editingProvider : x)) : [...list, editingProvider]
    const active = settings.activeProviderId || (nextList.length === 1 ? editingProvider.id : settings.activeProviderId)
    update({ providers: nextList, activeProviderId: active })
    setEditingProvider(null)
  }
  const removeProvider = (id: string): void => {
    if (!settings) return
    const list = (settings.providers ?? []).filter((x) => x.id !== id)
    let active = settings.activeProviderId
    if (active === id) active = list.length > 0 ? list[0].id : ''
    if (editingProvider?.id === id) setEditingProvider(null)
    update({ providers: list, activeProviderId: active })
  }
  const setActiveProvider = (id: string): void => {
    update({ activeProviderId: id })
  }
  const patchEditing = (patch: Partial<ProviderConfig>): void => {
    setEditingProvider((p) => (p ? { ...p, ...patch } : p))
  }
  const handleRequestMic = async (): Promise<void> => {
    setMicStatus(await window.api.requestMic())
  }

  /* ---------- 语音识别 ---------- */

  const handleSetupEngine = async (): Promise<void> => {
    setAsrBusy('setup')
    setAsrError(null)
    setAsrProgress(null)
    try {
      setAsrStatus(await window.api.setupAsr())
    } catch (e) {
      setAsrError(e instanceof Error ? e.message : String(e))
    } finally {
      setAsrBusy(null)
    }
  }

  const handleDownloadModel = async (): Promise<void> => {
    setAsrBusy('download')
    setAsrError(null)
    setAsrProgress(null)
    try {
      setAsrStatus(await window.api.downloadAsrModel())
    } catch (e) {
      setAsrError(e instanceof Error ? e.message : String(e))
    } finally {
      setAsrBusy(null)
    }
  }

  const handleCancelDownload = async (): Promise<void> => {
    await window.api.cancelAsrDownload()
  }

  /* ---------- TTS 试听 ---------- */

  const handleTtsPreview = async (voice: string, text: string): Promise<void> => {
    if (!settings) return
    setTtsError(null)
    const r = await window.api.speakTts(text, voice, settings.ttsSpeed)
    if (r.ok && audioRef.current) {
      audioRef.current.src = `data:${r.mime};base64,${r.base64}`
      await audioRef.current.play().catch(() => setTtsError('播放失败'))
    } else {
      setTtsError(r.error ?? '合成失败')
    }
  }

  /* ---------- 录音识别测试 ---------- */

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        void (async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const buf = new Uint8Array(await blob.arrayBuffer())
          setTranscribing(true)
          try {
            const r = await window.api.transcribeAudio(arrayBufferToBase64(buf))
            setTranscribeResult(r)
          } finally {
            setTranscribing(false)
          }
        })()
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setTranscribeResult(null)
    } catch (e) {
      setTranscribeResult({
        ok: false,
        text: '',
        language: null,
        duration: 0,
        error: `无法录音：${e instanceof Error ? e.message : String(e)}`
      })
    }
  }

  const stopRecording = (): void => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    setRecording(false)
  }

  if (!settings) return <div className="page-loading">加载中…</div>

  const mic = MIC_STATUS_TEXT[micStatus]
  const dlSpeed =
    asrProgress && asrProgress.speedBps > 0 ? formatBytes(asrProgress.speedBps) + '/s' : ''
  return (
    <div className="page">
      <header className="page-header">
        <h1>设置</h1>
        <p>配置 API、面试参数、语音识别与语音合成</p>
      </header>

      <section className="card">
        <h2 className="card-title">🤖 AI 服务商（支持多个模型 / 多模态看图）</h2>
        <div className="cat-bar">
          <strong>服务商列表（{settings.providers?.length ?? 0}）</strong>
          <div className="cat-actions">
            <button className="btn primary" onClick={startAddProvider}>＋ 新增服务商</button>
            <button className="btn" onClick={() => void handleTest()} disabled={testing}>
              {testing ? '测试中…' : '🔌 测试当前服务商'}
            </button>
          </div>
        </div>
        {testResult && (
          <p className={`hint ${testResult.ok ? 'ok-text' : 'bad-text'}`}>{testResult.message}</p>
        )}

        {(settings.providers ?? []).length === 0 && !editingProvider ? (
          <div className="empty">
            <div className="empty-icon">🤖</div>
            <p>还没有配置 AI 服务商</p>
            <p className="empty-sub">点击「新增服务商」，可选 DeepSeek / 通义 / OpenAI / 本地 Ollama 等（支持多模态看图）</p>
          </div>
        ) : (
          <ul className="material-list">
            {(settings.providers ?? []).map((p) => (
              <li key={p.id} className={`material-item${settings.activeProviderId === p.id ? ' selected' : ''}`}>
                <div className="material-icon">{p.vision ? '🖼️' : '🤖'}</div>
                <div className="material-info" onClick={() => setActiveProvider(p.id)}>
                  <div className="material-name">
                    {p.name} · {p.model}
                    {p.vision && <span className="count-badge" style={{ marginLeft: 8 }}>多模态</span>}
                    {settings.activeProviderId === p.id && <span className="count-badge" style={{ marginLeft: 6, color: 'var(--accent)' }}>当前</span>}
                  </div>
                  <div className="material-meta">
                    <span>{p.baseUrl}</span>
                    <span>{p.apiKey ? 'Key 已填' : '未填 Key'}</span>
                  </div>
                </div>
                <div className="material-actions">
                  <button className="btn small" onClick={() => startEditProvider(p)}>编辑</button>
                  <button className="btn small danger" onClick={() => removeProvider(p.id)}>删除</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingProvider && (
          <div className="provider-form">
            <div className="cat-bar">
              <strong>{editingProvider.id.includes('p-') && !(settings.providers ?? []).some((x) => x.id === editingProvider.id) ? '➕ 新增服务商' : '✏️ 编辑服务商'}</strong>
            </div>
            <div className="form-row">
              <label>快速模板</label>
              <select
                value=""
                onChange={(e) => e.target.value && applyPreset(e.target.value)}
              >
                <option value="">选择预设自动填入…</option>
                {PROVIDER_PRESETS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}（{x.model}{x.vision ? ' · 多模态' : ''}）
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>名称</label>
              <input value={editingProvider.name} placeholder="如：DeepSeek" onChange={(e) => patchEditing({ name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>API 地址</label>
              <input value={editingProvider.baseUrl} placeholder="https://api.deepseek.com" onChange={(e) => patchEditing({ baseUrl: e.target.value })} />
            </div>
            <div className="form-row">
              <label>模型</label>
              <input value={editingProvider.model} placeholder="deepseek-chat" onChange={(e) => patchEditing({ model: e.target.value })} />
            </div>
            <div className="form-row">
              <label>API Key</label>
              <input type="password" value={editingProvider.apiKey} placeholder="sk-..." onChange={(e) => patchEditing({ apiKey: e.target.value })} />
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={editingProvider.vision} onChange={(e) => patchEditing({ vision: e.target.checked })} />
              支持多模态（可发送图片给 AI 看图）
            </label>
            {providerErr && <div className="err-banner">⚠️ {providerErr}</div>}
            <div className="inline-actions" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={saveProvider}>保存</button>
              <button className="btn" onClick={() => setEditingProvider(null)}>取消</button>
            </div>
          </div>
        )}
        <p className="hint">
          可配置多个服务商，点选切换当前使用；API Key 仅保存在本机。
          多模态模型（如通义 qwen-vl、智谱 glm-4v、GPT-4o）可在面试中发送图片让面试官看图点评。
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">🎯 面试参数</h2>
        <div className="form-grid">
          <div className="form-row">
            <label>自我介绍时长</label>
            <select
              value={String(settings.introSeconds)}
              onChange={(e) => update({ introSeconds: Number(e.target.value) })}
            >
              <option value="120">2 分钟</option>
              <option value="150">2 分 30 秒</option>
              <option value="180">3 分钟</option>
            </select>
          </div>
          <div className="form-row">
            <label>英语口语题数</label>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.englishQuestions}
              onChange={(e) => update({ englishQuestions: Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>专业课题数</label>
            <input
              type="number"
              min={1}
              max={15}
              value={settings.majorQuestions}
              onChange={(e) => update({ majorQuestions: Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>简历提问题数</label>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.resumeQuestions}
              onChange={(e) => update({ resumeQuestions: Number(e.target.value) })}
            />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.allowHint}
              onChange={(e) => update({ allowHint: e.target.checked })}
            />
            答不上时允许"提示"
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.allowSkip}
              onChange={(e) => update({ allowSkip: e.target.checked })}
            />
            允许"换一题"
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">🎭 面试官风格（默认）</h2>
        <div className="preset-row">
          {([
            { key: 'gentle', label: '温和引导型', desc: '多鼓励，不施压' },
            { key: 'standard', label: '标准型', desc: '贴近真实复试' },
            { key: 'strict', label: '压力型', desc: '连环追问施压' },
            { key: 'academic', label: '学术深挖型', desc: '重原理与推导' }
          ] as Array<{ key: InterviewSettings['style']['preset']; label: string; desc: string }>).map((p) => (
            <button
              key={p.key}
              type="button"
              className={`preset-btn${settings.style.preset === p.key ? ' active' : ''}`}
              onClick={() => update({ style: { ...settings.style, preset: p.key } })}
            >
              <strong>{p.label}</strong>
              <span>{p.desc}</span>
            </button>
          ))}
        </div>
        <div className="form-row">
          <label>追问深度：{settings.style.followUpDepth}</label>
          <input
            type="range"
            min={1}
            max={5}
            value={settings.style.followUpDepth}
            onChange={(e) => update({ style: { ...settings.style, followUpDepth: Number(e.target.value) } })}
          />
        </div>
        <div className="form-row">
          <label>英语难度：{settings.style.englishDifficulty}</label>
          <input
            type="range"
            min={1}
            max={5}
            value={settings.style.englishDifficulty}
            onChange={(e) => update({ style: { ...settings.style, englishDifficulty: Number(e.target.value) } })}
          />
        </div>
        <div className="form-row">
          <label>压力程度：{settings.style.pressureLevel}</label>
          <input
            type="range"
            min={1}
            max={5}
            value={settings.style.pressureLevel}
            onChange={(e) => update({ style: { ...settings.style, pressureLevel: Number(e.target.value) } })}
          />
        </div>
        <div className="form-row">
          <label>自由描述</label>
          <textarea
            rows={3}
            value={settings.style.customNote}
            placeholder="例如：多问科研项目细节，追问时保持严肃，不要夸奖考生…"
            onChange={(e) => update({ style: { ...settings.style, customNote: e.target.value } })}
          />
        </div>
        <p className="hint">
          这里是默认风格；开始面试时还可以针对本次练习临时调整。
          结合「学校风格」页面录制的目标院校风格，面试官会更贴近真实。
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">🔊 语音合成（Edge TTS）</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.voiceEnabled}
            onChange={(e) => update({ voiceEnabled: e.target.checked })}
          />
          启用语音（AI 回答朗读）
        </label>
        <div className="form-grid">
          <div className="form-row">
            <label>中文面试官音色</label>
            <select value={settings.ttsVoiceZh} onChange={(e) => update({ ttsVoiceZh: e.target.value })}>
              {ZH_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>英语考官音色</label>
            <select value={settings.ttsVoiceEn} onChange={(e) => update({ ttsVoiceEn: e.target.value })}>
              {EN_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>语速：{settings.ttsSpeed.toFixed(1)}x</label>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.1}
              value={settings.ttsSpeed}
              onChange={(e) => update({ ttsSpeed: Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>试听</label>
            <div className="inline-actions">
              <button className="btn" onClick={() => void handleTtsPreview(settings.ttsVoiceZh, '你好，我是模拟面试官，请先做个自我介绍。')}>
                中文试听
              </button>
              <button className="btn" onClick={() => void handleTtsPreview(settings.ttsVoiceEn, "Hello, I'm your interviewer. Could you introduce yourself?")}>
                英文试听
              </button>
              {ttsError && <span className="test-result bad">{ttsError}</span>}
            </div>
          </div>
        </div>
        <p className="hint">使用微软 Edge 在线语音合成，免费、无需 Key；首次合成需联网，之后自动缓存。</p>
        <audio ref={audioRef} className="hidden-audio" />
      </section>

      <section className="card">
        <h2 className="card-title">🎤 麦克风</h2>
        <div className="form-row">
          <label>权限状态</label>
          <span className={`mic-status ${mic.cls}`}>{mic.text}</span>
        </div>
        <div className="form-row">
          <label>操作</label>
          <button
            className="btn"
            onClick={() => void handleRequestMic()}
            disabled={micStatus === 'granted' || micStatus === 'denied' || micStatus === 'restricted'}
          >
            申请麦克风权限
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">🧠 语音识别（本地 Whisper）</h2>
        {asrStatus && (
          <div className="asr-status">
            <div className="asr-line">
              <span className="asr-label">识别引擎</span>
              {asrStatus.engineReady ? (
                <span className="ok-text">✅ 已安装（venv + faster-whisper）</span>
              ) : (
                <span className="warn-text">❌ 未安装</span>
              )}
            </div>
            <div className="asr-line">
              <span className="asr-label">语音模型</span>
              {asrStatus.modelReady ? (
                <span className="ok-text">✅ {asrStatus.modelName}（{formatBytes(asrStatus.modelTotalBytes)}）</span>
              ) : (
                <span className="warn-text">
                  ⚠️ 未下载完成（{formatBytes(asrStatus.modelDownloadedBytes)} / {formatBytes(asrStatus.modelTotalBytes)}）
                </span>
              )}
            </div>
          </div>
        )}

        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => void handleSetupEngine()} disabled={asrBusy !== null || asrStatus?.engineReady}>
            {asrBusy === 'setup' ? '安装中…' : asrStatus?.engineReady ? '引擎已就绪' : '安装识别引擎'}
          </button>
          <button
            className="btn primary"
            onClick={() => void handleDownloadModel()}
            disabled={asrBusy !== null || asrStatus?.modelReady}
          >
            {asrBusy === 'download' ? '下载中…' : asrStatus?.modelReady ? '模型已就绪' : '下载语音模型'}
          </button>
          {asrBusy === 'download' && (
            <button className="btn danger" onClick={() => void handleCancelDownload()}>
              取消
            </button>
          )}
        </div>

        {asrProgress && asrProgress.phase === 'download' && (
          <div className="dl-box">
            <div className="dl-bar">
              <div className="dl-fill" style={{ width: `${(asrProgress.done / Math.max(1, asrProgress.total)) * 100}%` }} />
            </div>
            <div className="dl-meta">
              {asrProgress.message}
              {dlSpeed && <span> · {dlSpeed}</span>}
            </div>
          </div>
        )}
        {asrProgress && asrProgress.phase !== 'download' && (
          <div className="dl-meta">{asrProgress.message}</div>
        )}
        {asrError && <div className="err-banner">⚠️ {asrError}</div>}
        <p className="hint">
          引擎约 100MB（首次安装），模型约 464MB，均只需一次。模型下载支持断点续传；若网络不佳可稍后重试。
          识别全程在本机运行，音频不会上传。
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">🎙️ 录音识别测试</h2>
        <div className="inline-actions">
          <button
            className={`btn ${recording ? 'danger' : 'primary'}`}
            onPointerDown={() => void startRecording()}
            onPointerUp={stopRecording}
            onPointerLeave={recording ? stopRecording : undefined}
            disabled={transcribing}
          >
            {recording ? '🔴 松开结束' : transcribing ? '识别中…' : '🎤 按住说话'}
          </button>
          {transcribeResult && (
            <div className="transcribe-result">
              {transcribeResult.ok ? (
                <>
                  <div className="ok-text">识别结果（{transcribeResult.language ?? 'auto'}）：</div>
                  <div className="transcribe-text">{transcribeResult.text || '（未识别到内容）'}</div>
                </>
              ) : (
                <span className="bad-text">{transcribeResult.error}</span>
              )}
            </div>
          )}
        </div>
        <p className="hint">
          按住按钮说一句话松开，测试「录音 → 识别」全链路。需要模型下载完成后才能识别。
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">💾 数据目录</h2>
        {appInfo && (
          <div className="kv">
            <div>
              <span>数据目录</span>
              <code>{appInfo.dataDir}</code>
            </div>
            <div>
              <span>应用版本</span>
              <code>
                v{appInfo.appVersion} · Electron {appInfo.electronVersion} · {appInfo.platform}/{appInfo.arch}
              </code>
            </div>
          </div>
        )}
      </section>

      <div className="sticky-save">
        <button className="btn primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? '保存中…' : '保存设置'}
        </button>
        {savedTip && <span className="saved-tip">✅ 已保存</span>}
      </div>
    </div>
  )
}
