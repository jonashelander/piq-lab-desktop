import fs from 'fs'
import path from 'path'
import { ConfigRecord, EndpointSet, LogEntry } from './types'
import {
  DEFAULT_VERIFYUSER_CONFIG,
  DEFAULT_AUTHORIZE_CONFIG,
  DEFAULT_TRANSFER_CONFIG,
  DEFAULT_CANCEL_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_LOOKUPUSER_CONFIG,
  DEFAULT_SIGNIN_CONFIG,
} from './defaults'

const ENDPOINTS = ['verifyuser', 'authorize', 'transfer', 'cancel', 'notification', 'lookupuser', 'signin'] as const
type Endpoint = typeof ENDPOINTS[number]

const DEFAULT_CONFIGS: Record<Endpoint, ConfigRecord[]> = {
  verifyuser:   DEFAULT_VERIFYUSER_CONFIG,
  authorize:    DEFAULT_AUTHORIZE_CONFIG,
  transfer:     DEFAULT_TRANSFER_CONFIG,
  cancel:       DEFAULT_CANCEL_CONFIG,
  notification: DEFAULT_NOTIFICATION_CONFIG,
  lookupuser:   DEFAULT_LOOKUPUSER_CONFIG,
  signin:       DEFAULT_SIGNIN_CONFIG,
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function cloneDefaults(defaults: ConfigRecord[]): ConfigRecord[] {
  return defaults.map(r => ({
    ...r,
    value: typeof r.value === 'object' ? deepClone(r.value) : r.value,
  }))
}

type SetsData = Record<Endpoint, EndpointSet[]>

let setsFilePath = path.join(process.cwd(), 'data', 'sets.json')

export function setSetsFilePath(p: string): void {
  setsFilePath = p
}

function loadSetsFromDisk(): SetsData {
  try {
    if (fs.existsSync(setsFilePath)) {
      const raw = fs.readFileSync(setsFilePath, 'utf-8')
      const data = JSON.parse(raw) as SetsData
      for (const ep of ENDPOINTS) {
        if (!data[ep]) data[ep] = []
      }
      return data
    }
  } catch {
    // fall through to defaults
  }
  return buildInitialSets()
}

function buildInitialSets(): SetsData {
  const data = {} as SetsData
  for (const ep of ENDPOINTS) {
    data[ep] = [makeInitialSet(ep)]
  }
  return data
}

function makeInitialSet(ep: Endpoint): EndpointSet {
  return {
    id: 'initial',
    name: 'Initial',
    createdAt: new Date().toISOString(),
    config: cloneDefaults(DEFAULT_CONFIGS[ep]),
  }
}

function saveToDisk(): void {
  try {
    const dir = path.dirname(setsFilePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(setsFilePath, JSON.stringify(store.sets, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to persist sets:', err)
  }
}

const loadedSets = loadSetsFromDisk()

// Migration: ensure every authorize set has an 'attributes' record
for (const set of loadedSets.authorize ?? []) {
  if (!set.config.some(r => r.key === 'attributes')) {
    set.config.push({ key: 'attributes', value: {}, included: true, order: 7 })
  }
}

for (const ep of ENDPOINTS) {
  if (loadedSets[ep].length === 0) {
    loadedSets[ep] = [makeInitialSet(ep)]
  }
}

export const store = {
  verifyuserConfig:   cloneDefaults(DEFAULT_VERIFYUSER_CONFIG),
  authorizeConfig:    cloneDefaults(DEFAULT_AUTHORIZE_CONFIG),
  transferConfig:     cloneDefaults(DEFAULT_TRANSFER_CONFIG),
  cancelConfig:       cloneDefaults(DEFAULT_CANCEL_CONFIG),
  notificationConfig: cloneDefaults(DEFAULT_NOTIFICATION_CONFIG),
  lookupuserConfig:   cloneDefaults(DEFAULT_LOOKUPUSER_CONFIG),
  signinConfig:       cloneDefaults(DEFAULT_SIGNIN_CONFIG),

  logs: [] as LogEntry[],
  sets: loadedSets,

  getConfig(endpoint: string): ConfigRecord[] {
    return (this as Record<string, unknown>)[`${endpoint}Config`] as ConfigRecord[]
  },

  setConfig(endpoint: string, config: ConfigRecord[]): void {
    (this as Record<string, unknown>)[`${endpoint}Config`] = config
  },

  getSets(endpoint: string): EndpointSet[] {
    return this.sets[endpoint as Endpoint] ?? []
  },

  addSet(endpoint: string, name: string, config: ConfigRecord[]): EndpointSet {
    const entry: EndpointSet = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: new Date().toISOString(),
      config: deepClone(config),
    }
    if (!this.sets[endpoint as Endpoint]) {
      this.sets[endpoint as Endpoint] = []
    }
    this.sets[endpoint as Endpoint].push(entry)
    this.setConfig(endpoint, deepClone(config))
    saveToDisk()
    return entry
  },

  saveSet(endpoint: string, id: string, name: string, config: ConfigRecord[]): EndpointSet | null {
    const list = this.sets[endpoint as Endpoint] ?? []
    const set = list.find(s => s.id === id)
    if (!set) return null
    set.name = name
    set.config = deepClone(config)
    this.setConfig(endpoint, deepClone(config))
    saveToDisk()
    return set
  },

  activateSet(endpoint: string, id: string): EndpointSet | null {
    const set = (this.sets[endpoint as Endpoint] ?? []).find(s => s.id === id)
    if (!set) return null
    this.setConfig(endpoint, deepClone(set.config))
    return set
  },

  deleteSet(endpoint: string, id: string): boolean {
    if (id === 'initial') return false
    const list = this.sets[endpoint as Endpoint] ?? []
    const idx = list.findIndex(s => s.id === id)
    if (idx === -1) return false
    list.splice(idx, 1)
    saveToDisk()
    return true
  },

  addLog(entry: LogEntry): void {
    this.logs.push(entry)
  },

  clearLogs(): void {
    this.logs = []
  },
}

for (const ep of ENDPOINTS) {
  const initial = store.sets[ep].find(s => s.id === 'initial')
  if (initial) {
    store.setConfig(ep, deepClone(initial.config))
  }
}
