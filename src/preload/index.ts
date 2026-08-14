import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppInfo,
  InterviewSettings,
  MicStatus,
  ApiTestResult,
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
} from '../shared/types'

const api = {
  getSettings: (): Promise<InterviewSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (partial: Partial<InterviewSettings>): Promise<InterviewSettings> =>
    ipcRenderer.invoke('settings:set', partial),
  testApiKey: (keyOverride?: string): Promise<ApiTestResult> => ipcRenderer.invoke('settings:testApi', keyOverride),
  getMicStatus: (): Promise<MicStatus> => ipcRenderer.invoke('mic:status'),
  requestMic: (): Promise<MicStatus> => ipcRenderer.invoke('mic:request'),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  listMaterials: (category?: MaterialCategory): Promise<MaterialMeta[]> =>
    ipcRenderer.invoke('materials:list', category),
  addMaterials: (filePaths: string[], category: MaterialCategory): Promise<MaterialMeta[]> =>
    ipcRenderer.invoke('materials:add', filePaths, category),
  pickAndAddMaterials: (category: MaterialCategory): Promise<MaterialMeta[]> =>
    ipcRenderer.invoke('materials:pickAndAdd', category),
  removeMaterial: (id: string): Promise<void> => ipcRenderer.invoke('materials:remove', id),
  previewMaterial: (id: string): Promise<MaterialDetail | null> =>
    ipcRenderer.invoke('materials:preview', id),

  getAsrStatus: (): Promise<AsrStatus> => ipcRenderer.invoke('asr:status'),
  setupAsr: (): Promise<AsrStatus> => ipcRenderer.invoke('asr:setup'),
  downloadAsrModel: (): Promise<AsrStatus> => ipcRenderer.invoke('asr:downloadModel'),
  cancelAsrDownload: (): Promise<void> => ipcRenderer.invoke('asr:cancelDownload'),
  transcribeAudio: (webmBase64: string, language?: string): Promise<TranscribeResult> =>
    ipcRenderer.invoke('audio:transcribe', webmBase64, language),
  speakTts: (text: string, voice: string, rate: number): Promise<SpeakResult> =>
    ipcRenderer.invoke('tts:speak', text, voice, rate),
  onAsrProgress: (cb: (p: AsrProgress) => void): (() => void) => {
    const listener = (_e: unknown, p: AsrProgress): void => cb(p)
    ipcRenderer.on('asr:progress', listener)
    return () => {
      ipcRenderer.removeListener('asr:progress', listener)
    }
  },

  listSchools: (): Promise<SchoolProfile[]> => ipcRenderer.invoke('schools:list'),
  saveSchool: (input: { id?: string; name: string; target: string; notes: string[] }): Promise<SchoolProfile> =>
    ipcRenderer.invoke('schools:save', input),
  removeSchool: (id: string): Promise<void> => ipcRenderer.invoke('schools:remove', id),
  pickAndImportSchoolFiles: (schoolId: string): Promise<SchoolProfile | null> =>
    ipcRenderer.invoke('schools:pickAndImport', schoolId),

  askInterviewer: (payload: AskPayload): Promise<string> => ipcRenderer.invoke('interview:ask', payload),
  getSchoolNotes: (schoolId: string): Promise<string> => ipcRenderer.invoke('interview:schoolNotes', schoolId),

  generateReport: (session: SessionToReport): Promise<InterviewReport> =>
    ipcRenderer.invoke('report:generate', session),
  listHistory: (): Promise<HistorySummary[]> => ipcRenderer.invoke('history:list'),
  getHistoryRecord: (id: string): Promise<InterviewReport | null> =>
    ipcRenderer.invoke('history:get', id),
  removeHistoryRecord: (id: string): Promise<void> => ipcRenderer.invoke('history:remove', id),
  exportReportMarkdown: (id: string): Promise<{ ok: boolean; filePath?: string; message?: string }> =>
    ipcRenderer.invoke('report:exportMarkdown', id),
  generateReferenceAnswers: (id: string): Promise<{ ok: boolean; markdown?: string; message?: string }> =>
    ipcRenderer.invoke('report:generateReferenceAnswers', id),
  exportAnswers: (id: string): Promise<{ ok: boolean; filePath?: string; message?: string }> =>
    ipcRenderer.invoke('report:exportAnswers', id)
}

contextBridge.exposeInMainWorld('api', api)
