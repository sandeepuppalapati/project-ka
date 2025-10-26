import { useState, useEffect, useRef } from 'react';
import './WorkspaceSelector.css';

interface WorkspaceSelectorProps {
  currentWorkspace: string | null;
  onWorkspaceChange: (workspacePath: string) => void;
}

interface WorkspaceInfo {
  name: string;
  path: string;
}

export function WorkspaceSelector({ currentWorkspace, onWorkspaceChange }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [currentWorkspaceInfo, setCurrentWorkspaceInfo] = useState<WorkspaceInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      loadCurrentWorkspaceInfo();
    }
  }, [currentWorkspace]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const loadWorkspaces = async () => {
    try {
      const basePath = await window.electronAPI.getDefaultWorkspacePath?.();
      if (!basePath) return;

      const workspacePaths = await window.electronAPI.listWorkspaces?.(basePath);
      if (!workspacePaths) return;

      // Load workspace info for each path
      const workspaceInfos: WorkspaceInfo[] = [];
      for (const path of workspacePaths) {
        const workspace = await window.electronAPI.loadWorkspace?.(path);
        if (workspace) {
          workspaceInfos.push({
            name: workspace.name,
            path: workspace.path,
          });
        }
      }

      setWorkspaces(workspaceInfos);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const loadCurrentWorkspaceInfo = async () => {
    if (!currentWorkspace) return;

    try {
      const workspace = await window.electronAPI.loadWorkspace?.(currentWorkspace);
      if (workspace) {
        setCurrentWorkspaceInfo({
          name: workspace.name,
          path: workspace.path,
        });
      }
    } catch (error) {
      console.error('Failed to load current workspace info:', error);
    }
  };

  const handleWorkspaceSelect = (workspacePath: string) => {
    setIsOpen(false);
    onWorkspaceChange(workspacePath);
  };

  if (!currentWorkspaceInfo) {
    return null;
  }

  return (
    <div className="workspace-selector" ref={dropdownRef}>
      <button
        className="workspace-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch workspace"
      >
        <span className="workspace-icon">⚡</span>
        <span className="workspace-name">{currentWorkspaceInfo.name}</span>
        <span className="workspace-chevron">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="workspace-dropdown">
          <div className="workspace-dropdown-header">Workspaces</div>
          <div className="workspace-list">
            {workspaces.length === 0 ? (
              <div className="workspace-empty">No workspaces found</div>
            ) : (
              workspaces.map((workspace) => (
                <button
                  key={workspace.path}
                  className={`workspace-item ${
                    workspace.path === currentWorkspace ? 'active' : ''
                  }`}
                  onClick={() => handleWorkspaceSelect(workspace.path)}
                >
                  <span className="workspace-item-icon">⚡</span>
                  <div className="workspace-item-info">
                    <div className="workspace-item-name">{workspace.name}</div>
                    <div className="workspace-item-path">{workspace.path}</div>
                  </div>
                  {workspace.path === currentWorkspace && (
                    <span className="workspace-item-check">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
