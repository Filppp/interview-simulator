import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { loadSettings, saveSettings, dataRoot } from './store'
import { getMicStatus, requestMicPermission } from './mic'
import { testApiKey } from './llm'
import { ensureIndex, listMaterials, addMaterials, removeMaterial, getMaterialDetail } from './materials'
import type { AppInfo, InterviewSettings, MaterialCategory, MaterialDetail, MaterialMeta } from '../shared/types'

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

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

  /* ---------- 资料库 ---------- */

  ipcMain.handle('materials:list', (_e, category?: MaterialCategory) => listMaterials(category))

  ipcMain.handle(
    'materials:add',
    (_e, filePaths: string[], category: MaterialCategory): Promise<MaterialMeta[]> =>
      addMaterials(filePaths, category)
  )

  // 弹出系统文件选择框后导入
  ipcMain.handle('materials:pickAndAdd', async (_e, category: MaterialCategory) => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择要导入的资料文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '资料文件', extensions: ['pdf', 'docx'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word', extensions: ['docx'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return addMaterials(result.filePaths, category)
  })

  ipcMain.handle('materials:remove', (_e, id: string) => removeMaterial(id))

  ipcMain.handle('materials:preview', (_e, id: string): Promise<MaterialDetail | null> =>
    getMaterialDetail(id)
  )

  // 首次启动时若索引缺失则扫描重建
  void ensureIndex()
}
