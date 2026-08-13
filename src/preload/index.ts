import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo, InterviewSettings, MicStatus, ApiTestResult } from '../shared/types'

const api = {
  getSettings: (): Promise<InterviewSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (partial: Partial<InterviewSettings>): Promise<InterviewSettings> =>
    ipcRenderer.invoke('settings:set', partial),
  testApiKey: (keyOverride?: string): Promise<ApiTestResult> => ipcRenderer.invoke('settings:testApi', keyOverride),
  getMicStatus: (): Promise<MicStatus> => ipcRenderer.invoke('mic:status'),
  requestMic: (): Promise<MicStatus> => ipcRenderer.invoke('mic:request'),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('api', api)
