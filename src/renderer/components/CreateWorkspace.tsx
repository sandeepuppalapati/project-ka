import { useState, useEffect } from 'react';
import './CreateWorkspace.css';
import { AlertTriangle, Settings } from 'lucide-react';

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
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
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
      // Add all selected folders
      const newRepos: RepoItem[] = folders.map((folderPath, index) => {
        const folderName = folderPath.split('/').pop() || 'Repository';
        return {
          id: `repo-${Date.now()}-${index}`,
          name: folderName,
          path: folderPath,
        };
      });

      setRepos([...repos, ...newRepos]);
    }
  };

  const handleRemoveRepo = (id: string) => {
    setRepos(repos.filter(r => r.id !== id));
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
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
          repos,
          description || undefined,
          tags.length > 0 ? tags : undefined
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
          <h2>
            <Settings size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Create Workspace
          </h2>
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
            <label htmlFor="workspace-description">
              Description (optional)
            </label>
            <textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace..."
              className="create-workspace-textarea"
              rows={2}
            />
          </div>

          <div className="create-workspace-section">
            <label htmlFor="workspace-tags">
              Tags (optional)
            </label>
            <div className="tags-container">
              {tags.map(tag => (
                <div key={tag} className="tag">
                  <span>{tag}</span>
                  <button
                    type="button"
                    className="tag-remove"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="tag-input-group">
              <input
                id="workspace-tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tags (press Enter)"
                className="create-workspace-input"
              />
              <button
                type="button"
                className="tag-add-button"
                onClick={handleAddTag}
              >
                + Add
              </button>
            </div>
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
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {error}
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
