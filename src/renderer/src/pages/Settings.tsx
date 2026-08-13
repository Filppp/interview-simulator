import { useEffect, useState } from 'react'
import type { AppInfo, InterviewSettings, MicStatus } from '../../../shared/types'

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

export default function Settings(): React.JSX.Element {
  const [settings, setSettings] = useState<InterviewSettings | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [micStatus, setMicStatus] = useState<MicStatus>('unknown')
  const [saving, setSaving] = useState(false)
  const [savedTip, setSavedTip] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

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
      const r = await window.api.testApiKey(settings.apiKey)
      setTestResult(r)
    } finally {
      setTesting(false)
    }
  }

  const handleRequestMic = async (): Promise<void> => {
    const st = await window.api.requestMic()
    setMicStatus(st)
  }

  if (!settings) return <div className="page-loading">加载中…</div>

  const mic = MIC_STATUS_TEXT[micStatus]

  return (
    <div className="page">
      <header className="page-header">
        <h1>设置</h1>
        <p>配置 API、面试参数与语音选项</p>
      </header>

      <section className="card">
        <h2 className="card-title">🤖 AI 面试官（DeepSeek）</h2>
        <div className="form-row">
          <label>API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            placeholder="sk-..."
            onChange={(e) => update({ apiKey: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label>API 地址</label>
          <input value={settings.apiBaseUrl} onChange={(e) => update({ apiBaseUrl: e.target.value })} />
        </div>
        <div className="form-row">
          <label>模型</label>
          <input value={settings.model} onChange={(e) => update({ model: e.target.value })} />
        </div>
        <div className="form-row">
          <label>连通性测试</label>
          <div className="inline-actions">
            <button className="btn" onClick={() => void handleTest()} disabled={testing}>
              {testing ? '测试中…' : '测试连接'}
            </button>
            {testResult && (
              <span className={`test-result ${testResult.ok ? 'ok' : 'bad'}`}>{testResult.message}</span>
            )}
          </div>
        </div>
        <p className="hint">Key 仅保存在本机 settings.json，不会上传。没有 Key 请到 platform.deepseek.com 注册获取。</p>
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
        <h2 className="card-title">🔊 语音</h2>
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
        </div>
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
        <p className="hint">语音识别（Whisper）在 M3 里程碑接入，届时麦克风用于录音输入。</p>
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
