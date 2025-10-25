import { useState, useEffect } from 'react';
import './FileTree.css';

interface FileTreeProps {
  repoPath: string;
  repoName: string;
  onFileSelect: (filePath: string, fileName: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

export function FileTree({ repoPath, repoName, onFileSelect }: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadDirectory(repoPath);
  }, [repoPath]);

  const handleRefresh = () => {
    loadDirectory(repoPath);
  };

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    try {
      const entries = await window.electronAPI.readDir(dirPath);
      if (entries) {
        const nodes = entries
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
        const children = entries
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

  const renderNode = (node: FileNode, depth: number = 0) => {
    return (
      <div key={node.path}>
        <div
          className={`file-node ${node.isDirectory ? 'directory' : 'file'}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleNodeClick(node)}
        >
          {node.isDirectory && (
            <span className="icon">{node.isExpanded ? '📂' : '📁'}</span>
          )}
          {!node.isDirectory && <span className="icon">📄</span>}
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
          <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
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
          <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
          <span>{repoName}</span>
        </div>
        <button
          className="file-tree-refresh-btn"
          onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
          title="Refresh file tree"
        >
          ↻
        </button>
      </div>
      {!isCollapsed && (
        <div className="file-tree-content">
          {rootNodes.map(node => renderNode(node))}
        </div>
      )}
    </div>
  );
}
