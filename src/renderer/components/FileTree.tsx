import { useState, useEffect } from 'react';
import { Folder, FolderOpen, File, BarChart3, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import './FileTree.css';

interface FileTreeProps {
  repoPath: string;
  repoName: string;
  onFileSelect: (filePath: string, fileName: string) => void;
  onViewDiff?: (filepath: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

export function FileTree({ repoPath, repoName, onFileSelect, onViewDiff }: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);

  useEffect(() => {
    loadDirectory(repoPath);
  }, [repoPath]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Listen for file changes and auto-refresh with debouncing
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout | null = null;

    const cleanup = window.electronAPI.onFileChanged?.((_, event) => {
      // Only refresh if the change is in this repo
      if (event.repoPath === repoPath) {
        console.log('[FileTree] File changed in repo, will refresh:', event.filePath);

        // Cancel previous timer and set new one (debounce)
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(() => {
          loadDirectory(repoPath);
          refreshTimer = null;
        }, 1000); // Increased debounce time for better performance
      }
    });

    return () => {
      cleanup?.();
    };
  }, [repoPath]);

  const handleRefresh = () => {
    loadDirectory(repoPath);
  };

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    try {
      const entries = await window.electronAPI.readDir(dirPath);
      if (entries) {
        let nodes = entries
          .filter(entry => !entry.name.startsWith('.')) // Hide hidden files
          .filter(entry => {
            // Skip common heavy directories for better performance
            const skipDirs = ['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt'];
            return !skipDirs.includes(entry.name);
          })
          .map(entry => ({
            name: entry.name,
            path: entry.path,
            isDirectory: entry.isDirectory,
            children: [],
            isExpanded: false,
          }))
          .sort((a, b) => {
            // Directories first, then alphabetically
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });

        // Performance: Limit items shown per directory (show directories, then files up to limit)
        const MAX_ITEMS = 500;
        if (nodes.length > MAX_ITEMS) {
          const directories = nodes.filter(n => n.isDirectory);
          const files = nodes.filter(n => !n.isDirectory);
          nodes = [...directories, ...files.slice(0, MAX_ITEMS - directories.length)];
          console.warn(`[FileTree] Directory has ${entries.length} items, showing ${nodes.length} for performance`);
        }

        setRootNodes(nodes);
      } else {
        console.error('No entries returned');
      }
    } catch (error) {
      console.error('Error loading directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = async (node: FileNode) => {
    if (!node.isDirectory) {
      // File clicked - notify parent
      onFileSelect(node.path, node.name);
      return;
    }

    // Directory clicked - toggle expansion

    const updateNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(n => {
        if (n.path === node.path) {
          return { ...n, isExpanded: !n.isExpanded };
        }
        if (n.children) {
          return { ...n, children: updateNodes(n.children) };
        }
        return n;
      });
    };

    setRootNodes(updateNodes(rootNodes));

    // Load children if expanding and not loaded yet
    if (!node.isExpanded && (!node.children || node.children.length === 0)) {
      const entries = await window.electronAPI.readDir(node.path);
      if (entries) {
        let children = entries
          .filter(entry => !entry.name.startsWith('.'))
          .filter(entry => {
            // Skip common heavy directories for better performance
            const skipDirs = ['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt'];
            return !skipDirs.includes(entry.name);
          })
          .map(entry => ({
            name: entry.name,
            path: entry.path,
            isDirectory: entry.isDirectory,
            children: [],
            isExpanded: false,
          }))
          .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });

        // Performance: Limit items shown per directory
        const MAX_ITEMS = 500;
        if (children.length > MAX_ITEMS) {
          const directories = children.filter(n => n.isDirectory);
          const files = children.filter(n => !n.isDirectory);
          children = [...directories, ...files.slice(0, MAX_ITEMS - directories.length)];
          console.warn(`[FileTree] Directory ${node.name} has ${entries.length} items, showing ${children.length} for performance`);
        }

        const updateWithChildren = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(n => {
            if (n.path === node.path) {
              return { ...n, children, isExpanded: true };
            }
            if (n.children) {
              return { ...n, children: updateWithChildren(n.children) };
            }
            return n;
          });
        };

        setRootNodes(updateWithChildren(rootNodes));
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();

    // Only show context menu for files
    if (!node.isDirectory) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        node
      });
    }
  };

  const handleViewDiff = () => {
    if (contextMenu && onViewDiff) {
      // Get relative path from repoPath
      const relativePath = contextMenu.node.path.replace(repoPath + '/', '');
      onViewDiff(relativePath);
      setContextMenu(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, node: FileNode) => {
    if (!node.isDirectory) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'file',
        path: node.path,
        name: node.name
      }));
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    return (
      <div key={node.path}>
        <div
          className={`file-node ${node.isDirectory ? 'directory' : 'file'}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleNodeClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          draggable={!node.isDirectory}
          onDragStart={(e) => handleDragStart(e, node)}
        >
          {node.isDirectory && (
            <span className="icon">
              {node.isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
            </span>
          )}
          {!node.isDirectory && (
            <span className="icon">
              <File size={16} />
            </span>
          )}
          <span className="name">{node.name}</span>
        </div>
        {node.isDirectory && node.isExpanded && node.children && (
          <div className="children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`file-tree ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="file-tree-header" onClick={() => setIsCollapsed(!isCollapsed)}>
          <span className="collapse-icon">{isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</span>
          <span>{repoName}</span>
        </div>
        <div className="file-tree-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`file-tree ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="file-tree-header">
        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <span className="collapse-icon">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
          <span>{repoName}</span>
        </div>
        <button
          className="file-tree-refresh-btn"
          onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
          title="Refresh file tree"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {!isCollapsed && (
        <div className="file-tree-content">
          {rootNodes.map(node => renderNode(node))}
        </div>
      )}
      {contextMenu && onViewDiff && (
        <div
          className="file-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="context-menu-item" onClick={handleViewDiff}>
            <BarChart3 size={16} />
            <span>View Diff</span>
          </button>
        </div>
      )}
    </div>
  );
}
