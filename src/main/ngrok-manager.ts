import fs from 'fs'
import ngrok from '@ngrok/ngrok'

export type NgrokStatus = {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  url: string | null
  error: string | null
}

let configPath = ''
let currentListener: Awaited<ReturnType<typeof ngrok.forward>> | null = null
let statusCallback: ((status: NgrokStatus) => void) | null = null
let currentStatus: NgrokStatus = { status: 'idle', url: null, error: null }

export function setNgrokConfigPath(p: string): void {
  configPath = p
}

export function onNgrokStatusChange(cb: (status: NgrokStatus) => void): void {
  statusCallback = cb
}

function setStatus(s: NgrokStatus): void {
  currentStatus = s
  statusCallback?.(s)
}

export function getNgrokStatus(): NgrokStatus {
  return currentStatus
}

function readConfig(): { token?: string; domain?: string } {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {}
  return {}
}

function writeConfig(data: { token?: string; domain?: string }): void {
  fs.writeFileSync(configPath, JSON.stringify(data), 'utf-8')
}

export function getSavedToken(): string | null {
  const d = readConfig()
  return typeof d.token === 'string' ? d.token : null
}

export function getSavedDomain(): string | null {
  const d = readConfig()
  return typeof d.domain === 'string' && d.domain ? d.domain : null
}

export function saveNgrokToken(token: string): void {
  writeConfig({ ...readConfig(), token })
}

export function saveNgrokDomain(domain: string): void {
  writeConfig({ ...readConfig(), domain: domain.trim() })
}

export function clearNgrokToken(): void {
  const config = readConfig()
  delete config.token
  if (Object.keys(config).length === 0) {
    try { fs.unlinkSync(configPath) } catch {}
  } else {
    writeConfig(config)
  }
}

export async function ngrokConnect(token: string): Promise<void> {
  if (currentListener) {
    try { await ngrok.disconnect() } catch {}
    currentListener = null
  }
  setStatus({ status: 'connecting', url: null, error: null })
  try {
    const domain = getSavedDomain()
    const opts: Parameters<typeof ngrok.forward>[0] = { addr: 3000, authtoken: token }
    if (domain) (opts as Record<string, unknown>).domain = domain
    currentListener = await ngrok.forward(opts)
    setStatus({ status: 'connected', url: currentListener.url() ?? null, error: null })
    const listener = currentListener
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(listener as any).on?.('close', () => {
      if (currentListener === listener) {
        currentListener = null
        setStatus({ status: 'error', url: null, error: 'Tunnel closed unexpectedly' })
      }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    setStatus({ status: 'error', url: null, error: msg })
  }
}

export async function ngrokDisconnect(): Promise<void> {
  try { await ngrok.disconnect() } catch {}
  currentListener = null
  setStatus({ status: 'idle', url: null, error: null })
}

export async function ngrokAutoConnect(): Promise<void> {
  const token = getSavedToken()
  if (token) await ngrokConnect(token)
}
