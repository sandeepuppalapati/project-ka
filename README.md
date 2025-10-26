# AI IDE - Multi-Repo AI Development Environment

> **"For AI by AI"** - An AI-powered IDE where AI agents autonomously code across multiple repositories

![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/electron-34.0.0-blue.svg)
![React](https://img.shields.io/badge/react-18.3.1-blue.svg)

---

## 🎯 What is AI IDE?

AI IDE is a next-generation development environment that revolutionizes how you work with code. Unlike traditional IDEs where AI merely assists, AI IDE features **autonomous AI agents** that perform coding tasks across **multiple repositories simultaneously**.

### Key Features

✅ **Workspace Management** - Organize projects with virtual groupings of repositories
✅ **Multi-Repository Management** - Work with multiple repos in a single workspace
✅ **Autonomous AI Agents** - AI writes, refactors, and debugs code independently
✅ **Agent Collaboration** - Multiple AI agents coordinate via a shared message bridge
✅ **Streaming Responses** - Real-time feedback as AI works
✅ **Git Integration** - Stage, commit, and push directly from the IDE
✅ **Session Persistence** - All workspace data encrypted and saved automatically
✅ **Smart Search** - Find workspaces by name, description, or tags
✅ **Modern UI** - Beautiful teal-themed interface with Monaco editor

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Anthropic API Key** ([Get one here](https://console.anthropic.com/))
- **Git** installed on your system

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-ide.git
   cd ai-ide
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your API key**

   Create a `.env` file in the root directory:
   ```bash
   ANTHROPIC_API_KEY=your_api_key_here
   ANTHROPIC_MODEL=claude-sonnet-4-20250514
   ```

4. **Run the application**
   ```bash
   npm run dev
   ```

The IDE will launch in development mode with hot reloading enabled.

---

## 📖 How It Works

### 1. **Create or Open a Workspace**

On first launch, you'll see a welcome screen where you can:
- **Create a new workspace** - Give it a name, description, and optional tags
- **Open an existing workspace** - Select from your list of workspaces
- **Search workspaces** - Filter by name, description, or tags

All workspace data (repos, chats, settings) is encrypted and stored locally.

### 2. **Add Repositories**

Click the **"Manage Repos"** button to add local repositories to your workspace. You can add multiple repos and work with them simultaneously. Each workspace maintains its own set of repositories.

### 3. **Chat with AI Agents**

- **Bridge Tab**: Coordinate between multiple AI agents working on different repos (workspace-specific)
- **Repo Tabs**: Each repository gets its own AI agent with repo-specific context
- All chat history is saved per workspace and persists across sessions

### 4. **AI Does the Work**

Give natural language commands:
- "Add user authentication to the API"
- "Fix the bug in the checkout flow"
- "Refactor the database layer to use TypeORM"

The AI agent will:
1. Read relevant files
2. Execute commands as needed
3. Write/modify code
4. Provide explanations and updates

### 5. **Review & Commit**

- View changes in the file tree (modified files highlighted)
- Stage files in the Git panel
- Write commit messages and push to remote

### 6. **Switch Workspaces**

Click the workspace selector in the header to switch between workspaces. Each workspace remembers:
- Open files and cursor positions
- Expanded folders in the file tree
- Chat history with AI agents
- UI layout preferences

---

## 🎨 Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│  [⚡ My Workspace ▼] [Edit] [Manage Repos]    [⚙️ Settings] │
├──────────┬──────────────────────┬───────────────────────────┤
│          │                      │                           │
│  File    │   Code Editor        │    Chat with AI           │
│  Tree    │   (Monaco)           │    ┌─────────────────┐   │
│          │                      │    │ Bridge  │ Repo1 │   │
│  📁 repo1│                      │    └─────────────────┘   │
│  📁 repo2│                      │    [Chat Messages]        │
│          │                      │    [Bridge Activity]      │
│          │                      │    [Input Area]           │
│  Git     │                      │                           │
│  Panel   │                      │                           │
└──────────┴──────────────────────┴───────────────────────────┘
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Send message |
| `Cmd/Ctrl + K` | Focus chat input |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + /` | Show shortcuts modal |
| `Escape` | Cancel operation |

---

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 34
- **Editor**: Monaco Editor
- **Git**: isomorphic-git
- **AI**: Anthropic Claude API (Sonnet 4)
- **Build**: Vite + TypeScript

### How AI Agents Work

AI agents use Anthropic's **Tool Use API** to:
- `read_file` - Read file contents
- `write_file` - Create or modify files
- `execute_command` - Run shell commands
- `post_to_bridge` - Communicate with other agents

Agents work **autonomously** in a multi-step loop:
1. Receive task from user
2. Plan approach
3. Use tools to gather info and make changes
4. Verify results
5. Report completion

---

## 🔧 Configuration

### API Settings

You can configure your AI settings in two ways:

1. **Environment Variables** (`.env` file)
   ```
   ANTHROPIC_API_KEY=your_key
   ANTHROPIC_MODEL=claude-sonnet-4-20250514
   ```

2. **Settings Panel** (⚙️ button in header)
   - Update API key
   - Switch between Claude models
   - Settings persist globally across all workspaces

### Model Options

- `claude-sonnet-4-20250514` - Latest and most capable (recommended)
- `claude-3-5-sonnet-20241022` - Previous generation

### Workspace Settings

Configure where workspace data is stored:
- **Default Path**: `~/Documents/ai-ide-workspaces/` (configurable)
- **Data Storage**: All workspace files are encrypted at rest using OS-level encryption
  - **macOS**: Keychain
  - **Windows**: DPAPI
  - **Linux**: Secret Service API / libsecret

---

## 📁 Project Structure

```
ai-ide/
├── src/
│   ├── main/                # Electron main process
│   │   ├── main.ts          # App entry point, IPC handlers
│   │   ├── preload.ts       # Secure IPC bridge
│   │   └── workspace.ts     # Workspace file operations (encrypted)
│   └── renderer/            # React UI
│       ├── components/
│       │   ├── WorkspaceWelcome.tsx
│       │   ├── CreateWorkspace.tsx
│       │   ├── EditWorkspace.tsx
│       │   └── ...
│       ├── hooks/
│       ├── types/
│       │   └── workspace.d.ts
│       └── App.tsx
├── docs/                    # Design documentation
│   └── WORKSPACE_DESIGN.md  # Workspace architecture
├── dist/                    # Build output
└── package.json
```

---

## 🛠️ Development

### Build Commands

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Run production build
npm start
```

### Development Workflow

1. **Main process** (`npm run dev:main`): Compiles TypeScript and launches Electron
2. **Renderer process** (`npm run dev:renderer`): Vite dev server for React UI
3. Both run concurrently via `npm run dev`

---

## 🧪 Testing

Test the IDE with a real multi-repo project:

1. Create a workspace with a descriptive name and tags
2. Add 2-3 related repositories to the workspace
3. Ask the AI to make a change that spans repos
4. Verify the AI coordinates across repos via the Bridge
5. Test git operations (stage, commit, push)
6. Switch to another workspace and verify state isolation
7. Search for workspaces by name or tags

---

## 🎯 Roadmap

### v0.1 - MVP ✅

- [x] Multi-repository support
- [x] Autonomous AI agents
- [x] Agent coordination via Bridge
- [x] Session persistence
- [x] Git integration
- [x] Keyboard shortcuts
- [x] Error handling & retry logic

### v0.2 - Enhanced UI ✅

- [x] Improved loading states and progress indicators
- [x] Polished header with consistent button heights
- [x] Better error messages and user feedback

### v0.3 - Workspaces ✅ (Current)

- [x] Workspace creation and management
- [x] Encrypted workspace storage
- [x] Workspace metadata (description, tags, lastAccessed)
- [x] Search and filter workspaces
- [x] Edit workspace details
- [x] Two-column welcome layout
- [x] Workspace-specific Bridge chat
- [x] State persistence per workspace

### v0.4 - Coming Soon

- [ ] Visual diff viewer
- [ ] File watching & auto-refresh
- [ ] Voice input (push-to-talk)
- [ ] Search across repos within workspace
- [ ] Terminal integration
- [ ] Multiple workspace windows

### Future Versions

- [ ] Local model support (Ollama)
- [ ] Plugin system
- [ ] Workspace templates
- [ ] Import/export workspace configuration
- [ ] Cost tracking & optimization
- [ ] Collaborative workspaces (team sharing)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Anthropic** for the Claude API and Tool Use capabilities
- **Monaco Editor** team for the excellent code editor
- **Electron** and **React** communities

---

## 📞 Support & Community

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-ide/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-ide/discussions)

---

## ⚠️ Important Notes

### API Costs

AI IDE uses the Anthropic Claude API (bring your own key). Costs vary based on usage:
- **Sonnet 4**: ~$3 per million input tokens, ~$15 per million output tokens
- Average session: $0.10-$0.50
- Monitor your usage at [console.anthropic.com](https://console.anthropic.com/)

### Security

- Never commit your `.env` file
- Keep your API key secure
- Review AI-generated code before committing
- Use git carefully - AI has full file system access within repos
- All workspace data is encrypted at rest using OS-level security
- Workspaces are stored locally on your machine only

---

**Built with ❤️ for developers who want AI to do the heavy lifting**

*Last updated: October 26, 2025*
