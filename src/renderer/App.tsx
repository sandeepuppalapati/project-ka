import { useState } from 'react'
import './App.css'
import { RepoManager } from './components/RepoManager'
import { FileTree } from './components/FileTree'
import { ChatPanel } from './components/ChatPanel'
import { FileViewer } from './components/FileViewer'

interface Repository {
  id: string;
  path: string;
  name: string;
}

function App() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [showRepoManager, setShowRepoManager] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string } | null>(null);

  const handleReposChanged = (newRepos: Repository[]) => {
    setRepos(newRepos);
    if (newRepos.length > 0) {
      setShowRepoManager(false);
    }
  };

  const handleFileSelect = (filePath: string, fileName: string) => {
    setSelectedFile({ path: filePath, name: fileName });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI IDE</h1>
        <p className="motto">For AI by AI</p>
        {repos.length > 0 && (
          <button
            className="toggle-repos"
            onClick={() => setShowRepoManager(!showRepoManager)}
          >
            {showRepoManager ? 'Hide' : 'Show'} Repos
          </button>
        )}
      </header>

      <main className="app-main">
        {showRepoManager ? (
          <div className="repo-manager-view">
            <RepoManager onReposChange={handleReposChanged} repos={repos} />
          </div>
        ) : (
          <div className="ide-layout">
            <aside className="sidebar">
              {repos.map(repo => (
                <FileTree
                  key={repo.id}
                  repoPath={repo.path}
                  repoName={repo.name}
                  onFileSelect={handleFileSelect}
                />
              ))}
            </aside>
            <section className="main-content">
              <div className="editor-section">
                <FileViewer
                  filePath={selectedFile?.path || null}
                  fileName={selectedFile?.name || null}
                />
              </div>
              <div className="chat-section">
                <ChatPanel currentFile={selectedFile} />
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>PoC: Multi-Repo + Chat UI ✨</p>
      </footer>
    </div>
  )
}

export default App
