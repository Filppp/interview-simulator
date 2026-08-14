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
  /** 面试官风格 */
  style: InterviewStyle
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

/* ---------- 面试（M4） ---------- */

export type StylePreset = 'gentle' | 'standard' | 'strict' | 'academic'

export interface InterviewStyle {
  /** 预设模板 */
  preset: StylePreset
  /** 追问深度 1-5 */
  followUpDepth: number
  /** 英语难度 1-5 */
  englishDifficulty: number
  /** 压力程度 1-5 */
  pressureLevel: number
  /** 自由描述（追加指令） */
  customNote: string
}

export interface SchoolProfile {
  id: string
  /** 学校名称 */
  name: string
  /** 报考类型：复试/保研/夏令营 */
  target: string
  /** 手动录入的风格描述 / 真题回忆等 */
  notes: string[]
  /** 导入文件的来源文件名（内容已解析并入 notes） */
  files: string[]
  addedAt: string
}

export type InterviewStage = 'intro' | 'english' | 'major' | 'resume'

export interface ChatMessage {
  role: 'assistant' | 'user'
  content: string
}

export type AskIntent = 'question' | 'answer' | 'hint' | 'skip' | 'introFollowup'

export interface AskPayload {
  stage: InterviewStage
  /** 当前题号（0 起） */
  questionIndex: number
  totalQuestions: number
  intent: AskIntent
  /** 本问题内已作答次数（用于控制追问轮数） */
  answersThisQuestion: number
  history: ChatMessage[]
  /** 本阶段资料片段（已截断） */
  stageContext: string
  style: InterviewStyle
  /** 绑定的学校风格笔记（已截断） */
  schoolNotes: string
  /** 自我介绍原文（resume 阶段提问依据之一） */
  selfIntro?: string
}

export interface InterviewConfig {
  schoolId: string | null
  style: InterviewStyle
  useVoice: boolean
  useEnglishMaterials: boolean
  useMajorMaterials: boolean
  useResume: boolean
}

