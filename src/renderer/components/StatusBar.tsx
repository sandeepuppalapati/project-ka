import { Folder, GitBranch, Wifi, WifiOff, FileText } from 'lucide-react';
import './StatusBar.css';

interface StatusBarProps {
  workspaceName?: string;
  currentBranch?: string;
  fileCount?: number;
  isConnected?: boolean;
  currentFile?: string;
}

export function StatusBar({
  workspaceName,
  currentBranch,
  fileCount,
  isConnected = true,
  currentFile
}: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {workspaceName && (
          <div className="status-bar-item" title="Current Workspace">
            <Folder size={14} />
            <span>{workspaceName}</span>
          </div>
        )}

        {currentBranch && (
          <div className="status-bar-item" title="Current Branch">
            <GitBranch size={14} />
            <span>{currentBranch}</span>
          </div>
        )}

        {currentFile && (
          <div className="status-bar-item" title="Current File">
            <FileText size={14} />
            <span>{currentFile}</span>
          </div>
        )}
      </div>

      <div className="status-bar-right">
        {fileCount !== undefined && (
          <div className="status-bar-item" title="Open Files">
            <span>{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div
          className={`status-bar-item ${isConnected ? 'connected' : 'disconnected'}`}
          title={isConnected ? 'Connected to Bridge' : 'Disconnected from Bridge'}
        >
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </div>
  );
}
