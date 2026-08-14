import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { loadSettings, saveSettings, dataRoot } from './store'
import { getMicStatus, requestMicPermission } from './mic'
import { testApiKey } from './llm'
import { ensureIndex, listMaterials, addMaterials, removeMaterial, getMaterialDetail } from './materials'
import { getAsrStatus, setupEngine, downloadModel, cancelModelDownload, transcribeAudio } from './asr'
import { synthesize } from './tts'
import { listSchools, saveSchool, removeSchool, importSchoolFiles, getSchoolNotes } from './schools'
import { askInterviewer } from './interview'
import { listHistory, getRecord, removeRecord, createReport, buildMarkdown, buildAnswersMarkdown, saveReferenceAnswers } from './history'
import { generateReferenceAnswers } from './report'
import type {
  AppInfo,
  AsrProgress,
  AskPayload,
  InterviewSettings,
  MaterialCategory,
  MaterialDetail,
  MaterialMeta,
  SpeakResult,
  SessionToReport,
  TranscribeResult
} from '../shared/types'

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

/** 向所有窗口广播进度事件 */
function sendProgress(p: AsrProgress): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('asr:progress', p)
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

  /* ---------- 语音（M3） ---------- */

  ipcMain.handle('asr:status', () => getAsrStatus())

  ipcMain.handle('asr:setup', async () => {
    await setupEngine(sendProgress)
    return getAsrStatus()
  })

  ipcMain.handle('asr:downloadModel', async () => {
    await downloadModel(sendProgress)
    return getAsrStatus()
  })

  ipcMain.handle('asr:cancelDownload', () => cancelModelDownload())

  ipcMain.handle(
    'audio:transcribe',
    (_e, webmBase64: string, language?: string): Promise<TranscribeResult> =>
      transcribeAudio(webmBase64, language)
  )

  ipcMain.handle(
    'tts:speak',
    (_e, text: string, voice: string, rate: number): Promise<SpeakResult> =>
      synthesize(text, voice, rate)
  )

  /* ---------- 学校风格库（M4） ---------- */

  ipcMain.handle('schools:list', () => listSchools())

  ipcMain.handle('schools:save', (_e, input: { id?: string; name: string; target: string; notes: string[] }) =>
    saveSchool(input))

  ipcMain.handle('schools:remove', (_e, id: string) => removeSchool(id))

  // 弹出文件选择框导入学校风格资料
  ipcMain.handle('schools:pickAndImport', async (_e, schoolId: string) => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择风格资料文件（PDF/Word/TXT）',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文档', extensions: ['pdf', 'docx', 'txt', 'md'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return importSchoolFiles(schoolId, result.filePaths)
  })

  /* ---------- 面试（M4） ---------- */

  ipcMain.handle('interview:ask', (_e, payload: AskPayload) => askInterviewer(payload))

  ipcMain.handle('interview:schoolNotes', (_e, schoolId: string) => getSchoolNotes(schoolId))

  /* ---------- 评分报告与历史（M5） ---------- */

  ipcMain.handle('report:generate', (_e, session: SessionToReport) => createReport(session))

  ipcMain.handle('history:list', () => listHistory())

  ipcMain.handle('history:get', (_e, id: string) => getRecord(id))

  ipcMain.handle('history:remove', (_e, id: string) => removeRecord(id))

  // 导出 Markdown：弹保存对话框
  ipcMain.handle('report:exportMarkdown', async (_e, id: string) => {
    const rec = await getRecord(id)
    if (!rec) return { ok: false, message: '记录不存在' }
    const win = getWindow()
    const stamp = new Date(rec.startedAt).toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(win!, {
      title: '导出评分报告',
      defaultPath: `面试评分报告-${stamp}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, message: '已取消' }
    await (await import('node:fs')).promises.writeFile(result.filePath, buildMarkdown(rec), 'utf-8')
    return { ok: true, filePath: result.filePath }
  })

  // 生成参考答案（面试后复盘用）
  ipcMain.handle('report:generateReferenceAnswers', async (_e, id: string) => {
    const rec = await getRecord(id)
    if (!rec) return { ok: false, message: '记录不存在' }
    const md = await generateReferenceAnswers(rec)
    await saveReferenceAnswers(id, md)
    return { ok: true, markdown: md }
  })

  // 导出「我的回答汇总」
  ipcMain.handle('report:exportAnswers', async (_e, id: string) => {
    const rec = await getRecord(id)
    if (!rec) return { ok: false, message: '记录不存在' }
    const win = getWindow()
    const stamp = new Date(rec.startedAt).toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(win!, {
      title: '导出我的回答汇总',
      defaultPath: `我的面试回答-${stamp}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, message: '已取消' }
    await (await import('node:fs')).promises.writeFile(result.filePath, buildAnswersMarkdown(rec), 'utf-8')
    return { ok: true, filePath: result.filePath }
  })

  // 首次启动时若索引缺失则扫描重建
  void ensureIndex()
}
