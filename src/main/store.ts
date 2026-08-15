import { app } from 'electron'
import { promises as fs, mkdirSync } from 'node:fs'
import path from 'node:path'
import type { InterviewSettings } from '../shared/types'

export const DEFAULT_SETTINGS: InterviewSettings = {
  apiKey: '',
  apiBaseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  introSeconds: 150,
  englishQuestions: 5,
  majorQuestions: 6,
  resumeQuestions: 5,
  allowHint: true,
  allowSkip: true,
  voiceEnabled: true,
  ttsVoiceZh: 'zh-CN-XiaoxiaoNeural',
  ttsVoiceEn: 'en-US-AriaNeural',
  ttsSpeed: 1.0,
  style: {
    preset: 'standard',
    followUpDepth: 3,
    englishDifficulty: 3,
    pressureLevel: 2,
    customNote: ''
  },
  providers: [],
  activeProviderId: ''
}

/** 应用数据根目录（资料、录音、历史、模型等） */
export function dataRoot(): string {
  return path.join(app.getPath('userData'), 'data')
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

/** 初始化数据目录结构 */
export function ensureDataDirs(): void {
  const root = dataRoot()
  for (const dir of ['materials/english', 'materials/major', 'resume', 'audio', 'history', 'models']) {
    mkdirSync(path.join(root, dir), { recursive: true })
  }
}

export async function loadSettings(): Promise<InterviewSettings> {
  let s: InterviewSettings
  try {
    const raw = await fs.readFile(settingsFile(), 'utf-8')
    s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<InterviewSettings>) }
  } catch {
    s = { ...DEFAULT_SETTINGS }
  }
  // 迁移：旧版只有 apiKey/apiBaseUrl/model → 生成默认服务商
  if (!s.providers || s.providers.length === 0) {
    if (s.apiKey) {
      s.providers = [{ id: 'default', name: 'DeepSeek', baseUrl: s.apiBaseUrl, model: s.model, apiKey: s.apiKey, vision: false }]
      s.activeProviderId = 'default'
    } else {
      s.providers = []
      s.activeProviderId = ''
    }
  }
  return s
}

/** 当前使用的服务商（无则返回空，调用方报错提示配置） */
export function getActiveProvider(s: InterviewSettings): { id: string; name: string; baseUrl: string; model: string; apiKey: string; vision: boolean } | null {
  if (s.providers && s.providers.length > 0) {
    const p = s.providers.find((x) => x.id === s.activeProviderId) ?? s.providers[0]
    if (p) return { id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model, apiKey: p.apiKey, vision: !!p.vision }
  }
  if (s.apiKey) {
    return { id: 'default', name: 'DeepSeek', baseUrl: s.apiBaseUrl, model: s.model, apiKey: s.apiKey, vision: false }
  }
  return null
}

/** 合并保存设置，原子写入（写临时文件再 rename） */
export async function saveSettings(partial: Partial<InterviewSettings>): Promise<InterviewSettings> {
  const current = await loadSettings()
  const next = { ...current, ...partial }
  const tmp = settingsFile() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf-8')
  await fs.rename(tmp, settingsFile())
  return next
}
