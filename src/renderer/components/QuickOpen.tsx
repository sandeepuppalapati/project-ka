import { useState, useEffect, useRef } from 'react';
import './QuickOpen.css';
import { FileText } from 'lucide-react';

interface QuickOpenProps {
  repos: Array<{ id: string; path: string; name: string }>;
  onFileSelect: (filePath: string, fileName: string) => void;
  onClose: () => void;
}

interface FileItem {
  path: string;
  name: string;
  repoName: string;
}

export function QuickOpen({ repos, onFileSelect, onClose }: QuickOpenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();

    // Load all files from all repos
    loadAllFiles();
  }, []);

  // Fuzzy match score - higher is better
  const fuzzyScore = (str: string, query: string): number => {
    str = str.toLowerCase();
    query = query.toLowerCase();

    let score = 0;
    let queryIndex = 0;
    let lastMatchIndex = -1;

    for (let i = 0; i < str.length && queryIndex < query.length; i++) {
      if (str[i] === query[queryIndex]) {
        // Consecutive matches get bonus
        score += (lastMatchIndex === i - 1) ? 10 : 5;

        // Start of word match gets bonus
        if (i === 0 || str[i - 1] === '/' || str[i - 1] === '-' || str[i - 1] === '_') {
          score += 10;
        }

        lastMatchIndex = i;
        queryIndex++;
      }
    }

    // All query chars matched
    if (queryIndex === query.length) {
      // Exact match at start gets highest score
      if (str.startsWith(query)) {
        score += 100;
      }
      // Shorter strings are better (more precise match)
      score += Math.max(0, 50 - str.length);
      return score;
    }

    return 0; // No match
  };

  useEffect(() => {
    // Filter files based on search query
    if (!searchQuery) {
      setFilteredFiles(allFiles.slice(0, 50)); // Show first 50
    } else {
      const query = searchQuery.toLowerCase();
      const scored = allFiles
        .map(file => ({
          file,
          score: Math.max(
            fuzzyScore(file.name, query),
            fuzzyScore(file.path, query) * 0.8 // Path match slightly lower priority
          )
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score) // Highest score first
        .slice(0, 50)
        .map(item => item.file);

      setFilteredFiles(scored);
      setSelectedIndex(0);
    }
  }, [searchQuery, allFiles]);

  const loadAllFiles = async () => {
    const files: FileItem[] = [];

    for (const repo of repos) {
      await scanDirectory(repo.path, repo.name, files);
    }

    setAllFiles(files);
    setFilteredFiles(files.slice(0, 50));
  };

  const scanDirectory = async (dirPath: string, repoName: string, files: FileItem[]) => {
    try {
      const entries = await window.electronAPI.readDir(dirPath);
      if (!entries) return;

      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build') {
          continue;
        }

        if (entry.isDirectory) {
          await scanDirectory(entry.path, repoName, files);
        } else {
          files.push({
            path: entry.path,
            name: entry.name,
            repoName
          });
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredFiles[selectedIndex]) {
      const file = filteredFiles[selectedIndex];
      onFileSelect(file.path, file.name);
      onClose();
    }
  };

  const handleFileClick = (file: FileItem) => {
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

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="quick-open-input"
          placeholder="Type to search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="quick-open-results">
          {filteredFiles.length === 0 ? (
            <div className="no-results">No files found</div>
          ) : (
            filteredFiles.map((file, index) => (
              <div
                key={file.path}
                className={`file-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleFileClick(file)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="file-result-name">
                  <FileText size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  {file.name}
                </div>
                <div className="file-result-path">
                  {file.repoName} › {getRelativePath(file.path, file.repoName)}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="quick-open-footer">
          Press <kbd>↑↓</kbd> to navigate, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
