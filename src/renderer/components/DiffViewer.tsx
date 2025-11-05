import { useEffect, useState } from 'react';
import * as Diff from 'diff';
import './DiffViewer.css';
import { GitCompare } from 'lucide-react';

interface DiffViewerProps {
  filepath: string;
  oldContent: string;
  newContent: string;
  onClose?: () => void;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function DiffViewer({ filepath, oldContent, newContent, onClose }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);

  useEffect(() => {
    // Generate line-by-line diff
    const changes = Diff.diffLines(oldContent, newContent);
    const lines: DiffLine[] = [];
    let oldLine = 1;
    let newLine = 1;

    changes.forEach((change) => {
      const content = change.value.replace(/\n$/, ''); // Remove trailing newline
      const lineCount = content.split('\n').length;

      if (change.added) {
        content.split('\n').forEach((line) => {
          lines.push({
            type: 'add',
            content: line,
            newLineNumber: newLine++,
          });
        });
      } else if (change.removed) {
        content.split('\n').forEach((line) => {
          lines.push({
            type: 'remove',
            content: line,
            oldLineNumber: oldLine++,
          });
        });
      } else {
        content.split('\n').forEach((line) => {
          lines.push({
            type: 'context',
            content: line,
            oldLineNumber: oldLine++,
            newLineNumber: newLine++,
          });
        });
      }
    });

    setDiffLines(lines);
  }, [oldContent, newContent]);

  const getFileExtension = (path: string) => {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  return (
    <div className="diff-viewer">
      <div className="diff-header">
        <div className="diff-title">
          <span className="diff-icon"><GitCompare size={20} /></span>
          <span className="diff-filepath">{filepath}</span>
          <span className="diff-ext">.{getFileExtension(filepath)}</span>
        </div>
        <div className="diff-actions">
          <button
            className={`diff-mode-btn ${viewMode === 'unified' ? 'active' : ''}`}
            onClick={() => setViewMode('unified')}
          >
            Unified
          </button>
          <button
            className={`diff-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
          >
            Split
          </button>
          {onClose && (
            <button className="diff-close-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>
      </div>

      <div className="diff-content">
        {viewMode === 'unified' ? (
          <div className="diff-unified">
            <table>
              <tbody>
                {diffLines.map((line, index) => (
                  <tr key={index} className={`diff-line diff-line-${line.type}`}>
                    <td className="diff-line-number old">{line.oldLineNumber || ''}</td>
                    <td className="diff-line-number new">{line.newLineNumber || ''}</td>
                    <td className="diff-line-indicator">
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                    </td>
                    <td className="diff-line-content">
                      <pre>{line.content}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="diff-split">
            <div className="diff-split-pane">
              <div className="diff-split-header">Original</div>
              <table>
                <tbody>
                  {diffLines
                    .filter((line) => line.type !== 'add')
                    .map((line, index) => (
                      <tr key={index} className={`diff-line diff-line-${line.type}`}>
                        <td className="diff-line-number">{line.oldLineNumber || ''}</td>
                        <td className="diff-line-content">
                          <pre>{line.content}</pre>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="diff-split-pane">
              <div className="diff-split-header">Modified</div>
              <table>
                <tbody>
                  {diffLines
                    .filter((line) => line.type !== 'remove')
                    .map((line, index) => (
                      <tr key={index} className={`diff-line diff-line-${line.type}`}>
                        <td className="diff-line-number">{line.newLineNumber || ''}</td>
                        <td className="diff-line-content">
                          <pre>{line.content}</pre>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
