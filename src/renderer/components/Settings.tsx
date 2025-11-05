import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Settings as SettingsIcon, AlertTriangle, Folder, Trash2, FileText, Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
}

interface SettingsData {
  apiKey: string;
  model: string;
  openaiApiKey?: string;
  workspacePath?: string;
}

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet (Latest)' },
  { id: 'claude-sonnet-3-5-20241022', name: 'Claude 3.5 Sonnet' },
];

export function Settings({ onClose }: SettingsProps) {
  const { theme, setTheme } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-5-20250929');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenaiApiKey, setShowOpenaiApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [logLevel, setLogLevel] = useState<string>('info');

  useEffect(() => {
    // Load settings from electron store and localStorage
    const loadSettings = async () => {
      // Get default workspace path
      if (window.electronAPI?.getDefaultWorkspacePath) {
        const defaultPath = await window.electronAPI.getDefaultWorkspacePath();
        setWorkspacePath(defaultPath);
      }

      // Try electron store first
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings();
        if (settings) {
          setApiKey(settings.apiKey || '');
          setModel(settings.model || 'claude-sonnet-4-5-20250929');
          setOpenaiApiKey(settings.openaiApiKey || '');
          return;
        }
      }

      // Fallback to localStorage
      const savedSettings = localStorage.getItem('app_settings');
      if (savedSettings) {
        const settings: SettingsData = JSON.parse(savedSettings);
        setApiKey(settings.apiKey || '');
        setModel(settings.model || 'claude-sonnet-4-5-20250929');
        setOpenaiApiKey(settings.openaiApiKey || '');
        if (settings.workspacePath) {
          setWorkspacePath(settings.workspacePath);
        }
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    // Load log files and log level
    const loadLogs = async () => {
      if (window.electronAPI?.getLogFiles) {
        const files = await window.electronAPI.getLogFiles();
        setLogFiles(files);
        if (files.length > 0) {
          setSelectedLogFile(files[0]); // Select most recent log by default
        }
      }
      if (window.electronAPI?.getLogLevel) {
        const level = await window.electronAPI.getLogLevel();
        setLogLevel(level);
      }
    };
    loadLogs();
  }, []);

  useEffect(() => {
    // Load selected log file content
    const loadLogContent = async () => {
      if (selectedLogFile && window.electronAPI?.readLogFile) {
        const content = await window.electronAPI.readLogFile(selectedLogFile);
        setLogContent(content);
      }
    };
    loadLogContent();
  }, [selectedLogFile]);

  const handleSave = async () => {
    setIsSaving(true);
    setValidationError(null);

    // Validate API key first
    if (window.electronAPI?.validateApiKey) {
      setIsValidating(true);
      const result = await window.electronAPI.validateApiKey(apiKey);
      setIsValidating(false);

      if (!result.valid) {
        setValidationError(result.error || 'Invalid API key');
        setIsSaving(false);
        return;
      }
    }

    const settings: SettingsData = {
      apiKey,
      model,
      openaiApiKey,
      workspacePath,
    };

    // Save to localStorage
    localStorage.setItem('app_settings', JSON.stringify(settings));

    // Also save to electron store via IPC
    if (window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings(settings);
    }

    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('settings-updated', {
      detail: settings
    }));

    setIsSaving(false);
    onClose();
  };

  const handleClearStorage = () => {
    if (confirm('Clear all storage?\n\nThis will delete:\n- All chat history (Bridge and agent chats)\n- All workspace state (open tabs, etc.)\n- Repository list\n- Settings\n\nThis cannot be undone. Continue?')) {
      // Clear all localStorage
      localStorage.clear();

      // Trigger storage event for instant sync
      window.dispatchEvent(new StorageEvent('storage', {
        key: null,
        newValue: null,
        oldValue: null,
        storageArea: localStorage,
        url: window.location.href,
      }));

      alert('Storage cleared! The app will now reload.');
      window.location.reload();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleLogLevelChange = async (level: string) => {
    setLogLevel(level);
    if (window.electronAPI?.setLogLevel) {
      await window.electronAPI.setLogLevel(level);
    }
  };

  const handleClearLogs = async () => {
    if (confirm('Clear all log files? This cannot be undone.')) {
      if (window.electronAPI?.clearLogs) {
        await window.electronAPI.clearLogs();
        setLogFiles([]);
        setSelectedLogFile(null);
        setLogContent('');
      }
    }
  };

  const handleDownloadLog = () => {
    if (!logContent) return;
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedLogFile || 'log.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatLogLine = (line: string) => {
    try {
      const log = JSON.parse(line);
      const levelClass = `log-level-${log.level}`;
      return (
        <div key={log.timestamp} className={`log-line ${levelClass}`}>
          <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
          <span className={`log-level ${levelClass}`}>{log.level.toUpperCase()}</span>
          <span className="log-category">[{log.category}]</span>
          <span className="log-message">{log.message}</span>
          {log.data && <span className="log-data">{JSON.stringify(log.data)}</span>}
        </div>
      );
    } catch {
      return <div key={line} className="log-line">{line}</div>;
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="settings-header">
          <div>
            <h2><SettingsIcon size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} /> Settings</h2>
            <p className="settings-version">AI IDE v0.6.0</p>
          </div>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <label>Theme</label>
            <div className="theme-selector">
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                title="Light theme"
              >
                <Sun size={18} />
                <span>Light</span>
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                title="Dark theme"
              >
                <Moon size={18} />
                <span>Dark</span>
              </button>
              <button
                className={`theme-option ${theme === 'auto' ? 'active' : ''}`}
                onClick={() => setTheme('auto')}
                title="Auto (system preference)"
              >
                <Monitor size={18} />
                <span>Auto</span>
              </button>
            </div>
            <p className="settings-help">
              Choose your preferred color theme or follow system settings
            </p>
          </div>

          <div className="settings-section">
            <label htmlFor="api-key">
              Anthropic API Key
              <span className="required">*</span>
            </label>
            <div className="api-key-input-group">
              <input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="settings-input"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {validationError && (
              <p className="settings-error">
                <AlertTriangle size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                {validationError}
              </p>
            )}
            <p className="settings-help">
              Get your API key from{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                Anthropic Console
              </a>
            </p>
          </div>

          <div className="settings-section">
            <label htmlFor="model">
              AI Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="settings-select"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="settings-help">
              Claude 4.5 Sonnet is recommended for best performance
            </p>
          </div>

          <div className="settings-section">
            <label htmlFor="openai-api-key">
              OpenAI API Key (Optional - for voice input)
            </label>
            <div className="api-key-input-group">
              <input
                id="openai-api-key"
                type={showOpenaiApiKey ? 'text' : 'password'}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="settings-input"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowOpenaiApiKey(!showOpenaiApiKey)}
                title={showOpenaiApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showOpenaiApiKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="settings-help">
              Required for voice input feature. Get your API key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                OpenAI Platform
              </a>
            </p>
          </div>

          <div className="settings-section">
            <label htmlFor="workspace-path">
              Default Workspace Path
            </label>
            <div className="workspace-path-input-group">
              <input
                id="workspace-path"
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="~/Documents/ai-ide-workspaces"
                className="settings-input"
              />
              <button
                type="button"
                className="browse-button"
                onClick={async () => {
                  const folders = await window.electronAPI.openFolder();
                  if (folders && folders.length > 0) {
                    setWorkspacePath(folders[0]);
                  }
                }}
                title="Browse for folder"
              >
                <Folder size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Browse
              </button>
            </div>
            <p className="settings-help">
              Location where workspace folders will be created. Each workspace stores chats, state, and settings.
            </p>
          </div>

          <div className="settings-section">
            <label>Application Logs</label>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Log Level</label>
              <select
                value={logLevel}
                onChange={(e) => handleLogLevelChange(e.target.value)}
                className="settings-input"
                style={{ width: '200px' }}
              >
                <option value="debug">Debug (verbose)</option>
                <option value="info">Info (default)</option>
                <option value="warn">Warning</option>
                <option value="error">Error only</option>
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Log Files</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={selectedLogFile || ''}
                  onChange={(e) => setSelectedLogFile(e.target.value)}
                  className="settings-input"
                  style={{ flex: 1 }}
                >
                  {logFiles.map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                  {logFiles.length === 0 && <option value="">No logs available</option>}
                </select>
                <button
                  className="settings-button secondary"
                  onClick={handleDownloadLog}
                  disabled={!logContent}
                  type="button"
                  style={{ padding: '6px 12px' }}
                >
                  <Download size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Download
                </button>
                <button
                  className="settings-button danger"
                  onClick={handleClearLogs}
                  disabled={logFiles.length === 0}
                  type="button"
                  style={{ padding: '6px 12px' }}
                >
                  <Trash2 size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Clear All
                </button>
              </div>
            </div>
            {logContent && (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '12px',
                maxHeight: '300px',
                overflow: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                {logContent.split('\n').filter(line => line.trim()).map((line, idx) => (
                  <div key={idx}>{formatLogLine(line)}</div>
                ))}
              </div>
            )}
            <p className="settings-help">
              Application logs for debugging and monitoring. Logs are kept for 7 days and rotated automatically.
            </p>
          </div>

          <div className="settings-section">
            <label>Storage Management</label>
            <button
              className="settings-button danger"
              onClick={handleClearStorage}
              type="button"
            >
              <Trash2 size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Clear All Storage
            </button>
            <p className="settings-help">
              Deletes all chat history, workspace state, repositories, and settings. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="settings-button primary"
            onClick={handleSave}
            disabled={!apiKey || isSaving || isValidating}
          >
            {isValidating ? 'Validating...' : isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
