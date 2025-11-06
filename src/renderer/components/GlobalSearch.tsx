import { useState, useEffect, useRef } from 'react';
import './GlobalSearch.css';
import { FileText, Search } from 'lucide-react';

interface GlobalSearchProps {
  repos: Array<{ id: string; path: string; name: string }>;
  onFileSelect: (filePath: string, fileName: string, line?: number) => void;
  onClose: () => void;
}

interface SearchResult {
  filePath: string;
  fileName: string;
  repoName: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export function GlobalSearch({ repos, onFileSelect, onClose }: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // 300ms debounce
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    const searchResults: SearchResult[] = [];

    try {
      for (const repo of repos) {
        await searchInDirectory(repo.path, repo.name, query, searchResults);
      }

      // Limit to 100 results for performance
      setResults(searchResults.slice(0, 100));
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const searchInDirectory = async (
    dirPath: string,
    repoName: string,
    query: string,
    results: SearchResult[]
  ) => {
    try {
      const entries = await window.electronAPI.readDir(dirPath);
      if (!entries) return;

      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === 'out' ||
          entry.name === 'coverage'
        ) {
          continue;
        }

        if (entry.isDirectory) {
          await searchInDirectory(entry.path, repoName, query, results);
        } else {
          // Only search text files
          if (isTextFile(entry.name)) {
            await searchInFile(entry.path, entry.name, repoName, query, results);
          }
        }

        // Stop if we have enough results
        if (results.length >= 100) {
          return;
        }
      }
    } catch (error) {
      console.error('Error searching directory:', error);
    }
  };

  const isTextFile = (filename: string): boolean => {
    const textExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html',
      '.md', '.txt', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h',
      '.hpp', '.sh', '.yml', '.yaml', '.xml', '.svg', '.env'
    ];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const searchInFile = async (
    filePath: string,
    fileName: string,
    repoName: string,
    query: string,
    results: SearchResult[]
  ) => {
    try {
      const content = await window.electronAPI.readFile(filePath);
      if (!content) return;

      const lines = content.split('\n');
      const queryLower = query.toLowerCase();

      lines.forEach((lineText, index) => {
        const lineLower = lineText.toLowerCase();
        const matchIndex = lineLower.indexOf(queryLower);

        if (matchIndex !== -1) {
          results.push({
            filePath,
            fileName,
            repoName,
            line: index + 1, // 1-indexed
            lineText: lineText.trim(),
            matchStart: matchIndex,
            matchEnd: matchIndex + query.length
          });
        }
      });
    } catch (error) {
      // File might be binary or unreadable, skip silently
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      const result = results[selectedIndex];
      onFileSelect(result.filePath, result.fileName, result.line);
      onClose();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onFileSelect(result.filePath, result.fileName, result.line);
    onClose();
  };

  const highlightMatch = (text: string, start: number, end: number) => {
    return (
      <>
        {text.substring(0, start)}
        <mark className="search-match">{text.substring(start, end)}</mark>
        {text.substring(end)}
      </>
    );
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
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-header">
          <Search size={20} />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Search in all files... (min 2 characters)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isSearching && <div className="search-spinner">Searching...</div>}
        </div>

        <div className="global-search-results">
          {!searchQuery || searchQuery.length < 2 ? (
            <div className="search-hint">Type at least 2 characters to search</div>
          ) : results.length === 0 && !isSearching ? (
            <div className="no-results">No matches found</div>
          ) : (
            <>
              <div className="results-count">
                {results.length} {results.length === 100 ? '(limited to 100)' : ''} results
              </div>
              {results.map((result, index) => (
                <div
                  key={`${result.filePath}-${result.line}`}
                  className={`search-result ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleResultClick(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="search-result-header">
                    <FileText size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    <span className="result-file">{result.fileName}</span>
                    <span className="result-line">:{result.line}</span>
                    <span className="result-path">
                      {result.repoName} › {getRelativePath(result.filePath, result.repoName)}
                    </span>
                  </div>
                  <div className="search-result-line">
                    {highlightMatch(result.lineText, result.matchStart, result.matchEnd)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="global-search-footer">
          Press <kbd>↑↓</kbd> to navigate, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
