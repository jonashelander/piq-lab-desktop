import { useState, useEffect, useRef } from 'react';
import { ConfigRecord, EndpointSet } from '../types';
import { fetchSets, createSet, updateSet, activateSet, deleteSet } from '../api';

interface Props {
  endpoint: string;
  config: ConfigRecord[];
  isDirty: boolean;
  onConfigChange: (config: ConfigRecord[]) => void;
  onSaved: (config: ConfigRecord[]) => void;
  confirmSwitch: () => Promise<boolean>;
}

export default function ResponseSetBar({ endpoint, config, isDirty, onConfigChange, onSaved, confirmSwitch }: Props) {
  const [sets, setSets] = useState<EndpointSet[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'created' | 'deleted' | 'error'>('idle');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load sets on mount / endpoint change, then activate the first one
  useEffect(() => {
    fetchSets(endpoint)
      .then(loaded => {
        setSets(loaded);
        setRenaming(false);
        const first = loaded.find(s => s.id === 'initial') ?? loaded[0];
        if (first) {
          setSelectedId(first.id);
          onConfigChange(JSON.parse(JSON.stringify(first.config)));
          activateSet(endpoint, first.id).catch(console.error);
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  function getSet(id: string): EndpointSet | undefined {
    return sets.find(s => s.id === id);
  }

  function flash(s: 'saved' | 'created' | 'deleted' | 'error') {
    setStatus(s);
    setTimeout(() => setStatus('idle'), 2500);
  }

  async function handleSelect(id: string) {
    if (id === selectedId || busy) return;
    if (!(await confirmSwitch())) return;
    const set = getSet(id);
    if (!set) return;
    setSelectedId(id);
    setRenaming(false);
    onConfigChange(JSON.parse(JSON.stringify(set.config)));
    activateSet(endpoint, id).catch(console.error);
  }

  function handleStartRename() {
    const set = getSet(selectedId);
    if (!set) return;
    setRenameInput(set.name);
    setRenaming(true);
  }

  function handleCancelRename() {
    setRenaming(false);
    setRenameInput('');
  }

  async function handleSave() {
    if (busy) return;
    const set = getSet(selectedId);
    if (!set) return;
    const name = renaming ? renameInput.trim() : set.name;
    if (!name) return;
    setBusy(true);
    try {
      const updated = await updateSet(endpoint, selectedId, name, config);
      setSets(prev => prev.map(s => s.id === updated.id ? { ...s, name: updated.name, config: updated.config } : s));
      setRenaming(false);
      onSaved(config);
      flash('saved');
    } catch {
      flash('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleNew() {
    if (busy || config.length === 0) return;
    setBusy(true);
    try {
      const name = `New set ${sets.length + 1}`;
      const created = await createSet(endpoint, name, config);
      setSets(prev => [...prev, created]);
      setSelectedId(created.id);
      setRenaming(false);
      onSaved(config);
      flash('created');
    } catch {
      flash('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy || !selectedId || selectedId === 'initial') return;
    setBusy(true);
    try {
      await deleteSet(endpoint, selectedId);
      const remaining = sets.filter(s => s.id !== selectedId);
      setSets(remaining);
      const fallback = remaining.find(s => s.id === 'initial') ?? remaining[0];
      setSelectedId(fallback.id);
      setRenaming(false);
      onConfigChange(JSON.parse(JSON.stringify(fallback.config)));
      activateSet(endpoint, fallback.id).catch(console.error);
      flash('deleted');
    } catch {
      flash('error');
    } finally {
      setBusy(false);
    }
  }

  const currentSet = getSet(selectedId);
  const isInitial = selectedId === 'initial';

  return (
    <div className="response-set-bar">
      <div className="response-set-bar-inner">
        <span className="response-set-label">Response set</span>

        {renaming ? (
          <input
            ref={renameInputRef}
            className="response-set-name-input"
            value={renameInput}
            onChange={e => setRenameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancelRename();
            }}
            disabled={busy}
          />
        ) : (
          <select
            className="response-set-select"
            value={selectedId}
            onChange={e => handleSelect(e.target.value)}
            disabled={busy}
          >
            {sets.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        <button
          className="btn-icon"
          onClick={renaming ? handleCancelRename : handleStartRename}
          title={renaming ? 'Cancel rename' : 'Rename this set'}
          disabled={busy || !currentSet}
        >
          {renaming ? '✕' : '✏'}
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={busy || !currentSet || (renaming && !renameInput.trim())}
        >
          {busy ? '…' : 'Save'}
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleNew}
          disabled={busy}
        >
          New
        </button>

        <button
          className="btn btn-danger btn-sm"
          onClick={handleDelete}
          disabled={busy || isInitial || !currentSet}
          title={isInitial ? 'The Initial set cannot be deleted' : 'Delete this set'}
        >
          Delete
        </button>

        {isDirty && <span className="unsaved-indicator">● Unsaved changes</span>}
        {status === 'saved'   && <span className="save-status success">Saved</span>}
        {status === 'created' && <span className="save-status success">Created</span>}
        {status === 'deleted' && <span className="save-status success">Deleted</span>}
        {status === 'error'   && <span className="save-status error">Error</span>}
      </div>
    </div>
  );
}
