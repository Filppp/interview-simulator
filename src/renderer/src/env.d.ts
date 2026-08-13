/// <reference types="vite/client" />
import type {
  AppInfo,
  ApiTestResult,
  InterviewSettings,
  MicStatus,
  MaterialCategory,
  MaterialDetail,
  MaterialMeta,
  AsrStatus,
  AsrProgress,
  TranscribeResult,
  SpeakResult
} from '../../shared/types'

declare global {
  interface Window {
    api: {
      getSettings(): Promise<InterviewSettings>
      saveSettings(partial: Partial<InterviewSettings>): Promise<InterviewSettings>
      testApiKey(keyOverride?: string): Promise<ApiTestResult>
      getMicStatus(): Promise<MicStatus>
      requestMic(): Promise<MicStatus>
      getAppInfo(): Promise<AppInfo>
      listMaterials(category?: MaterialCategory): Promise<MaterialMeta[]>
      addMaterials(filePaths: string[], category: MaterialCategory): Promise<MaterialMeta[]>
      pickAndAddMaterials(category: MaterialCategory): Promise<MaterialMeta[]>
      removeMaterial(id: string): Promise<void>
      previewMaterial(id: string): Promise<MaterialDetail | null>
      getAsrStatus(): Promise<AsrStatus>
      setupAsr(): Promise<AsrStatus>
      downloadAsrModel(): Promise<AsrStatus>
      cancelAsrDownload(): Promise<void>
      transcribeAudio(webmBase64: string, language?: string): Promise<TranscribeResult>
      speakTts(text: string, voice: string, rate: number): Promise<SpeakResult>
      onAsrProgress(cb: (p: AsrProgress) => void): () => void
    }
  }
}

export {}
