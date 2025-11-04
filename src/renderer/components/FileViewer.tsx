import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useTheme } from '../contexts/ThemeContext';
import './FileViewer.css';

interface FileViewerProps {
  filePath: string | null;
  fileName: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
  onSaved?: () => void;
}

export interface FileViewerRef {
  save: () => void;
}

export const FileViewer = forwardRef<FileViewerRef, FileViewerProps>(
  ({ filePath, fileName, onDirtyChange, onSaved }, ref) => {
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
  };

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
          <span className="empty-icon">📄</span>
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
          <span>⚠️ This file has been changed externally</span>
          <div className="banner-actions">
            <button className="banner-button" onClick={handleReload}>Reload</button>
            <button className="banner-button dismiss" onClick={() => setExternalChange(false)}>Dismiss</button>
          </div>
        </div>
      )}
      <div className="file-viewer-header">
        <div className="file-info">
          <span className="file-icon">📄</span>
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
      )}
    </div>
  );
});
