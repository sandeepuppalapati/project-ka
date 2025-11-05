import { useState, memo, useMemo, useCallback } from 'react';
import { ChatPanel } from './ChatPanel';
import './ChatTabs.css';
import { Folder } from 'lucide-react';

interface Repository {
  id: string;
  path: string;
  name: string;
}

interface ChatTabsProps {
  repos: Repository[];
  currentFile: { path: string; name: string } | null;
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
}

type TabType = 'bridge' | 'repo';

interface ChatTab {
  id: string;
  type: TabType;
  label: string;
  icon: string;
  repoId?: string;
  repo?: Repository;
}

export const ChatTabs = memo(function ChatTabs({ repos, currentFile, activeTabId: controlledActiveTabId, onTabChange }: ChatTabsProps) {
  const [internalActiveTabId, setInternalActiveTabId] = useState<string>('bridge');

  // Use controlled or internal state
  const activeTabId = controlledActiveTabId !== undefined ? controlledActiveTabId : internalActiveTabId;
  const setActiveTabId = onTabChange || setInternalActiveTabId;

  // Memoize tabs array to prevent recreation on every render
  const tabs: ChatTab[] = useMemo(() => [
    {
      id: 'bridge',
      type: 'bridge',
      label: 'Bridge',
      icon: '🌐',
    },
    ...repos.map(repo => ({
      id: `repo-${repo.id}`,
      type: 'repo' as TabType,
      label: repo.name,
      icon: 'folder',
      repoId: repo.id,
      repo,
    })),
  ], [repos]);

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  return (
    <div className="chat-tabs-container">
      {/* Tab Headers */}
      <div className="chat-tabs-header">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`chat-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
            title={tab.type === 'bridge' ? 'Bridge (Agent coordination)' : `Chat with ${tab.label} agent`}
          >
            <span className="tab-icon">
              {tab.icon === 'folder' ? <Folder size={16} /> : tab.icon}
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Render all Chat Panels but show only active one */}
      <div className="chat-tabs-content">
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
          >
            <ChatPanel
              key={tab.id} // Force unique instance per tab
              currentFile={currentFile}
              currentRepo={tab.repo || null}
              isBridge={tab.type === 'bridge'}
              allRepos={repos}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
