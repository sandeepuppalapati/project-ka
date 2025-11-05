import { useState, useEffect } from 'react';
import './RepoManager.css';
import { Check } from 'lucide-react';

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
      const folderPaths = await window.electronAPI.openFolder();

      if (!folderPaths || folderPaths.length === 0) {
        setLoading(false);
        return;
      }

      const newRepos: Repository[] = [];

      // Process each selected folder
      for (const folderPath of folderPaths) {
        // Check if already added
        if (repos.find(r => r.path === folderPath)) {
          continue;
        }

        // Check if it's a git repo (optional - for git features)
        const isRepo = await window.electronAPI.isRepo(folderPath);

        // Get branch and status only if it's a git repo
        let branch = null;
        let status = null;

        if (isRepo) {
          branch = await window.electronAPI.getCurrentBranch(folderPath);
          status = await window.electronAPI.getGitStatus(folderPath);
        }

        const repoName = folderPath.split('/').pop() || 'Unknown';

        const newRepo: Repository = {
          id: Date.now().toString() + '-' + newRepos.length,
          path: folderPath,
          name: repoName,
          branch: branch || 'N/A',
          status: status || { modified: [], untracked: [], staged: [] },
        };

        newRepos.push(newRepo);
      }

      if (newRepos.length > 0) {
        const updatedRepos = [...repos, ...newRepos];
        setRepos(updatedRepos);

        // Notify parent
        if (onReposChange) {
          onReposChange(updatedRepos.map(r => ({ id: r.id, path: r.path, name: r.name })));
        }
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
                    <span className="repo-clean">
                      <Check size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Clean
                    </span>
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
