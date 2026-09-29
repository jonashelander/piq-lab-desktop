import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron'
import { join } from 'path'
import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import { store, setSetsFilePath } from './store'
import { ConfigRecord } from './types'
import {
  setNgrokConfigPath, onNgrokStatusChange, getSavedToken, saveNgrokToken,
  getSavedDomain, saveNgrokDomain,
  clearNgrokToken, getNgrokStatus, ngrokConnect, ngrokDisconnect, ngrokAutoConnect,
} from './ngrok-manager'

const PORT = 3000
const isDev = !app.isPackaged

// ── HTTP server for mock integration endpoints ────────────────────────────────

type ThreeDS2Stored = Record<string, { included: boolean; value: unknown } | Record<string, { included: boolean; value: unknown }>>

function serializeThreeDS2(stored: ThreeDS2Stored): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, fieldOrSection] of Object.entries(stored)) {
    if (
      fieldOrSection !== null &&
      typeof fieldOrSection === 'object' &&
      'included' in fieldOrSection &&
      'value' in fieldOrSection
    ) {
      const f = fieldOrSection as { included: boolean; value: unknown }
      if (f.included) out[key] = f.value
    } else if (fieldOrSection !== null && typeof fieldOrSection === 'object') {
      const sectionOut = serializeThreeDS2(fieldOrSection as ThreeDS2Stored)
      if (Object.keys(sectionOut).length > 0) out[key] = sectionOut
    }
  }
  return out
}

function startHttpServer(): void {
  const expressApp = express()
  expressApp.use(cors())
  expressApp.use(express.json())

  const ENDPOINTS = ['verifyuser', 'authorize', 'transfer', 'cancel', 'notification', 'lookupuser', 'signin'] as const

  for (const endpoint of ENDPOINTS) {
    expressApp.post(`/${endpoint}`, (req, res) => {
      const timestamp = new Date().toISOString()
      const config = store.getConfig(endpoint)
      const sorted = [...config].sort((a, b) => a.order - b.order)
      const responseBody: Record<string, unknown> = {}

      for (const record of sorted) {
        if (record.included) {
          if (record.key === 'threeDS2') {
            responseBody[record.key] = serializeThreeDS2(record.value as ThreeDS2Stored)
          } else {
            responseBody[record.key] = record.value
          }
        }
      }

      const responseStatus = 200
      const responseHeaders: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' }

      store.addLog({
        id: uuidv4(),
        timestamp,
        endpoint,
        method: req.method,
        path: req.path,
        requestHeaders: req.headers as Record<string, string | string[] | undefined>,
        requestBody: req.body,
        responseStatus,
        responseHeaders,
        responseBody,
      })

      res.status(responseStatus).json(responseBody)
    })
  }

  expressApp.listen(PORT, () => {
    console.log(`Mock integration server running on http://localhost:${PORT}`)
  })
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('config:get', (_e, endpoint: string) => store.getConfig(endpoint))

  ipcMain.handle('config:set', (_e, endpoint: string, config: ConfigRecord[]) => {
    store.setConfig(endpoint, config)
    return store.getConfig(endpoint)
  })

  ipcMain.handle('sets:get', (_e, endpoint: string) => store.getSets(endpoint))

  ipcMain.handle('sets:create', (_e, endpoint: string, name: string, config: ConfigRecord[]) =>
    store.addSet(endpoint, name, config))

  ipcMain.handle('sets:update', (_e, endpoint: string, id: string, name: string, config: ConfigRecord[]) => {
    const set = store.saveSet(endpoint, id, name, config)
    if (!set) throw new Error(`Set ${id} not found`)
    return set
  })

  ipcMain.handle('sets:activate', (_e, endpoint: string, id: string) => {
    const set = store.activateSet(endpoint, id)
    if (!set) throw new Error(`Set ${id} not found`)
    return set
  })

  ipcMain.handle('sets:delete', (_e, endpoint: string, id: string) => {
    if (id === 'initial') throw new Error('Cannot delete the Initial set')
    const ok = store.deleteSet(endpoint, id)
    if (!ok) throw new Error(`Set ${id} not found`)
  })

  ipcMain.handle('logs:get', () => [...store.logs])
  ipcMain.handle('logs:clear', () => { store.clearLogs() })

  // ── Ngrok ──────────────────────────────────────────────────────────────────
  ipcMain.handle('ngrok:getStatus', () => getNgrokStatus())
  ipcMain.handle('ngrok:getSavedToken', () => getSavedToken())
  ipcMain.handle('ngrok:getSavedDomain', () => getSavedDomain())
  ipcMain.handle('ngrok:saveDomain', (_e, domain: string) => saveNgrokDomain(domain))

  ipcMain.handle('ngrok:saveAndConnect', async (_e, token: string) => {
    saveNgrokToken(token)
    await ngrokConnect(token)
  })

  ipcMain.handle('ngrok:retry', async () => {
    const token = getSavedToken()
    if (token) await ngrokConnect(token)
  })

  ipcMain.handle('ngrok:disconnect', async () => {
    await ngrokDisconnect()
  })

  ipcMain.handle('ngrok:resetToken', async () => {
    await ngrokDisconnect()
    clearNgrokToken()
  })
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(): void {
  app.setName('PIQ Lab')
  if (isDev) {
    const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.icns'))
    if (!icon.isEmpty()) app.dock?.setIcon(icon)
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'PIQ Lab',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  setSetsFilePath(join(app.getPath('userData'), 'sets.json'))
  setNgrokConfigPath(join(app.getPath('userData'), 'ngrok-config.json'))

  onNgrokStatusChange((status) => {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('ngrok:status', status))
  })

  registerIpcHandlers()
  startHttpServer()
  createWindow()

  ngrokAutoConnect()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
