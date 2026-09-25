import { useState } from 'react';
import { Page } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const INTEGRATION_ITEMS: { label: string; page: Page }[] = [
  { label: 'verifyuser',   page: 'config-verifyuser'   },
  { label: 'authorize',    page: 'config-authorize'    },
  { label: 'transfer',     page: 'config-transfer'     },
  { label: 'cancel',       page: 'config-cancel'       },
  { label: 'notification', page: 'config-notification' },
  { label: 'lookupuser',   page: 'config-lookupuser'   },
  { label: 'signin',       page: 'config-signin'       },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [integrationOpen, setIntegrationOpen] = useState(true);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-label">PIQ</span>
        <span className="sidebar-brand-name">Lab</span>
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <button
            className="sidebar-section-header"
            onClick={() => setIntegrationOpen(o => !o)}
          >
            <span className={`sidebar-chevron ${integrationOpen ? 'open' : ''}`}>›</span>
            Integration API
          </button>
          {integrationOpen && (
            <div className="sidebar-section-items">
              {INTEGRATION_ITEMS.map(({ label, page }) => (
                <button
                  key={page}
                  className={`sidebar-item ${currentPage === page ? 'active' : ''}`}
                  onClick={() => onNavigate(page)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <button
            className={`sidebar-item ${currentPage === 'logs' ? 'active' : ''}`}
            onClick={() => onNavigate('logs')}
          >
            Logs
          </button>
        </div>
      </nav>
    </aside>
  );
}
