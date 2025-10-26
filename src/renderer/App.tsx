import { useState, useRef, useCallback, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import './App.css'
import { RepoManager } from './components/RepoManager'
import { FileTree } from './components/FileTree'
import { ChatTabs } from './components/ChatTabs'
import { FileViewer } from './components/FileViewer'
import { GitPanel } from './components/GitPanel'
import { TabBar } from './components/TabBar'
import { QuickOpen } from './components/QuickOpen'
import { Settings } from './components/Settings'
import { CreateWorkspace } from './components/CreateWorkspace'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useRepositoriesPersistence, useWorkspacePersistence } from './hooks/usePersistence'
import { useBridge } from './contexts/BridgeContext'
import { hasOldData, migrateToWorkspace } from './utils/migration'

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
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeChatTab, setActiveChatTab] = useState<string>('bridge');
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sessionStartTime = useRef(Date.now());
  const gitPanelRef = useRef<{ refresh: () => void }>(null);
  const bridge = useBridge();
  const migrationChecked = useRef(false);

  // Restore repositories from localStorage
  const handleReposLoad = useCallback((loadedRepos: Repository[]) => {
    setRepos(loadedRepos);
    if (loadedRepos.length > 0) {
      setShowRepoManager(false);
    }
  }, []);

  // Restore workspace from localStorage
  const handleWorkspaceLoad = useCallback((workspace: any) => {
    if (workspace.openTabs && workspace.openTabs.length > 0) {
      setTabs(workspace.openTabs);
      setActiveTabId(workspace.activeTabId);
    }
    if (workspace.activeChatTab) {
      setActiveChatTab(workspace.activeChatTab);
    }
  }, []);

  // Persist repositories
  useRepositoriesPersistence(repos, handleReposLoad);

  // Persist workspace state
  useWorkspacePersistence(
    {
      activeTabId,
      activeChatTab,
      openTabs: tabs,
    },
    handleWorkspaceLoad
  );

  // Check for migration on mount
  useEffect(() => {
    if (migrationChecked.current) return;
    migrationChecked.current = true;

    const checkMigration = async () => {
      if (hasOldData()) {
        const shouldMigrate = confirm(
          '🎉 New Workspace Feature!\n\n' +
          'Your repos and chats will be organized into workspaces.\n\n' +
          'Would you like to migrate your data to a "Default Workspace"?\n\n' +
          '(This is recommended - your data will be preserved and encrypted)'
        );

        if (shouldMigrate) {
          try {
            const workspacePath = await migrateToWorkspace();
            if (workspacePath) {
              alert(
                '✅ Migration Complete!\n\n' +
                `Your data has been moved to:\n${workspacePath}\n\n` +
                'The app will now reload.'
              );
              window.location.reload();
            }
          } catch (error) {
            console.error('Migration failed:', error);
            alert(
              '❌ Migration Failed\n\n' +
              'There was an error migrating your data.\n' +
              'Please check the console for details.'
            );
          }
        }
      }
    };

    checkMigration();
  }, []);

  const handleReposChanged = (newRepos: Repository[]) => {
    // Check for newly added repos
    const addedRepos = newRepos.filter(
      newRepo => !repos.find(existingRepo => existingRepo.id === newRepo.id)
    );

    // Post intro message to bridge for each new repo
    addedRepos.forEach(repo => {
      bridge.postToBridge({
        agentId: repo.id,
        agentName: repo.name,
        type: 'status',
        content: `👋 Hello! I'm the AI agent for **${repo.name}**. I'm ready to help with code, debugging, and collaboration. Feel free to ask me questions or assign me tasks!`,
        metadata: {
          repoPath: repo.path,
        },
      });
    });

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

  // Find which repo the current file belongs to, or default to first repo
  const currentRepo = currentFile
    ? repos.find(repo => currentFile.path.startsWith(repo.path))
    : repos.length > 0 ? repos[0] : null;

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
    onToggleSidebar: () => {
      setSidebarCollapsed(!sidebarCollapsed);
    },
  });

  // Update session duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartTime.current;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setSessionDuration(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      {showQuickOpen && (
        <QuickOpen
          repos={repos}
          onFileSelect={handleFileSelect}
          onClose={() => setShowQuickOpen(false)}
        />
      )}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
      {showCreateWorkspace && (
        <CreateWorkspace
          onClose={() => setShowCreateWorkspace(false)}
          onCreated={(workspacePath) => {
            console.log('Workspace created at:', workspacePath);
            setShowCreateWorkspace(false);
            // TODO: Load workspace and switch to it
          }}
        />
      )}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <h2>Keyboard Shortcuts</h2>
              <button className="close-button" onClick={() => setShowShortcuts(false)}>×</button>
            </div>
            <div className="shortcuts-content">
              <div className="shortcuts-section">
                <h3>File Operations</h3>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>S</kbd></span>
                  <span className="shortcut-desc">Save current file</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>W</kbd></span>
                  <span className="shortcut-desc">Close current tab</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>P</kbd></span>
                  <span className="shortcut-desc">Quick open file</span>
                </div>
              </div>
              <div className="shortcuts-section">
                <h3>Navigation</h3>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>Tab</kbd></span>
                  <span className="shortcut-desc">Next tab</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Tab</kbd></span>
                  <span className="shortcut-desc">Previous tab</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>B</kbd></span>
                  <span className="shortcut-desc">Toggle left sidebar</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>◀</kbd> button</span>
                  <span className="shortcut-desc">Collapse left sidebar</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>▶</kbd> button</span>
                  <span className="shortcut-desc">Expand left sidebar</span>
                </div>
              </div>
              <div className="shortcuts-section">
                <h3>Editor</h3>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>Z</kbd></span>
                  <span className="shortcut-desc">Undo</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></span>
                  <span className="shortcut-desc">Redo</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>F</kbd></span>
                  <span className="shortcut-desc">Find in file</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>A</kbd></span>
                  <span className="shortcut-desc">Select all</span>
                </div>
              </div>
              <div className="shortcuts-section">
                <h3>Chat</h3>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>Enter</kbd></span>
                  <span className="shortcut-desc">Send message</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-keys"><kbd>Shift</kbd> + <kbd>Enter</kbd></span>
                  <span className="shortcut-desc">New line in message</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="app-header">
        <div className="header-title">
          <h1>AI IDE</h1>
          <p className="motto">For AI by AI</p>
        </div>
        <div className="header-actions">
          {repos.length > 0 && (
            <button
              className="toggle-repos"
              onClick={() => setShowRepoManager(!showRepoManager)}
            >
              {showRepoManager ? 'Hide' : 'Show'} Repos
            </button>
          )}
          <button
            className="create-workspace-button"
            onClick={() => setShowCreateWorkspace(true)}
            title="Create Workspace"
          >
            ⚡ New Workspace
          </button>
          <button
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
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
              {!sidebarCollapsed && (
                <Panel defaultSize={20} minSize={15} maxSize={40}>
                  <aside className="sidebar">
                    <PanelGroup direction="vertical">
                      {/* Git Panel */}
                      <Panel defaultSize={40} minSize={20} maxSize={60}>
                        <GitPanel
                          ref={gitPanelRef}
                          repos={repos}
                          onFileSelect={handleFileSelect}
                          onToggleSidebar={() => setSidebarCollapsed(true)}
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
              )}

              {/* Collapse toggle button */}
              {sidebarCollapsed && (
                <div className="sidebar-collapsed-toggle" onClick={() => setSidebarCollapsed(false)}>
                  <span>▶</span>
                </div>
              )}

              {!sidebarCollapsed && <PanelResizeHandle className="resize-handle-vertical" />}

              {/* Main Content */}
              <Panel minSize={30}>
                {tabs.length > 0 ? (
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
                        <ChatTabs
                          repos={repos}
                          currentFile={currentFile}
                          activeTabId={activeChatTab}
                          onTabChange={setActiveChatTab}
                        />
                      </div>
                    </Panel>
                  </PanelGroup>
                ) : (
                  /* Full-width Chat when no files open */
                  <div className="chat-section">
                    <ChatTabs
                      repos={repos}
                      currentFile={currentFile}
                      activeTabId={activeChatTab}
                      onTabChange={setActiveChatTab}
                    />
                  </div>
                )}
              </Panel>
            </PanelGroup>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-left">
          <span>© 2025 AI IDE</span>
          <span>|</span>
          <span>For AI by AI</span>
        </div>
        <div className="footer-right">
          <button className="footer-button" onClick={() => setShowShortcuts(true)} title="Keyboard Shortcuts">
            ⌨️
          </button>
          <span className="session-duration">⏱ {sessionDuration}</span>
        </div>
      </footer>
    </div>
  )
}

export default App
