import { useState, useEffect } from 'react';
import './EditWorkspace.css';
import type { Workspace, WorkspaceRepo } from '../types/workspace';
import { AlertTriangle, Settings } from 'lucide-react';

interface EditWorkspaceProps {
  workspace: Workspace;
  onClose: () => void;
  onSaved: () => void;
}

interface RepoItem {
  id: string;
  name: string;
  path: string;
}

export function EditWorkspace({ workspace, onClose, onSaved }: EditWorkspaceProps) {
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(workspace.tags || []);
  const [repos, setRepos] = useState<RepoItem[]>(
    workspace.repos.map(r => ({
      id: r.id,
      name: r.name,
      path: r.path,
    }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddRepo = async () => {
    const folders = await window.electronAPI.openFolder();
    if (folders && folders.length > 0) {
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

  const handleSave = async () => {
    // Validation
    if (!workspaceName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    if (repos.length === 0) {
      setError('Please add at least one repository or folder');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (window.electronAPI?.saveWorkspace) {
        const updatedWorkspace: Workspace = {
          ...workspace,
          name: workspaceName,
          description: description || undefined,
          tags: tags.length > 0 ? tags : undefined,
          repos: repos.map(r => ({
            id: r.id,
            name: r.name,
            path: r.path,
          })),
        };

        await window.electronAPI.saveWorkspace(updatedWorkspace);
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workspace');
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="edit-workspace-overlay" onClick={onClose}>
      <div className="edit-workspace-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="edit-workspace-header">
          <h2>
            <Settings size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Edit Workspace
          </h2>
          <button className="edit-workspace-close" onClick={onClose}>×</button>
        </div>

        <div className="edit-workspace-content">
          <div className="edit-workspace-section">
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
              className="edit-workspace-input"
              autoFocus
            />
          </div>

          <div className="edit-workspace-section">
            <label htmlFor="workspace-description">
              Description (optional)
            </label>
            <textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace..."
              className="edit-workspace-textarea"
              rows={2}
            />
          </div>

          <div className="edit-workspace-section">
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
                className="edit-workspace-input"
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

          <div className="edit-workspace-section">
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

          {error && (
            <div className="edit-workspace-error">
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {error}
            </div>
          )}
        </div>

        <div className="edit-workspace-footer">
          <button className="edit-workspace-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="edit-workspace-button primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
