import { useState, useEffect } from 'react';
import './WorkspaceWelcome.css';

interface WorkspaceWelcomeProps {
  onCreateWorkspace: () => void;
  onOpenWorkspace: (workspacePath: string) => void;
}

interface WorkspaceInfo {
  name: string;
  path: string;
  created: string;
  lastAccessed?: string;
  description?: string;
  tags?: string[];
}

export function WorkspaceWelcome({ onCreateWorkspace, onOpenWorkspace }: WorkspaceWelcomeProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const basePath = await window.electronAPI.getDefaultWorkspacePath?.();
      if (!basePath) {
        setLoading(false);
        return;
      }

      const workspacePaths = await window.electronAPI.listWorkspaces?.(basePath);
      if (!workspacePaths) {
        setLoading(false);
        return;
      }

      const workspaceInfos: WorkspaceInfo[] = [];
      for (const path of workspacePaths) {
        const workspace = await window.electronAPI.loadWorkspace?.(path);
        if (workspace) {
          workspaceInfos.push({
            name: workspace.name,
            path: workspace.path,
            created: workspace.created,
            lastAccessed: workspace.lastAccessed,
            description: workspace.description,
            tags: workspace.tags,
          });
        }
      }

      // Sort by last accessed (most recent first), fallback to created date
      workspaceInfos.sort((a, b) => {
        const timeA = a.lastAccessed || a.created;
        const timeB = b.lastAccessed || b.created;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setWorkspaces(workspaceInfos);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(isoString);
  };

  const filteredWorkspaces = workspaces.filter(workspace => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const nameMatch = workspace.name.toLowerCase().includes(query);
    const descriptionMatch = workspace.description?.toLowerCase().includes(query);
    const tagsMatch = workspace.tags?.some(tag => tag.toLowerCase().includes(query));

    return nameMatch || descriptionMatch || tagsMatch;
  });

  return (
    <div className="workspace-welcome">
      <div className="workspace-welcome-content">
        {/* Left side - Welcome content */}
        <div className="workspace-welcome-left">
          <div className="workspace-welcome-icon">⚡</div>
          <h1>Welcome to AI IDE</h1>
          <p className="workspace-welcome-subtitle">For AI by AI</p>

          {workspaces.length === 0 ? (
            <>
              <div className="workspace-welcome-message">
                <p>Get started by creating your first workspace.</p>
                <p>A workspace organizes your repositories, chats, and AI agents in one place.</p>
              </div>

              <button className="workspace-welcome-button" onClick={onCreateWorkspace}>
                <span className="workspace-welcome-button-icon">⚡</span>
                Create Your First Workspace
              </button>
            </>
          ) : (
            <div className="workspace-welcome-message">
              <p>Select a workspace to continue or create a new one.</p>
            </div>
          )}

          <div className="workspace-welcome-features">
            <div className="workspace-feature">
              <span className="feature-icon">🔐</span>
              <div className="feature-text">
                <strong>Encrypted Storage</strong>
                <span>Your data is encrypted at rest</span>
              </div>
            </div>
            <div className="workspace-feature">
              <span className="feature-icon">💬</span>
              <div className="feature-text">
                <strong>Persistent Chats</strong>
                <span>All conversations saved per workspace</span>
              </div>
            </div>
            <div className="workspace-feature">
              <span className="feature-icon">🎯</span>
              <div className="feature-text">
                <strong>Organized Projects</strong>
                <span>Group related repos together</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Workspace list */}
        {!loading && workspaces.length > 0 && (
          <div className="workspace-welcome-right">
            <div className="workspace-list-section">
              <div className="workspace-list-header">
                <span>Your Workspaces</span>
                <button className="workspace-create-new" onClick={onCreateWorkspace}>
                  + New Workspace
                </button>
              </div>

              <div className="workspace-search">
                <input
                  type="text"
                  placeholder="Search workspaces by name, description, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="workspace-search-input"
                />
                {searchQuery && (
                  <button
                    className="workspace-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="workspace-list">
                {filteredWorkspaces.length === 0 ? (
                  <div className="workspace-search-empty">
                    No workspaces match "{searchQuery}"
                  </div>
                ) : (
                  filteredWorkspaces.map((workspace) => (
                  <button
                    key={workspace.path}
                    className="workspace-card"
                    onClick={() => onOpenWorkspace(workspace.path)}
                  >
                    <div className="workspace-card-icon">⚡</div>
                    <div className="workspace-card-info">
                      <div className="workspace-card-name">{workspace.name}</div>
                      {workspace.description && (
                        <div className="workspace-card-description">
                          {workspace.description}
                        </div>
                      )}
                      {workspace.tags && workspace.tags.length > 0 && (
                        <div className="workspace-card-tags">
                          {workspace.tags.map(tag => (
                            <span key={tag} className="workspace-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="workspace-card-meta">
                        {workspace.lastAccessed ? (
                          <span className="workspace-last-accessed">
                            Opened {getRelativeTime(workspace.lastAccessed)}
                          </span>
                        ) : (
                          <span>Created {formatDate(workspace.created)}</span>
                        )}
                      </div>
                    </div>
                    <div className="workspace-card-arrow">→</div>
                  </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
