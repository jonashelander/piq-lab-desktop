import { contextBridge, ipcRenderer } from 'electron'
import type { ConfigRecord } from '../main/types'

contextBridge.exposeInMainWorld('api', {
  getConfig:   (endpoint: string) =>
    ipcRenderer.invoke('config:get', endpoint),
  setConfig:   (endpoint: string, config: ConfigRecord[]) =>
    ipcRenderer.invoke('config:set', endpoint, config),
  getSets:     (endpoint: string) =>
    ipcRenderer.invoke('sets:get', endpoint),
  createSet:   (endpoint: string, name: string, config: ConfigRecord[]) =>
    ipcRenderer.invoke('sets:create', endpoint, name, config),
  updateSet:   (endpoint: string, id: string, name: string, config: ConfigRecord[]) =>
    ipcRenderer.invoke('sets:update', endpoint, id, name, config),
  activateSet: (endpoint: string, id: string) =>
    ipcRenderer.invoke('sets:activate', endpoint, id),
  deleteSet:   (endpoint: string, id: string) =>
    ipcRenderer.invoke('sets:delete', endpoint, id),
  getLogs:     () =>
    ipcRenderer.invoke('logs:get'),
  clearLogs:   () =>
    ipcRenderer.invoke('logs:clear'),

  // ── Ngrok ────────────────────────────────────────────────────────────────
  getNgrokStatus:      () =>
    ipcRenderer.invoke('ngrok:getStatus'),
  getSavedToken:       () =>
    ipcRenderer.invoke('ngrok:getSavedToken'),
  getSavedDomain:      () =>
    ipcRenderer.invoke('ngrok:getSavedDomain'),
  saveDomain:          (domain: string) =>
    ipcRenderer.invoke('ngrok:saveDomain', domain),
  ngrokSaveAndConnect: (token: string) =>
    ipcRenderer.invoke('ngrok:saveAndConnect', token),
  ngrokRetry:          () =>
    ipcRenderer.invoke('ngrok:retry'),
  ngrokDisconnect:     () =>
    ipcRenderer.invoke('ngrok:disconnect'),
  ngrokResetToken:     () =>
    ipcRenderer.invoke('ngrok:resetToken'),
  onNgrokStatus:       (cb: (status: unknown) => void) => {
    const handler = (_e: unknown, status: unknown) => cb(status)
    ipcRenderer.on('ngrok:status', handler)
    return () => ipcRenderer.removeListener('ngrok:status', handler)
  },
})
