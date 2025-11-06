import { Files, GitBranch, MessageSquare, Terminal, Settings, FlaskConical } from 'lucide-react';
import './ActivityBar.css';

type ActivityView = 'files' | 'git' | 'chat' | 'tests' | 'terminal' | 'settings';

interface ActivityBarProps {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
  showTerminal: boolean;
}

export function ActivityBar({ activeView, onViewChange, showTerminal }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <div className="activity-bar-items">
        <button
          className={`activity-bar-item ${activeView === 'files' ? 'active' : ''}`}
          onClick={() => onViewChange('files')}
          title="Files (Ctrl+Shift+E)"
        >
          <Files size={24} />
        </button>

        <button
          className={`activity-bar-item ${activeView === 'git' ? 'active' : ''}`}
          onClick={() => onViewChange('git')}
          title="Source Control (Ctrl+Shift+G)"
        >
          <GitBranch size={24} />
        </button>

        <button
          className={`activity-bar-item ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => onViewChange('chat')}
          title="AI Chat"
        >
          <MessageSquare size={24} />
        </button>

        <button
          className={`activity-bar-item ${activeView === 'tests' ? 'active' : ''}`}
          onClick={() => onViewChange('tests')}
          title="Test Runner"
        >
          <FlaskConical size={24} />
        </button>
      </div>

      <div className="activity-bar-items bottom">
        <button
          className={`activity-bar-item ${showTerminal ? 'active' : ''}`}
          onClick={() => onViewChange('terminal')}
          title="Terminal (Ctrl+`)"
        >
          <Terminal size={24} />
        </button>

        <button
          className={`activity-bar-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => onViewChange('settings')}
          title="Settings"
        >
          <Settings size={24} />
        </button>
      </div>
    </div>
  );
}
