import { useState, useEffect } from 'react';
import './CreateWorkspace.css';

interface CreateWorkspaceProps {
  onClose: () => void;
  onCreated: (workspacePath: string) => void;
}

interface RepoItem {
  id: string;
  name: string;
  path: string;
}

export function CreateWorkspace({ onClose, onCreated }: CreateWorkspaceProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [basePath, setBasePath] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load default workspace path
    const loadBasePath = async () => {
      if (window.electronAPI?.getDefaultWorkspacePath) {
        const defaultPath = await window.electronAPI.getDefaultWorkspacePath();
        setBasePath(defaultPath);
      }
    };
    loadBasePath();
  }, []);

  const handleAddRepo = async () => {
    const folders = await window.electronAPI.openFolder();
    if (folders && folders.length > 0) {
      const folderPath = folders[0];
      const folderName = folderPath.split('/').pop() || 'Repository';

      const newRepo: RepoItem = {
        id: `repo-${Date.now()}`,
        name: folderName,
        path: folderPath,
      };

      setRepos([...repos, newRepo]);
    }
  };

  const handleRemoveRepo = (id: string) => {
    setRepos(repos.filter(r => r.id !== id));
  };

  const handleCreate = async () => {
    // Validation
    if (!workspaceName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    if (repos.length === 0) {
      setError('Please add at least one repository or folder');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      if (window.electronAPI?.createWorkspace) {
        const workspace = await window.electronAPI.createWorkspace(
          basePath,
          workspaceName,
          repos
        );
        onCreated(workspace.path);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="create-workspace-overlay" onClick={onClose}>
      <div className="create-workspace-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="create-workspace-header">
          <h2>⚡ Create Workspace</h2>
          <button className="create-workspace-close" onClick={onClose}>×</button>
        </div>

        <div className="create-workspace-content">
          <div className="create-workspace-section">
            <label htmlFor="workspace-name">
              Workspace Name
              <span className="required">*</span>
            </label>
            <input
              id="workspace-name"
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="E-commerce Platform"
              className="create-workspace-input"
              autoFocus
            />
          </div>

          <div className="create-workspace-section">
            <label>
              Repositories & Folders
              <span className="required">*</span>
            </label>

            <div className="repos-list">
              {repos.length === 0 ? (
                <div className="repos-empty">
                  No repositories added yet
                </div>
              ) : (
                repos.map(repo => (
                  <div key={repo.id} className="repo-item">
                    <div className="repo-info">
                      <div className="repo-name">{repo.name}</div>
                      <div className="repo-path">{repo.path}</div>
                    </div>
                    <button
                      className="repo-remove"
                      onClick={() => handleRemoveRepo(repo.id)}
                      title="Remove repository"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              className="add-repo-button"
              onClick={handleAddRepo}
              type="button"
            >
              + Add Repository / Folder
            </button>
          </div>

          <div className="create-workspace-section">
            <label>Save to</label>
            <div className="workspace-path-display">
              <span className="path-text">{basePath}/</span>
              <span className="path-folder">
                {workspaceName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'workspace-name'}/
              </span>
            </div>
          </div>

          {error && (
            <div className="create-workspace-error">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="create-workspace-footer">
          <button className="create-workspace-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="create-workspace-button primary"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
