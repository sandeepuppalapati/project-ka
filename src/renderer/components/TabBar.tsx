import './TabBar.css';

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
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose }: TabBarProps) {
  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onTabClick(tab.id)}
        >
          <span className="tab-icon">📄</span>
          <span className="tab-name">{tab.name}</span>
          {tab.isDirty && <span className="tab-dirty">●</span>}
          <button
            className="tab-close"
            onClick={(e) => handleClose(e, tab.id)}
            title="Close (Cmd+W)"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
