import { useState, useEffect } from 'react';
import './RepoManager.css';

interface Repository {
  id: string;
  path: string;
  name: string;
  branch: string;
  status: {
    modified: number;
    staged: number;
    untracked: number;
    clean: boolean;
  } | null;
}

interface RepoManagerProps {
  onReposChange?: (repos: { id: string; path: string; name: string }[]) => void;
  repos?: { id: string; path: string; name: string }[];
}

export function RepoManager({ onReposChange, repos: initialRepos }: RepoManagerProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialRepos && initialRepos.length > 0) {
      // Convert simple repos to full repos
      initialRepos.forEach(async (repo) => {
        const branch = await window.electronAPI.getCurrentBranch(repo.path);
        const status = await window.electronAPI.getGitStatus(repo.path);
        const fullRepo: Repository = {
          ...repo,
          branch: branch || 'main',
          status,
        };
        setRepos(prev => {
          const exists = prev.find(r => r.id === repo.id);
          if (exists) return prev;
          return [...prev, fullRepo];
        });
      });
    }
  }, [initialRepos]);

  const handleAddRepo = async () => {
    setLoading(true);
    try {
      const folderPath = await window.electronAPI.openFolder();

      if (!folderPath) {
        setLoading(false);
        return;
      }

      // Check if it's a git repo
      const isRepo = await window.electronAPI.isRepo(folderPath);

      if (!isRepo) {
        alert('Selected folder is not a git repository');
        setLoading(false);
        return;
      }

      // Get branch and status
      const branch = await window.electronAPI.getCurrentBranch(folderPath);
      const status = await window.electronAPI.getGitStatus(folderPath);

      const repoName = folderPath.split('/').pop() || 'Unknown';

      const newRepo: Repository = {
        id: Date.now().toString(),
        path: folderPath,
        name: repoName,
        branch: branch || 'main',
        status,
      };

      const updatedRepos = [...repos, newRepo];
      setRepos(updatedRepos);

      // Notify parent
      if (onReposChange) {
        onReposChange(updatedRepos.map(r => ({ id: r.id, path: r.path, name: r.name })));
      }
    } catch (error) {
      console.error('Error adding repo:', error);
      alert('Error adding repository');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRepo = (id: string) => {
    setRepos(repos.filter(repo => repo.id !== id));
  };

  return (
    <div className="repo-manager">
      <div className="repo-manager-header">
        <h2>Repositories ({repos.length})</h2>
        <button onClick={handleAddRepo} disabled={loading}>
          {loading ? 'Loading...' : '+ Add Repository'}
        </button>
      </div>

      {repos.length === 0 ? (
        <div className="repo-empty">
          <p>No repositories added yet</p>
          <p className="repo-hint">Click "Add Repository" to get started</p>
        </div>
      ) : (
        <div className="repo-list">
          {repos.map(repo => (
            <div key={repo.id} className="repo-item">
              <div className="repo-info">
                <div className="repo-name">{repo.name}</div>
                <div className="repo-path">{repo.path}</div>
                <div className="repo-meta">
                  <span className="repo-branch">🌿 {repo.branch}</span>
                  {repo.status && !repo.status.clean && (
                    <span className="repo-changes">
                      {repo.status.modified > 0 && `${repo.status.modified} modified`}
                      {repo.status.staged > 0 && ` • ${repo.status.staged} staged`}
                      {repo.status.untracked > 0 && ` • ${repo.status.untracked} untracked`}
                    </span>
                  )}
                  {repo.status?.clean && (
                    <span className="repo-clean">✓ Clean</span>
                  )}
                </div>
              </div>
              <button
                className="repo-remove"
                onClick={() => handleRemoveRepo(repo.id)}
                title="Remove repository"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
