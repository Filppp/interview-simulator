import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppInfo,
  InterviewSettings,
  MicStatus,
  ApiTestResult,
  MaterialCategory,
  MaterialDetail,
  MaterialMeta
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
    ipcRenderer.invoke('materials:preview', id)
}

contextBridge.exposeInMainWorld('api', api)
