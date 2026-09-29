import { useState, useEffect } from 'react'
import {
  NgrokStatus, getNgrokStatus, getSavedNgrokToken, getSavedNgrokDomain,
  saveNgrokDomain, ngrokSaveAndConnect, ngrokRetry, ngrokResetToken, onNgrokStatus,
} from '../api'

export default function NgrokPage() {
  const [status, setStatus] = useState<NgrokStatus>({ status: 'idle', url: null, error: null })
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [domain, setDomain] = useState('')
  const [domainSaved, setDomainSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getNgrokStatus().then(setStatus)
    getSavedNgrokToken().then(t => setHasToken(!!t))
    getSavedNgrokDomain().then(d => setDomain(d ?? ''))
    const unsub = onNgrokStatus(s => setStatus(s))
    return unsub
  }, [])

  async function handleConnect() {
    if (!tokenInput.trim()) return
    setBusy(true)
    if (domain.trim()) await saveNgrokDomain(domain.trim())
    await ngrokSaveAndConnect(tokenInput.trim())
    setHasToken(true)
    setBusy(false)
  }

  async function handleSaveDomain() {
    setBusy(true)
    await saveNgrokDomain(domain.trim())
    await ngrokRetry()
    setDomainSaved(true)
    setBusy(false)
    setTimeout(() => setDomainSaved(false), 2000)
  }

  async function handleRetry() {
    setBusy(true)
    await ngrokRetry()
    setBusy(false)
  }

  async function handleReset() {
    setBusy(true)
    await ngrokResetToken()
    setHasToken(false)
    setTokenInput('')
    setBusy(false)
  }

  function handleCopy() {
    if (!status.url) return
    navigator.clipboard.writeText(status.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const statusLabel =
    status.status === 'connected'  ? 'Connected' :
    status.status === 'connecting' ? 'Connecting…' :
    status.status === 'error'      ? 'Error' : 'Idle'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">URL Setup</h1>
          <p className="page-subtitle">
            Expose your local integration API to PaymentIQ via a public URL.
          </p>
        </div>
      </div>

      {hasToken && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Tunnel Status</h2>
            <div className="ngrok-status-badge">
              <span className={`ngrok-dot ${status.status}`} />
              <span>{statusLabel}</span>
            </div>
          </div>
          <div className="card-body ngrok-card-body">
            {status.status === 'connected' && status.url && (
              <div className="ngrok-url-row">
                <span className="ngrok-url">{status.url}</span>
                <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
            {status.status === 'connecting' && (
              <p className="ngrok-hint">Starting tunnel…</p>
            )}
            {status.status === 'error' && (
              <p className="ngrok-error">{status.error}</p>
            )}

            <div className="ngrok-domain-row">
              <label className="ngrok-domain-label">Static domain <span className="ngrok-optional">(optional)</span></label>
              <p className="ngrok-hint">
                Without a static domain, ngrok assigns a new random URL every time the app starts — meaning you'd have to update the integration URL in PaymentIQ on every restart. A static domain gives you a permanent URL you only need to set once in PaymentIQ.
              </p>
              <ol className="ngrok-steps">
                <li>In your ngrok dashboard, go to <strong>Domains</strong>.</li>
                <li>Copy the value in the <strong>Domain</strong> column (e.g. <code>heartily-meet-leopard.ngrok-free.app</code>).</li>
                <li>Paste it below and click Save — the tunnel will reconnect automatically with the new domain.</li>
              </ol>
              <div className="ngrok-input-row">
                <input
                  className="field-input"
                  type="text"
                  placeholder="your-name.ngrok-free.app"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveDomain()}
                  disabled={busy}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSaveDomain}
                  disabled={busy}
                >
                  {domainSaved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>

            <div className="ngrok-actions">
              {(status.status === 'error' || status.status === 'idle') && (
                <button className="btn btn-primary btn-sm" onClick={handleRetry} disabled={busy}>
                  {busy ? '…' : 'Retry'}
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={handleReset} disabled={busy}>
                Reset token
              </button>
            </div>
          </div>
        </div>
      )}

      {status.status === 'connected' && status.url && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Configure PaymentIQ</h2>
          </div>
          <div className="card-body ngrok-card-body">
            <p className="ngrok-hint">In PaymentIQ Backoffice, go to <strong>Admin → MerchantConfig</strong> and set:</p>
            <ol className="ngrok-steps">
              <li><code>apiIntegrationUrl</code> → the URL above</li>
              <li><code>integrationService</code> → <code>standardMerchantIntegrationService</code></li>
            </ol>
          </div>
        </div>
      )}

      {hasToken === false && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Connect ngrok</h2>
          </div>
          <div className="card-body ngrok-card-body">
            <div className="ngrok-domain-row">
              <label className="ngrok-domain-label">Authtoken</label>
              <ol className="ngrok-steps">
                <li>Go to <strong>ngrok.com</strong> and create a free account.</li>
                <li>In your dashboard, go to <strong>Your Authtoken</strong>.</li>
                <li>Copy the token and paste it below.</li>
              </ol>
              <div className="ngrok-input-row">
                <input
                  className="field-input"
                  type="password"
                  placeholder="Paste your ngrok authtoken"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="ngrok-domain-row">
              <label className="ngrok-domain-label">Static domain <span className="ngrok-optional">(optional)</span></label>
              <p className="ngrok-hint">
                Each time the app starts, ngrok assigns a new random public URL. This means you would have to update the integration URL in PaymentIQ on every restart. By reserving a static domain, you always get the same URL — set it once in PaymentIQ and never touch it again.
              </p>
              <ol className="ngrok-steps">
                <li>In your ngrok dashboard, go to <strong>Domains</strong>.</li>
                <li>Copy the value in the <strong>Domain</strong> column (e.g. <code>heartily-meet-leopard.ngrok-free.app</code>).</li>
                <li>Paste it below.</li>
              </ol>
              <input
                className="field-input"
                type="text"
                placeholder="your-name.ngrok-free.app"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="ngrok-actions">
              <button
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={busy || !tokenInput.trim()}
              >
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
