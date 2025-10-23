import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import Editor from '@monaco-editor/react';
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
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    }
  }, [filePath]);

  const loadFile = async (path: string) => {
    setLoading(true);
    try {
      const fileContent = await window.electronAPI.readFile(path);
      if (fileContent !== null) {
        setContent(fileContent);
        setIsDirty(false);
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
    if (!filePath) return;

    const success = await window.electronAPI.writeFile(filePath, content);
    if (success) {
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
      setContent(value);
      const newIsDirty = true;
      setIsDirty(newIsDirty);
      onDirtyChange?.(newIsDirty);
    }
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

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <div className="file-info">
          <span className="file-icon">📄</span>
          <span className="file-name">{fileName}</span>
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
          value={content}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      )}
    </div>
  );
});
