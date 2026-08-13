import { app, ipcMain } from 'electron'
import { loadSettings, saveSettings, dataRoot } from './store'
import { getMicStatus, requestMicPermission } from './mic'
import { testApiKey } from './llm'
import type { AppInfo, InterviewSettings } from '../shared/types'

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings())

  ipcMain.handle('settings:set', (_e, partial: Partial<InterviewSettings>) => saveSettings(partial))

  ipcMain.handle('settings:testApi', (_e, keyOverride?: string) => testApiKey(keyOverride))

  ipcMain.handle('mic:status', () => getMicStatus())

  ipcMain.handle('mic:request', () => requestMicPermission())

  ipcMain.handle('app:info', (): AppInfo => {
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron ?? '',
      chromeVersion: process.versions.chrome ?? '',
      nodeVersion: process.versions.node ?? '',
      platform: process.platform,
      arch: process.arch,
      userData: app.getPath('userData'),
      dataDir: dataRoot()
    }
  })
}
