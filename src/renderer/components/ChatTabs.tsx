import { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import './ChatTabs.css';

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

export function ChatTabs({ repos, currentFile, activeTabId: controlledActiveTabId, onTabChange }: ChatTabsProps) {
  const [internalActiveTabId, setInternalActiveTabId] = useState<string>('bridge');

  // Use controlled or internal state
  const activeTabId = controlledActiveTabId !== undefined ? controlledActiveTabId : internalActiveTabId;
  const setActiveTabId = onTabChange || setInternalActiveTabId;

  // Build tabs: Bridge first, then one per repo
  const tabs: ChatTab[] = [
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
      icon: '📁',
      repoId: repo.id,
      repo,
    })),
  ];

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

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
            <span className="tab-icon">{tab.icon}</span>
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
}
