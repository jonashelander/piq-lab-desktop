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
})
