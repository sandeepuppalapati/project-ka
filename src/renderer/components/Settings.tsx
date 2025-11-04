import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Settings as SettingsIcon } from 'lucide-react';
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
                ⚠️ {validationError}
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
                📁 Browse
              </button>
            </div>
            <p className="settings-help">
              Location where workspace folders will be created. Each workspace stores chats, state, and settings.
            </p>
          </div>

          <div className="settings-section">
            <label>Storage Management</label>
            <button
              className="settings-button danger"
              onClick={handleClearStorage}
              type="button"
            >
              🗑️ Clear All Storage
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
