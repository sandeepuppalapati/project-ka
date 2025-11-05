import './TabBar.css';
import { FileText, X } from 'lucide-react';

interface Tab {
  id: string;
  path: string;
  name: string;
  isDirty: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onCloseAll?: () => void;
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onCloseAll }: TabBarProps) {
  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };

  const handleCloseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCloseAll) {
      onCloseAll();
    }
  };

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onTabClick(tab.id)}
          >
            <span className="tab-icon"><FileText size={14} /></span>
            <span className="tab-name">{tab.name}</span>
            {tab.isDirty && <span className="tab-dirty">●</span>}
            <button
              className="tab-close"
              onClick={(e) => handleClose(e, tab.id)}
              title="Close (Cmd+W)"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {tabs.length > 1 && onCloseAll && (
        <button
          className="close-all-btn"
          onClick={handleCloseAll}
          title="Close all tabs"
        >
          <X size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
          Close All
        </button>
      )}
    </div>
  );
}
