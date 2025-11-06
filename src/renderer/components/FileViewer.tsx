import { useState, useEffect, useImperativeHandle, forwardRef, useRef, lazy, Suspense } from 'react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { FileText, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './FileViewer.css';

// Lazy load Monaco editor for better initial load performance
const Editor = lazy(() => import('@monaco-editor/react'));

interface FileViewerProps {
  filePath: string | null;
  fileName: string | null;
  line?: number;
  onDirtyChange?: (isDirty: boolean) => void;
  onSaved?: () => void;
  onAskAI?: (prompt: string, code: string, fileName: string, lineRange: { start: number; end: number }) => void;
}

export interface FileViewerRef {
  save: () => void;
}

export const FileViewer = forwardRef<FileViewerRef, FileViewerProps>(
  ({ filePath, fileName, line, onDirtyChange, onSaved, onAskAI }, ref) => {
  const { actualTheme } = useTheme();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [externalChange, setExternalChange] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    }
  }, [filePath]);

  // Listen for external file changes
  useEffect(() => {
    const cleanup = window.electronAPI.onFileChanged?.((_, event) => {
      if (filePath && event.absolutePath === filePath && event.type === 'change') {
        console.log('[FileViewer] File changed externally:', filePath);
        setExternalChange(true);
      }
    });

    return () => {
      cleanup?.();
    };
  }, [filePath]);

  const loadFile = async (path: string) => {
    setLoading(true);
    try {
      const fileContent = await window.electronAPI.readFile(path);
      if (fileContent !== null) {
        setContent(fileContent);
        setIsDirty(false);
        // Update editor content if mounted
        if (editorRef.current) {
          editorRef.current.setValue(fileContent);
        }
      } else {
        console.error('File content is null');
        alert('Failed to read file');
      }
    } catch (error) {
      console.error('Error loading file:', error);
      alert(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!filePath || !editorRef.current) return;

    const currentContent = editorRef.current.getValue();
    const success = await window.electronAPI.writeFile(filePath, currentContent);
    if (success) {
      setContent(currentContent); // Update saved state
      setIsDirty(false);
      onDirtyChange?.(false);
      onSaved?.();
    } else {
      alert('Failed to save file');
    }
  };

  // Expose save function to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave
  }));

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      const isModified = value !== content;
      setIsDirty(isModified);
      onDirtyChange?.(isModified);
    }
  };

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Add AI context menu actions if callback is provided
    if (onAskAI && fileName) {
      // Helper to get selected code and line range
      const getSelection = () => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!selection || !model) return null;

        const selectedText = model.getValueInRange(selection);
        if (!selectedText) return null;

        return {
          code: selectedText,
          lineRange: {
            start: selection.startLineNumber,
            end: selection.endLineNumber
          }
        };
      };

      // Add context menu actions
      editor.addAction({
        id: 'ai-explain',
        label: '🤖 Ask AI to Explain',
        contextMenuGroupId: 'ai-actions',
        contextMenuOrder: 1,
        precondition: 'editorHasSelection',
        run: () => {
          const sel = getSelection();
          if (sel) {
            onAskAI(
              'Please explain this code:',
              sel.code,
              fileName,
              sel.lineRange
            );
          }
        }
      });

      editor.addAction({
        id: 'ai-refactor',
        label: '🤖 Ask AI to Refactor',
        contextMenuGroupId: 'ai-actions',
        contextMenuOrder: 2,
        precondition: 'editorHasSelection',
        run: () => {
          const sel = getSelection();
          if (sel) {
            onAskAI(
              'Please refactor this code to improve it:',
              sel.code,
              fileName,
              sel.lineRange
            );
          }
        }
      });

      editor.addAction({
        id: 'ai-fix',
        label: '🤖 Ask AI to Fix Bug',
        contextMenuGroupId: 'ai-actions',
        contextMenuOrder: 3,
        precondition: 'editorHasSelection',
        run: () => {
          const sel = getSelection();
          if (sel) {
            onAskAI(
              'Please help me fix any bugs in this code:',
              sel.code,
              fileName,
              sel.lineRange
            );
          }
        }
      });

      editor.addAction({
        id: 'ai-comment',
        label: '🤖 Ask AI to Add Comments',
        contextMenuGroupId: 'ai-actions',
        contextMenuOrder: 4,
        precondition: 'editorHasSelection',
        run: () => {
          const sel = getSelection();
          if (sel) {
            onAskAI(
              'Please add helpful comments to this code:',
              sel.code,
              fileName,
              sel.lineRange
            );
          }
        }
      });

      editor.addAction({
        id: 'ai-optimize',
        label: '🤖 Ask AI to Optimize',
        contextMenuGroupId: 'ai-actions',
        contextMenuOrder: 5,
        precondition: 'editorHasSelection',
        run: () => {
          const sel = getSelection();
          if (sel) {
            onAskAI(
              'Please optimize this code for better performance:',
              sel.code,
              fileName,
              sel.lineRange
            );
          }
        }
      });
    }
  };

  // Scroll to specific line when provided
  useEffect(() => {
    if (editorRef.current && line && line > 0) {
      // Small delay to ensure editor is fully rendered
      setTimeout(() => {
        editorRef.current?.revealLineInCenter(line);
        editorRef.current?.setPosition({ lineNumber: line, column: 1 });
        editorRef.current?.focus();
      }, 100);
    }
  }, [line, filePath]);

  const getLanguage = (filename: string | null): string => {
    if (!filename) return 'plaintext';
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'css': 'css',
      'html': 'html',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  if (!filePath) {
    return (
      <div className="file-viewer empty">
        <div className="empty-state">
          <span className="empty-icon"><FileText size={64} /></span>
          <p>Select a file to view</p>
        </div>
      </div>
    );
  }

  const renderBreadcrumbs = () => {
    if (!filePath) return null;
    const parts = filePath.split('/');
    return (
      <div className="file-breadcrumbs">
        {parts.map((part, index) => (
          <span key={index} className="breadcrumb-item">
            {index > 0 && <span className="breadcrumb-separator">/</span>}
            <span className={index === parts.length - 1 ? 'breadcrumb-current' : 'breadcrumb-path'}>
              {part}
            </span>
          </span>
        ))}
      </div>
    );
  };

  const handleReload = async () => {
    if (filePath) {
      await loadFile(filePath);
      setExternalChange(false);
    }
  };

  return (
    <div className="file-viewer">
      {externalChange && (
        <div className="external-change-banner">
          <span><AlertTriangle size={16} /> This file has been changed externally</span>
          <div className="banner-actions">
            <button className="banner-button" onClick={handleReload}>Reload</button>
            <button className="banner-button dismiss" onClick={() => setExternalChange(false)}>Dismiss</button>
          </div>
        </div>
      )}
      <div className="file-viewer-header">
        <div className="file-info">
          <span className="file-icon"><FileText size={16} /></span>
          <div className="file-path-container">
            <span className="file-name">{fileName}</span>
            {renderBreadcrumbs()}
          </div>
          {isDirty && <span className="dirty-indicator">●</span>}
        </div>
        <button
          className="save-button"
          onClick={handleSave}
          disabled={!isDirty || loading}
        >
          Save
        </button>
      </div>

      {loading ? (
        <div className="file-viewer-loading">Loading...</div>
      ) : (
        <Suspense fallback={<div className="file-viewer-loading">Loading editor...</div>}>
          <Editor
            height="100%"
            language={getLanguage(fileName)}
            defaultValue={content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme={actualTheme === 'light' ? 'vs-light' : 'vs-dark'}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              lineNumbers: 'on',
            }}
          />
        </Suspense>
      )}
    </div>
  );
});
