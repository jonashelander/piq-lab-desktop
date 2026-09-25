import { useState, useEffect, useCallback } from 'react';
import { LogEntry } from '../types';
import { fetchAllLogs, clearAllLogs } from '../api';

function JsonDisplay({ data }: { data: unknown }) {
  return (
    <pre className="json-display">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function LogCard({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const statusClass = `status-${Math.floor(entry.responseStatus / 100)}xx`;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="log-card">
      <div className="log-card-header-row">
        <button
          className="log-card-header"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="log-card-summary">
            <span className="log-method-badge">{entry.method}</span>
            <span className="log-path">{entry.path}</span>
            <span className={`log-status ${statusClass}`}>
              {entry.responseStatus}
            </span>
            <span className="log-timestamp">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <span className={`sidebar-chevron ${expanded ? 'open' : ''}`}>›</span>
        </button>
        <button className="btn btn-ghost log-copy-btn" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {expanded && (
        <div className="log-card-body">
          <p className="log-detail-timestamp">
            {new Date(entry.timestamp).toLocaleString()}
          </p>
          <div className="log-sections">
            <div className="log-section">
              <h4 className="log-section-title">Request Headers</h4>
              <JsonDisplay data={entry.requestHeaders} />
            </div>
            <div className="log-section">
              <h4 className="log-section-title">Request Body</h4>
              <JsonDisplay data={entry.requestBody} />
            </div>
            <div className="log-section">
              <h4 className="log-section-title">Response Headers</h4>
              <JsonDisplay data={entry.responseHeaders} />
            </div>
            <div className="log-section">
              <h4 className="log-section-title">Response Body</h4>
              <JsonDisplay data={entry.responseBody} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AllLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchAllLogs();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setLogs([]);
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  async function handleClear() {
    setClearing(true);
    try {
      await clearAllLogs();
      setLogs([]);
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return <div className="page-loading">Loading logs…</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Logs</h1>
          <p className="page-subtitle">
            All incoming requests and outgoing responses, in handled order.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={loadLogs}>
            Refresh
          </button>
          <button
            className="btn btn-danger"
            onClick={handleClear}
            disabled={clearing || logs.length === 0}
          >
            {clearing ? 'Clearing…' : 'Clear logs'}
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <p className="empty-state-text">No logs yet.</p>
          <p className="empty-state-hint">
            Send a request to any endpoint to see logs here.
            Logs auto-refresh every 5 seconds.
          </p>
        </div>
      ) : (
        <div className="log-list">
          <p className="log-count">{logs.length} request{logs.length !== 1 ? 's' : ''} logged</p>
          {logs.map(entry => (
            <LogCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
