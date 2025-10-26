import './WorkspaceWelcome.css';

interface WorkspaceWelcomeProps {
  onCreateWorkspace: () => void;
}

export function WorkspaceWelcome({ onCreateWorkspace }: WorkspaceWelcomeProps) {
  return (
    <div className="workspace-welcome">
      <div className="workspace-welcome-content">
        <div className="workspace-welcome-icon">⚡</div>
        <h1>Welcome to AI IDE</h1>
        <p className="workspace-welcome-subtitle">For AI by AI</p>

        <div className="workspace-welcome-message">
          <p>Get started by creating your first workspace.</p>
          <p>A workspace organizes your repositories, chats, and AI agents in one place.</p>
        </div>

        <button className="workspace-welcome-button" onClick={onCreateWorkspace}>
          <span className="workspace-welcome-button-icon">⚡</span>
          Create Your First Workspace
        </button>

        <div className="workspace-welcome-features">
          <div className="workspace-feature">
            <span className="feature-icon">🔐</span>
            <div className="feature-text">
              <strong>Encrypted Storage</strong>
              <span>Your data is encrypted at rest</span>
            </div>
          </div>
          <div className="workspace-feature">
            <span className="feature-icon">💬</span>
            <div className="feature-text">
              <strong>Persistent Chats</strong>
              <span>All conversations saved per workspace</span>
            </div>
          </div>
          <div className="workspace-feature">
            <span className="feature-icon">🎯</span>
            <div className="feature-text">
              <strong>Organized Projects</strong>
              <span>Group related repos together</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
