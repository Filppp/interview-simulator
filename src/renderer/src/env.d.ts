/// <reference types="vite/client" />
import type {
  AppInfo,
  ApiTestResult,
  InterviewSettings,
  MicStatus,
  MaterialCategory,
  MaterialDetail,
  MaterialMeta
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
    }
  }
}

export {}
