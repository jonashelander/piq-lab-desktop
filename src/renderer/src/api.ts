import { ConfigRecord, EndpointSet, LogEntry } from './types'

declare global {
  interface Window {
    api: {
      getConfig:   (endpoint: string) => Promise<ConfigRecord[]>
      setConfig:   (endpoint: string, config: ConfigRecord[]) => Promise<ConfigRecord[]>
      getSets:     (endpoint: string) => Promise<EndpointSet[]>
      createSet:   (endpoint: string, name: string, config: ConfigRecord[]) => Promise<EndpointSet>
      updateSet:   (endpoint: string, id: string, name: string, config: ConfigRecord[]) => Promise<EndpointSet>
      activateSet: (endpoint: string, id: string) => Promise<EndpointSet>
      deleteSet:   (endpoint: string, id: string) => Promise<void>
      getLogs:     () => Promise<LogEntry[]>
      clearLogs:   () => Promise<void>
    }
  }
}

export const fetchConfigFor  = (endpoint: string): Promise<ConfigRecord[]> =>
  window.api.getConfig(endpoint)

export const saveConfigFor   = (endpoint: string, config: ConfigRecord[]): Promise<ConfigRecord[]> =>
  window.api.setConfig(endpoint, config)

export const fetchAllLogs    = (): Promise<LogEntry[]> =>
  window.api.getLogs()

export const clearAllLogs    = (): Promise<void> =>
  window.api.clearLogs()

export const fetchSets       = (endpoint: string): Promise<EndpointSet[]> =>
  window.api.getSets(endpoint)

export const createSet       = (endpoint: string, name: string, config: ConfigRecord[]): Promise<EndpointSet> =>
  window.api.createSet(endpoint, name, config)

export const updateSet       = (endpoint: string, id: string, name: string, config: ConfigRecord[]): Promise<EndpointSet> =>
  window.api.updateSet(endpoint, id, name, config)

export const activateSet     = (endpoint: string, id: string): Promise<EndpointSet> =>
  window.api.activateSet(endpoint, id)

export const deleteSet       = (endpoint: string, id: string): Promise<void> =>
  window.api.deleteSet(endpoint, id)

export const fetchConfig     = () => fetchConfigFor('verifyuser')
export const saveConfig      = (config: ConfigRecord[]) => saveConfigFor('verifyuser', config)
