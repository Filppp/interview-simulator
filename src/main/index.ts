import { app, shell, BrowserWindow } from 'electron'
import path from 'node:path'
import { ensureDataDirs } from './store'
import { registerIpc } from './ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1000,
    minHeight: 680,
    title: '面试模拟器',
    show: false,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  // 外部链接一律用系统浏览器打开
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  ensureDataDirs()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
