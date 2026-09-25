import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import EndpointConfigPage from './pages/EndpointConfigPage';
import AllLogsPage from './pages/AllLogsPage';
import { Page } from './types';
import { useConfirmDialog } from './hooks/useConfirmDialog';

export default function App() {
  const [page, setPage] = useState<Page>('config-verifyuser');
  const [isDirty, setIsDirty] = useState(false);
  const { confirm, dialogEl } = useConfirmDialog();

  const handleNavigate = useCallback(async (next: Page) => {
    if (isDirty) {
      const ok = await confirm({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Leave without saving?',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      });
      if (!ok) return;
    }
    setIsDirty(false);
    setPage(next);
  }, [isDirty, confirm]);

  function renderPage() {
    switch (page) {
      case 'config-verifyuser':   return <EndpointConfigPage endpoint="verifyuser" nestedField={['attributes']} onDirtyChange={setIsDirty} />;
      case 'config-authorize':    return <EndpointConfigPage endpoint="authorize" nestedField={['updatedUser', 'attributes']} onDirtyChange={setIsDirty} />;
      case 'config-transfer':     return <EndpointConfigPage endpoint="transfer" onDirtyChange={setIsDirty} />;
      case 'config-cancel':       return <EndpointConfigPage endpoint="cancel" onDirtyChange={setIsDirty} />;
      case 'config-notification': return <EndpointConfigPage endpoint="notification" onDirtyChange={setIsDirty} />;
      case 'config-lookupuser':   return <EndpointConfigPage endpoint="lookupuser" nestedField={['attributes']} onDirtyChange={setIsDirty} />;
      case 'config-signin':       return <EndpointConfigPage endpoint="signin" onDirtyChange={setIsDirty} />;
      case 'logs':                return <AllLogsPage />;
    }
  }

  return (
    <div className="app-layout">
      <Sidebar currentPage={page} onNavigate={handleNavigate} />
      <main className={`app-main${dialogEl ? ' app-blurred' : ''}`}>
        {renderPage()}
      </main>
      {dialogEl}
    </div>
  );
}
