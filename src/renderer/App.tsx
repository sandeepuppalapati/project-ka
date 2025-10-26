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
import { EditWorkspace } from './components/EditWorkspace'
import { WorkspaceSelector } from './components/WorkspaceSelector'
import { WorkspaceWelcome } from './components/WorkspaceWelcome'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useRepositoriesPersistence, useWorkspacePersistence } from './hooks/usePersistence'
import { useWorkspaceState } from './hooks/useWorkspaceState'
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
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [currentWorkspaceData, setCurrentWorkspaceData] = useState<any>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showEditWorkspace, setShowEditWorkspace] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeChatTab, setActiveChatTab] = useState<string>('bridge');
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const sessionStartTime = useRef(Date.now());
  const gitPanelRef = useRef<{ refresh: () => void }>(null);
  const bridge = useBridge();
  const migrationChecked = useRef(false);
  const currentWorkspaceRef = useRef<string | null>(null);
  const workspaceLoadedRef = useRef(false);

  // Workspace state management with auto-save
  const workspaceState = useWorkspaceState(currentWorkspace);

  // Load workspace and all its data
  const loadWorkspace = useCallback(async (workspacePath: string) => {
    try {
      console.log('[App] Loading workspace:', workspacePath);

      // Load workspace config and update last accessed time
      const workspace = await window.electronAPI.loadWorkspace?.(workspacePath, true);
      if (!workspace) {
        console.error('[App] Failed to load workspace');
        return;
      }

      console.log('[App] Workspace loaded:', workspace.name);

      // Set current workspace
      setCurrentWorkspace(workspacePath);
      currentWorkspaceRef.current = workspacePath;
      setCurrentWorkspaceData(workspace);

      // Load repos from workspace
      setRepos(workspace.repos || []);
      if (workspace.repos && workspace.repos.length > 0) {
        setShowRepoManager(false);
      }

      // Load Bridge messages from workspace
      await bridge.loadMessagesFromWorkspace(workspacePath);
      console.log('[App] Bridge messages loaded from workspace');

      // Load workspace state (open files, etc.)
      const state = await window.electronAPI.loadWorkspaceState?.(workspacePath);
      if (state?.ui) {
        // Restore UI state
        if (state.ui.activeChatTab) {
          setActiveChatTab(state.ui.activeChatTab);
        }
        // TODO: Restore open files, cursor positions, etc.
      }

      console.log('[App] Workspace loaded successfully');
    } catch (error) {
      console.error('[App] Failed to load workspace:', error);
    }
  }, [bridge]);

  // Unload current workspace and return to welcome screen
  const unloadWorkspace = useCallback(async () => {
    // Save workspace state immediately before unloading
    if (currentWorkspaceRef.current) {
      await workspaceState.immediateSave();
      bridge.saveMessagesToWorkspace(currentWorkspaceRef.current);
    }

    // Clear state
    setCurrentWorkspace(null);
    currentWorkspaceRef.current = null;
    setCurrentWorkspaceData(null);
    setRepos([]);
    setTabs([]);
    setActiveTabId(null);
    bridge.clearMessages();

    // Clear from localStorage
    localStorage.removeItem('current_workspace');

    console.log('[App] Workspace unloaded');
  }, [bridge]);

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

  // Automatic mandatory migration on mount
  useEffect(() => {
    if (migrationChecked.current) return;
    migrationChecked.current = true;

    const performMigration = async () => {
      if (hasOldData()) {
        setIsMigrating(true);

        try {
          console.log('[App] Starting automatic migration...');
          const workspacePath = await migrateToWorkspace();

          if (workspacePath) {
            console.log('[App] Migration successful, loading workspace...');

            // Store workspace path in localStorage for future sessions
            localStorage.setItem('current_workspace', workspacePath);

            // Give user a moment to see the success message
            setTimeout(async () => {
              setIsMigrating(false);
              await loadWorkspace(workspacePath);
            }, 1000);
          } else {
            // No data to migrate
            setIsMigrating(false);
          }
        } catch (error) {
          console.error('[App] Migration failed:', error);
          setMigrationError(
            error instanceof Error
              ? error.message
              : 'An unknown error occurred during migration'
          );
          setIsMigrating(false);
        }
      }
    };

    performMigration();
  }, [loadWorkspace]);

  // Load current workspace on mount (if not migrating)
  useEffect(() => {
    if (isMigrating || migrationError || workspaceLoadedRef.current) return;

    const loadCurrentWorkspace = async () => {
      const workspacePath = localStorage.getItem('current_workspace');
      if (workspacePath) {
        console.log('[App] Loading current workspace from localStorage');
        workspaceLoadedRef.current = true;
        await loadWorkspace(workspacePath);
      }
    };

    loadCurrentWorkspace();
  }, [isMigrating, migrationError, loadWorkspace]);

  // Auto-save Bridge messages to workspace
  useEffect(() => {
    if (!currentWorkspaceRef.current || bridge.messages.length === 0) return;

    const timer = setTimeout(() => {
      if (currentWorkspaceRef.current) {
        bridge.saveMessagesToWorkspace(currentWorkspaceRef.current);
      }
    }, 2000); // Save after 2s of inactivity

    return () => clearTimeout(timer);
  }, [bridge.messages, bridge.saveMessagesToWorkspace]);

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

  // Show migration overlay if migrating
  if (isMigrating) {
    return (
      <div className="app">
        <div className="migration-overlay">
          <div className="migration-modal">
            <h2>🚀 Upgrading to Workspaces</h2>
            <p>Migrating your data to the new workspace format...</p>
            <p className="migration-detail">This will only take a moment. Your data is being encrypted and organized.</p>
            <div className="migration-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if migration failed
  if (migrationError) {
    return (
      <div className="app">
        <div className="migration-overlay">
          <div className="migration-modal error">
            <h2>❌ Migration Failed</h2>
            <p>There was an error upgrading your data:</p>
            <p className="migration-error-detail">{migrationError}</p>
            <p className="migration-help">
              Please report this issue on GitHub or contact support.
              Your original data has not been deleted.
            </p>
            <button
              className="migration-retry-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          onCreated={async (workspacePath) => {
            console.log('Workspace created at:', workspacePath);
            setShowCreateWorkspace(false);

            // Store and load the new workspace
            localStorage.setItem('current_workspace', workspacePath);
            await loadWorkspace(workspacePath);
          }}
        />
      )}
      {showEditWorkspace && currentWorkspaceData && (
        <EditWorkspace
          workspace={currentWorkspaceData}
          onClose={() => setShowEditWorkspace(false)}
          onSaved={async () => {
            setShowEditWorkspace(false);
            // Reload workspace to get updated data
            if (currentWorkspace) {
              await loadWorkspace(currentWorkspace);
            }
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
        <div className="header-center">
          {currentWorkspace && (
            <>
              <button
                className="home-button"
                onClick={unloadWorkspace}
                title="Back to workspaces"
              >
                🏠
              </button>
              <WorkspaceSelector
                currentWorkspace={currentWorkspace}
                onWorkspaceChange={async (workspacePath) => {
                  localStorage.setItem('current_workspace', workspacePath);
                  await loadWorkspace(workspacePath);
                }}
              />
            </>
          )}
        </div>
        <div className="header-actions">
          <button
            className="create-workspace-button"
            onClick={() => setShowCreateWorkspace(true)}
            title="Create Workspace"
          >
            ⚡ New Workspace
          </button>
          {currentWorkspace && (
            <button
              className="edit-workspace-btn"
              onClick={() => setShowEditWorkspace(true)}
              title="Edit Workspace"
            >
              ✏️ Edit
            </button>
          )}
          <button
            className="header-settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="app-main">
        {!currentWorkspace ? (
          <WorkspaceWelcome
            onCreateWorkspace={() => setShowCreateWorkspace(true)}
            onOpenWorkspace={async (workspacePath) => {
              localStorage.setItem('current_workspace', workspacePath);
              await loadWorkspace(workspacePath);
            }}
          />
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
