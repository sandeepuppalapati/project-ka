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
}

export function WorkspaceWelcome({ onCreateWorkspace, onOpenWorkspace }: WorkspaceWelcomeProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);

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
          });
        }
      }

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

  return (
    <div className="workspace-welcome">
      <div className="workspace-welcome-content">
        <div className="workspace-welcome-icon">⚡</div>
        <h1>Welcome to AI IDE</h1>
        <p className="workspace-welcome-subtitle">For AI by AI</p>

        {loading ? (
          <div className="workspace-welcome-loading">Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
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
          <>
            <div className="workspace-welcome-message">
              <p>Open an existing workspace or create a new one.</p>
            </div>

            <div className="workspace-list-section">
              <div className="workspace-list-header">
                <span>Your Workspaces</span>
                <button className="workspace-create-new" onClick={onCreateWorkspace}>
                  + New Workspace
                </button>
              </div>

              <div className="workspace-list">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.path}
                    className="workspace-card"
                    onClick={() => onOpenWorkspace(workspace.path)}
                  >
                    <div className="workspace-card-icon">⚡</div>
                    <div className="workspace-card-info">
                      <div className="workspace-card-name">{workspace.name}</div>
                      <div className="workspace-card-meta">
                        Created {formatDate(workspace.created)}
                      </div>
                    </div>
                    <div className="workspace-card-arrow">→</div>
                  </button>
                ))}
              </div>
            </div>
          </>
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
    </div>
  );
}
