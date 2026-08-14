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
  SpeakResult,
  SchoolProfile,
  AskPayload,
  SessionToReport,
  InterviewReport,
  HistorySummary
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
      listSchools(): Promise<SchoolProfile[]>
      saveSchool(input: { id?: string; name: string; target: string; notes: string[] }): Promise<SchoolProfile>
      removeSchool(id: string): Promise<void>
      pickAndImportSchoolFiles(schoolId: string): Promise<SchoolProfile | null>
      askInterviewer(payload: AskPayload): Promise<string>
      getSchoolNotes(schoolId: string): Promise<string>
      generateReport(session: SessionToReport): Promise<InterviewReport>
      listHistory(): Promise<HistorySummary[]>
      getHistoryRecord(id: string): Promise<InterviewReport | null>
      removeHistoryRecord(id: string): Promise<void>
      exportReportMarkdown(id: string): Promise<{ ok: boolean; filePath?: string; message?: string }>
    }
  }
}

export {}
