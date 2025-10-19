import { useState, useEffect } from 'react';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
}

interface SettingsData {
  apiKey: string;
  model: string;
}

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet (Latest)' },
  { id: 'claude-sonnet-3-5-20241022', name: 'Claude 3.5 Sonnet' },
];

export function Settings({ onClose }: SettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-5-20250929');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load settings from electron store and localStorage
    const loadSettings = async () => {
      // Try electron store first
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings();
        if (settings) {
          setApiKey(settings.apiKey || '');
          setModel(settings.model || 'claude-sonnet-4-5-20250929');
          return;
        }
      }

      // Fallback to localStorage
      const savedSettings = localStorage.getItem('app_settings');
      if (savedSettings) {
        const settings: SettingsData = JSON.parse(savedSettings);
        setApiKey(settings.apiKey || '');
        setModel(settings.model || 'claude-sonnet-4-5-20250929');
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);

    const settings: SettingsData = {
      apiKey,
      model,
    };

    // Save to localStorage
    localStorage.setItem('app_settings', JSON.stringify(settings));

    // Also save to electron store via IPC
    if (window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings(settings);
    }

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
          <h2>⚙️ Settings</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
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
            disabled={!apiKey || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
