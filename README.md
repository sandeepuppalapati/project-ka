# AI IDE - Multi-Repo AI Development Environment

> **"For AI by AI"** - An AI-powered IDE where AI agents autonomously code across multiple repositories

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/electron-34.0.0-blue.svg)
![React](https://img.shields.io/badge/react-18.3.1-blue.svg)

---

## 🎯 What is AI IDE?

AI IDE is a next-generation development environment that revolutionizes how you work with code. Unlike traditional IDEs where AI merely assists, AI IDE features **autonomous AI agents** that perform coding tasks across **multiple repositories simultaneously**.

### Key Features

✅ **Multi-Repository Management** - Work with multiple repos in a single project
✅ **Autonomous AI Agents** - AI writes, refactors, and debugs code independently
✅ **Agent Collaboration** - Multiple AI agents coordinate via a shared message bridge
✅ **Streaming Responses** - Real-time feedback as AI works
✅ **Git Integration** - Stage, commit, and push directly from the IDE
✅ **Session Persistence** - Your workspace and chat history are saved automatically
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

### 1. **Add Repositories**

Click the **"Manage Repos"** button to add local repositories to your project. You can add multiple repos and work with them simultaneously.

### 2. **Chat with AI Agents**

- **Bridge Tab**: Coordinate between multiple AI agents working on different repos
- **Repo Tabs**: Each repository gets its own AI agent with repo-specific context

### 3. **AI Does the Work**

Give natural language commands:
- "Add user authentication to the API"
- "Fix the bug in the checkout flow"
- "Refactor the database layer to use TypeORM"

The AI agent will:
1. Read relevant files
2. Execute commands as needed
3. Write/modify code
4. Provide explanations and updates

### 4. **Review & Commit**

- View changes in the file tree (modified files highlighted)
- Stage files in the Git panel
- Write commit messages and push to remote

---

## 🎨 Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│  AI IDE                                    [⚙️ Settings]     │
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
   - Settings persist across sessions

### Model Options

- `claude-sonnet-4-20250514` - Latest and most capable (recommended)
- `claude-3-5-sonnet-20241022` - Previous generation

---

## 📁 Project Structure

```
ai-ide/
├── src/
│   ├── main/          # Electron main process
│   │   ├── main.ts    # App entry point, IPC handlers
│   │   └── preload.ts # Secure IPC bridge
│   └── renderer/      # React UI
│       ├── components/
│       ├── hooks/
│       └── App.tsx
├── docs/              # Design documentation
├── dist/              # Build output
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

1. Add 2-3 related repositories
2. Ask the AI to make a change that spans repos
3. Verify the AI coordinates across repos via the Bridge
4. Test git operations (stage, commit, push)

---

## 🎯 Roadmap

### Current: MVP v0.1 ✅

- [x] Multi-repository support
- [x] Autonomous AI agents
- [x] Agent coordination via Bridge
- [x] Session persistence
- [x] Git integration
- [x] Keyboard shortcuts
- [x] Error handling & retry logic

### Coming Soon: v0.2

- [ ] Enhanced loading states with progress indicators
- [ ] Visual diff viewer
- [ ] File watching & auto-refresh
- [ ] Voice input (push-to-talk)
- [ ] Search across repos
- [ ] Terminal integration

### Future Versions

- [ ] Local model support (Ollama)
- [ ] Plugin system
- [ ] Collaborative workspaces
- [ ] Cost tracking & optimization

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

---

**Built with ❤️ for developers who want AI to do the heavy lifting**

*Last updated: October 23, 2025*
