import { useState, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import './App.css'
import { RepoManager } from './components/RepoManager'
import { FileTree } from './components/FileTree'
import { ChatPanel } from './components/ChatPanel'
import { FileViewer } from './components/FileViewer'
import { GitPanel } from './components/GitPanel'
import { TabBar } from './components/TabBar'
import { QuickOpen } from './components/QuickOpen'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

interface Repository {
  id: string;
  path: string;
  name: string;
}

interface Tab {
  id: string;
  path: string;
  name: string;
  isDirty: boolean;
}

function App() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [showRepoManager, setShowRepoManager] = useState(true);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const gitPanelRef = useRef<{ refresh: () => void }>(null);

  const handleReposChanged = (newRepos: Repository[]) => {
    setRepos(newRepos);
    if (newRepos.length > 0) {
      setShowRepoManager(false);
    }
  };

  const handleFileSelect = (filePath: string, fileName: string) => {
    // Check if tab already exists
    const existingTab = tabs.find(tab => tab.path === filePath);

    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      // Create new tab
      const newTab: Tab = {
        id: `tab-${Date.now()}`,
        path: filePath,
        name: fileName,
        isDirty: false
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleTabClose = (tabId: string) => {
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
    }
  };

  const handleFileDirtyChange = (isDirty: boolean) => {
    if (activeTabId) {
      setTabs(tabs.map(tab =>
        tab.id === activeTabId ? { ...tab, isDirty } : tab
      ));
    }
  };

  const handleFileSaved = () => {
    // Refresh git panel when file is saved
    gitPanelRef.current?.refresh();
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const currentFile = activeTab ? { path: activeTab.path, name: activeTab.name } : null;
  const fileViewerRef = useRef<{ save: () => void }>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: () => {
      if (activeTabId) {
        fileViewerRef.current?.save();
      }
    },
    onCloseTab: () => {
      if (activeTabId) {
        handleTabClose(activeTabId);
      }
    },
    onNextTab: () => {
      if (tabs.length > 0 && activeTabId) {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTabId(tabs[nextIndex].id);
      }
    },
    onPrevTab: () => {
      if (tabs.length > 0 && activeTabId) {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTabId(tabs[prevIndex].id);
      }
    },
    onQuickOpen: () => {
      setShowQuickOpen(true);
    },
  });

  return (
    <div className="app">
      {showQuickOpen && (
        <QuickOpen
          repos={repos}
          onFileSelect={handleFileSelect}
          onClose={() => setShowQuickOpen(false)}
        />
      )}
      <header className="app-header">
        <h1>AI IDE</h1>
        <p className="motto">For AI by AI</p>
        {repos.length > 0 && (
          <button
            className="toggle-repos"
            onClick={() => setShowRepoManager(!showRepoManager)}
          >
            {showRepoManager ? 'Hide' : 'Show'} Repos
          </button>
        )}
      </header>

      <main className="app-main">
        {showRepoManager ? (
          <div className="repo-manager-view">
            <RepoManager onReposChange={handleReposChanged} repos={repos} />
          </div>
        ) : (
          <div className="ide-layout">
            <PanelGroup direction="horizontal">
              {/* Sidebar */}
              <Panel defaultSize={20} minSize={15} maxSize={40}>
                <aside className="sidebar">
                  <PanelGroup direction="vertical">
                    {/* Git Panel */}
                    <Panel defaultSize={40} minSize={20} maxSize={60}>
                      <GitPanel
                        ref={gitPanelRef}
                        repos={repos}
                        onFileSelect={handleFileSelect}
                      />
                    </Panel>
                    <PanelResizeHandle className="resize-handle-horizontal" />
                    {/* File Trees */}
                    <Panel minSize={30}>
                      <div className="file-trees-container">
                        {repos.map(repo => (
                          <FileTree
                            key={repo.id}
                            repoPath={repo.path}
                            repoName={repo.name}
                            onFileSelect={handleFileSelect}
                          />
                        ))}
                      </div>
                    </Panel>
                  </PanelGroup>
                </aside>
              </Panel>

              <PanelResizeHandle className="resize-handle-vertical" />

              {/* Main Content */}
              <Panel minSize={30}>
                <PanelGroup direction="horizontal">
                  {/* Editor */}
                  <Panel defaultSize={60} minSize={30}>
                    <div className="editor-section">
                      <TabBar
                        tabs={tabs}
                        activeTabId={activeTabId}
                        onTabClick={handleTabClick}
                        onTabClose={handleTabClose}
                      />
                      <FileViewer
                        ref={fileViewerRef}
                        filePath={currentFile?.path || null}
                        fileName={currentFile?.name || null}
                        onDirtyChange={handleFileDirtyChange}
                        onSaved={handleFileSaved}
                      />
                    </div>
                  </Panel>

                  <PanelResizeHandle className="resize-handle-vertical" />

                  {/* Chat */}
                  <Panel defaultSize={40} minSize={25}>
                    <div className="chat-section">
                      <ChatPanel currentFile={currentFile} />
                    </div>
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>PoC: Multi-Repo + Chat UI ✨</p>
      </footer>
    </div>
  )
}

export default App
