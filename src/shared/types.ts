/** 主进程与渲染进程共享的类型定义 */

export interface InterviewSettings {
  /** DeepSeek API Key（仅保存在本机） */
  apiKey: string
  /** API 地址（OpenAI 兼容） */
  apiBaseUrl: string
  /** 模型名称 */
  model: string
  /** 自我介绍时长（秒） */
  introSeconds: number
  /** 英语口语问答题数 */
  englishQuestions: number
  /** 专业课问答题数 */
  majorQuestions: number
  /** 简历提问题数 */
  resumeQuestions: number
  /** 允许"提示" */
  allowHint: boolean
  /** 允许"换一题" */
  allowSkip: boolean
  /** 是否启用语音（AI 回答朗读） */
  voiceEnabled: boolean
  /** 中文面试官 TTS 音色 */
  ttsVoiceZh: string
  /** 英语考官 TTS 音色 */
  ttsVoiceEn: string
  /** TTS 语速倍率 */
  ttsSpeed: number
}

export interface AppInfo {
  appVersion: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
  platform: string
  arch: string
  userData: string
  dataDir: string
}

export type MicStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface ApiTestResult {
  ok: boolean
  message: string
}

/* ---------- 资料库 ---------- */

export type MaterialCategory = 'english' | 'major' | 'resume'

export interface MaterialMeta {
  id: string
  /** 原始文件名 */
  name: string
  /** 存储的绝对路径 */
  storedPath: string
  category: MaterialCategory
  /** pdf | docx */
  ext: string
  sizeBytes: number
  /** PDF 页数（docx 为 null） */
  pageCount: number | null
  charCount: number
  addedAt: string
  status: 'ok' | 'error'
  error?: string
}

export interface MaterialDetail {
  meta: MaterialMeta
  /** 抽取的全文（预览用） */
  text: string
}

/* ---------- 语音（M3） ---------- */

export interface AsrStatus {
  /** 识别引擎（venv + faster-whisper）是否就绪 */
  engineReady: boolean
  /** whisper 模型是否已下载完整 */
  modelReady: boolean
  modelName: string
  /** 模型目录 */
  modelDir: string
  /** 模型总大小（字节） */
  modelTotalBytes: number
  /** 已下载字节 */
  modelDownloadedBytes: number
}

export type AsrProgressPhase = 'venv' | 'pip' | 'download' | 'verify'

export interface AsrProgress {
  phase: AsrProgressPhase
  message: string
  /** 下载用：已下载 / 总字节 */
  done: number
  total: number
  /** 瞬时速度 B/s */
  speedBps: number
}

export interface TranscribeResult {
  ok: boolean
  text: string
  language: string | null
  duration: number
  error?: string
}

export interface SpeakResult {
  ok: boolean
  /** base64 编码的 mp3 */
  base64: string
  mime: string
  error?: string
}
