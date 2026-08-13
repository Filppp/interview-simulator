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
