import { useState, useEffect, useRef } from 'react';
import './RecentFiles.css';
import { Clock, FileText } from 'lucide-react';

interface RecentFilesProps {
  recentFiles: Array<{ path: string; name: string; repoName: string; timestamp: number }>;
  onFileSelect: (filePath: string, fileName: string) => void;
  onClose: () => void;
}

export function RecentFiles({ recentFiles, onFileSelect, onClose }: RecentFilesProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus modal on mount
    modalRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, recentFiles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && recentFiles[selectedIndex]) {
      const file = recentFiles[selectedIndex];
      onFileSelect(file.path, file.name);
      onClose();
    }
  };

  const handleFileClick = (file: { path: string; name: string }) => {
    onFileSelect(file.path, file.name);
    onClose();
  };

  const getRelativePath = (fullPath: string, repoName: string) => {
    const parts = fullPath.split('/');
    const repoIndex = parts.indexOf(repoName);
    if (repoIndex !== -1) {
      return parts.slice(repoIndex + 1).join('/');
    }
    return fullPath;
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="recent-files-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="recent-files-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="recent-files-header">
          <Clock size={20} />
          <span className="recent-files-title">Recent Files</span>
        </div>
        <div className="recent-files-results">
          {recentFiles.length === 0 ? (
            <div className="no-results">No recent files</div>
          ) : (
            recentFiles.map((file, index) => (
              <div
                key={file.path}
                className={`file-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleFileClick(file)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="file-result-header">
                  <FileText size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  <span className="file-result-name">{file.name}</span>
                  <span className="file-result-time">{formatTimestamp(file.timestamp)}</span>
                </div>
                <div className="file-result-path">
                  {file.repoName} › {getRelativePath(file.path, file.repoName)}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="recent-files-footer">
          Press <kbd>↑↓</kbd> to navigate, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
