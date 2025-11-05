import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import './GitPanel.css';
import { Trash2, FileText } from 'lucide-react';

interface GitPanelProps {
  repos: Array<{ id: string; path: string; name: string }>;
  onRefresh?: () => void;
  onFileSelect?: (filePath: string, fileName: string) => void;
  onToggleSidebar?: () => void;
  onViewDiff?: (repoPath: string, filepath: string) => void;
}

export interface GitPanelRef {
  refresh: () => void;
}

interface ChangedFile {
  filepath: string;
  status: 'untracked' | 'modified' | 'deleted' | 'staged' | 'unmodified';
  repoPath: string;
}

export const GitPanel = forwardRef<GitPanelRef, GitPanelProps>(
  ({ repos, onRefresh, onFileSelect, onToggleSidebar, onViewDiff }, ref) => {
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  useEffect(() => {
    loadChangedFiles();
  }, [repos]);

  // Expose refresh function to parent
  useImperativeHandle(ref, () => ({
    refresh: loadChangedFiles
  }));

  const loadChangedFiles = async () => {
    const allFiles: ChangedFile[] = [];

    for (const repo of repos) {
      const statusMatrix = await window.electronAPI.getStatusMatrix(repo.path);
      if (statusMatrix) {
        const repoFiles = statusMatrix
          .filter(file => file.status !== 'unmodified')
          .map(file => ({
            ...file,
            repoPath: repo.path
          }));
        allFiles.push(...repoFiles);
      }
    }

    setChangedFiles(allFiles);
    if (repos.length > 0 && !selectedRepo) {
      setSelectedRepo(repos[0].path);
    }
  };

  const handleStageFile = async (file: ChangedFile) => {
    const success = await window.electronAPI.gitAdd(file.repoPath, file.filepath);
    if (success) {
      await loadChangedFiles();
    } else {
      alert('Failed to stage file. Check console for errors.');
    }
  };

  const handleUnstageFile = async (file: ChangedFile) => {
    const success = await window.electronAPI.gitRemove(file.repoPath, file.filepath);
    if (success) {
      await loadChangedFiles();
    } else {
      alert('Failed to unstage file. Check console for errors.');
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || !selectedRepo) return;

    setLoading(true);
    try {
      const sha = await window.electronAPI.gitCommit(selectedRepo, commitMessage.trim());
      if (sha) {
        setCommitMessage('');
        await loadChangedFiles();
        onRefresh?.();
      } else {
        alert('Commit failed. Make sure you have staged changes.');
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!selectedRepo) return;

    setLoading(true);
    try {
      const success = await window.electronAPI.gitPush(selectedRepo);
      if (success) {
        alert('Pushed successfully!');
      } else {
        alert('Push failed. Check credentials and remote configuration.');
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStageAll = async () => {
    if (!selectedRepo) return;

    const repoFiles = changedFiles.filter(f => f.repoPath === selectedRepo && f.status !== 'staged');

    for (const file of repoFiles) {
      await window.electronAPI.gitAdd(file.repoPath, file.filepath);
    }
    await loadChangedFiles();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'modified': return <FileText size={14} />;
      case 'untracked': return <FileText size={14} />;
      case 'deleted': return <Trash2 size={14} />;
      case 'staged': return <FileText size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified': return '#e2c08d';
      case 'untracked': return '#6a9955';
      case 'deleted': return '#f14c4c';
      case 'staged': return '#4ec9b0';
      default: return '#858585';
    }
  };

  const currentRepoFiles = selectedRepo
    ? changedFiles.filter(f => f.repoPath === selectedRepo)
    : [];

  return (
    <div className="git-panel">
      <div className="git-header">
        <button className="collapse-sidebar-button" onClick={onToggleSidebar} title="Collapse Sidebar (Cmd+B)">
          ◀
        </button>
        <h3>Source Control</h3>
        <button className="refresh-button" onClick={loadChangedFiles}>
          🔄
        </button>
      </div>

      {repos.length > 1 && (
        <div className="repo-selector">
          <select
            value={selectedRepo || ''}
            onChange={(e) => setSelectedRepo(e.target.value)}
          >
            {repos.map(repo => (
              <option key={repo.id} value={repo.path}>
                {repo.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="git-content">
        <div className="changed-files">
          <div className="section-header">
            <span>Changes ({currentRepoFiles.length})</span>
            {currentRepoFiles.length > 0 && (
              <button className="stage-all-button" onClick={handleStageAll}>
                Stage All
              </button>
            )}
          </div>

          {currentRepoFiles.length === 0 ? (
            <div className="no-changes">No changes</div>
          ) : (
            currentRepoFiles.map((file, idx) => (
              <div key={idx} className="file-item">
                <div
                  className="file-info"
                  onClick={() => {
                    if (onViewDiff && (file.status === 'modified' || file.status === 'staged')) {
                      onViewDiff(file.repoPath, file.filepath);
                    }
                  }}
                  onDoubleClick={() => onFileSelect?.(
                    `${file.repoPath}/${file.filepath}`,
                    file.filepath.split('/').pop() || file.filepath
                  )}
                  title="Click to view diff, double-click to open file"
                >
                  <span className="file-icon">{getStatusIcon(file.status)}</span>
                  <span className="file-name">{file.filepath}</span>
                  <span
                    className="file-status"
                    style={{ color: getStatusColor(file.status) }}
                  >
                    {file.status}
                  </span>
                </div>
                {file.status === 'staged' ? (
                  <button
                    className="unstage-button"
                    onClick={() => handleUnstageFile(file)}
                    title="Unstage file"
                  >
                    −
                  </button>
                ) : (
                  <button
                    className="stage-button"
                    onClick={() => handleStageFile(file)}
                    title="Stage file"
                  >
                    +
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="commit-section">
          <textarea
            className="commit-message"
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            rows={3}
          />
          <div className="commit-actions">
            <button
              className="commit-button"
              onClick={handleCommit}
              disabled={!commitMessage.trim() || loading || !selectedRepo}
            >
              Commit
            </button>
            <button
              className="push-button"
              onClick={handlePush}
              disabled={loading || !selectedRepo}
            >
              Push
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
