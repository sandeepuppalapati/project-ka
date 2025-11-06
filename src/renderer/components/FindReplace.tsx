import { useState, useEffect, useRef } from 'react';
import './FindReplace.css';
import { Search, Replace, CheckSquare, Square } from 'lucide-react';

interface FindReplaceProps {
  repos: Array<{ id: string; path: string; name: string }>;
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
  selected: boolean;
}

export function FindReplace({ repos, onClose }: FindReplaceProps) {
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isReplacing, setIsReplacing] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    findInputRef.current?.focus();

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!findQuery || findQuery.length < 2) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(findQuery);
    }, 300);
  }, [findQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    const searchResults: SearchResult[] = [];

    try {
      for (const repo of repos) {
        await searchInDirectory(repo.path, repo.name, query, searchResults);
      }

      setResults(searchResults.slice(0, 200)); // Limit to 200 for performance
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
          if (isTextFile(entry.name)) {
            await searchInFile(entry.path, entry.name, repoName, query, results);
          }
        }

        if (results.length >= 200) {
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
        let matchIndex = lineLower.indexOf(queryLower);

        // Find all matches in the line
        while (matchIndex !== -1) {
          results.push({
            filePath,
            fileName,
            repoName,
            line: index + 1,
            lineText: lineText.trim(),
            matchStart: matchIndex,
            matchEnd: matchIndex + query.length,
            selected: true, // All selected by default
          });

          // Search for next occurrence in the same line
          matchIndex = lineLower.indexOf(queryLower, matchIndex + 1);
        }
      });
    } catch (error) {
      // File might be binary or unreadable, skip silently
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const toggleResult = (index: number) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = results.every(r => r.selected);
    setResults(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const handleReplace = async () => {
    const selectedResults = results.filter(r => r.selected);
    if (selectedResults.length === 0 || !replaceQuery) return;

    setIsReplacing(true);

    try {
      // Group by file
      const fileGroups = new Map<string, SearchResult[]>();
      selectedResults.forEach(result => {
        if (!fileGroups.has(result.filePath)) {
          fileGroups.set(result.filePath, []);
        }
        fileGroups.get(result.filePath)!.push(result);
      });

      // Replace in each file
      for (const [filePath, fileResults] of fileGroups) {
        const content = await window.electronAPI.readFile(filePath);
        if (!content) continue;

        const lines = content.split('\n');

        // Sort by line number (descending) to handle replacements correctly
        const sortedResults = [...fileResults].sort((a, b) => {
          if (a.line !== b.line) return b.line - a.line;
          return b.matchStart - a.matchStart;
        });

        // Perform replacements
        sortedResults.forEach(result => {
          const lineIndex = result.line - 1;
          const line = lines[lineIndex];
          const before = line.substring(0, result.matchStart);
          const after = line.substring(result.matchEnd);
          lines[lineIndex] = before + replaceQuery + after;
        });

        // Write back to file
        const newContent = lines.join('\n');
        await window.electronAPI.writeFile(filePath, newContent);
      }

      // Clear results and show success
      setResults([]);
      setFindQuery('');
      setReplaceQuery('');
      alert(`Replaced ${selectedResults.length} occurrence(s) in ${fileGroups.size} file(s)`);
    } catch (error) {
      console.error('Replace error:', error);
      alert(`Error during replacement: ${error}`);
    } finally {
      setIsReplacing(false);
    }
  };

  const highlightMatch = (text: string, start: number, end: number, replaceText: string) => {
    return (
      <>
        {text.substring(0, start)}
        <span className="match-old">{text.substring(start, end)}</span>
        {replaceText && <span className="match-new">{replaceText}</span>}
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

  const selectedCount = results.filter(r => r.selected).length;

  return (
    <div className="find-replace-overlay" onClick={onClose}>
      <div className="find-replace-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="find-replace-header">
          <Replace size={20} />
          <span className="find-replace-title">Find and Replace</span>
        </div>

        <div className="find-replace-inputs">
          <div className="input-group">
            <Search size={16} />
            <input
              ref={findInputRef}
              type="text"
              className="find-input"
              placeholder="Find (min 2 characters)"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
            />
          </div>
          <div className="input-group">
            <Replace size={16} />
            <input
              type="text"
              className="replace-input"
              placeholder="Replace with"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
            />
          </div>
        </div>

        {isSearching && (
          <div className="search-status">Searching...</div>
        )}

        {results.length > 0 && (
          <div className="find-replace-controls">
            <button className="select-all-btn" onClick={toggleAll}>
              {results.every(r => r.selected) ? <CheckSquare size={16} /> : <Square size={16} />}
              <span>{results.every(r => r.selected) ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="results-count">
              {selectedCount} of {results.length} selected
            </span>
            <button
              className="replace-btn"
              onClick={handleReplace}
              disabled={selectedCount === 0 || !replaceQuery || isReplacing}
            >
              {isReplacing ? 'Replacing...' : `Replace ${selectedCount} occurrence(s)`}
            </button>
          </div>
        )}

        <div className="find-replace-results">
          {!findQuery || findQuery.length < 2 ? (
            <div className="search-hint">Type at least 2 characters to search</div>
          ) : results.length === 0 && !isSearching ? (
            <div className="no-results">No matches found</div>
          ) : (
            results.map((result, index) => (
              <div
                key={`${result.filePath}-${result.line}-${index}`}
                className={`replace-result ${result.selected ? 'selected' : ''}`}
                onClick={() => toggleResult(index)}
              >
                <div className="result-checkbox">
                  {result.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
                <div className="result-content">
                  <div className="result-header">
                    <span className="result-file">{result.fileName}</span>
                    <span className="result-line">:{result.line}</span>
                    <span className="result-path">
                      {result.repoName} › {getRelativePath(result.filePath, result.repoName)}
                    </span>
                  </div>
                  <div className="result-preview">
                    {highlightMatch(result.lineText, result.matchStart, result.matchEnd, replaceQuery)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="find-replace-footer">
          Press <kbd>Esc</kbd> to close • Click items to toggle selection
        </div>
      </div>
    </div>
  );
}
