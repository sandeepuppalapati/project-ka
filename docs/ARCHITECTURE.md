# AI-Based IDE - System Architecture

**Date**: 2025-10-17 (Recreated)
**Status**: Phase 3 Complete - Autonomous AI Agent Working

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Desktop Application                      │
│                    (Electron + React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │              │  │              │  │              │     │
│  │  Chat Panel  │  │  File Tree   │  │  Code Viewer │     │
│  │   (Voice)    │  │   (Multi-    │  │   (Monaco)   │     │
│  │              │  │    Repo)     │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                     Main Process (Node.js)                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │              │  │              │  │              │     │
│  │  AI Engine   │  │  File System │  │  Git Manager │     │
│  │  (Tool Use)  │  │   Handler    │  │              │     │
│  │              │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├── Anthropic Claude API
                              ├── Local File System
                              └── Git Repositories
```

---

## Technology Stack

### Frontend (Renderer Process)
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **CSS** - Custom styling (no framework)

### Backend (Main Process)
- **Node.js** - Runtime
- **Electron** - Desktop framework
- **TypeScript** - Type safety

### Key Libraries
- **@anthropic-ai/sdk** - Claude AI integration
- **isomorphic-git** - Git operations (pure JS)
- **dotenv** - Environment configuration
- **child_process** - Shell command execution

### Development Tools
- **TypeScript Compiler** - Type checking
- **ESLint** - Code linting (planned)
- **Prettier** - Code formatting (planned)

---

## Component Architecture

### 1. Renderer Process (Frontend)

```
src/renderer/
├── App.tsx                    # Main application component
├── components/
│   ├── ChatPanel.tsx          # AI chat interface
│   ├── ChatPanel.css          # Chat styling
│   ├── FileTree.tsx           # Repository file browser
│   ├── FileTree.css           # File tree styling
│   ├── CodeEditor.tsx         # Monaco editor wrapper
│   └── GitPanel.tsx           # Git operations UI
├── types/
│   └── electron.d.ts          # TypeScript definitions
└── index.tsx                  # React entry point
```

### 2. Main Process (Backend)

```
src/main/
├── main.ts                    # Electron main process
├── preload.ts                 # Context bridge (IPC)
└── types/
    └── index.d.ts             # Shared type definitions
```

---

## Data Flow

### User → AI → Tool Execution → Response

```
1. User types message in ChatPanel
   ↓
2. ChatPanel → sendChatMessage(messages, context)
   ↓
3. IPC Bridge → Main Process
   ↓
4. Main Process → Anthropic API (with tools)
   ↓
5. Claude decides: text response OR tool call
   ↓
6. If tool call:
   a. Execute tool (read_file, write_file, execute_command)
   b. Return result to Claude
   c. Claude continues (up to 10 iterations)
   ↓
7. Final response → IPC Bridge → ChatPanel
   ↓
8. User sees result
```

---

## IPC (Inter-Process Communication) API

### File System

```typescript
readDir(dirPath: string): Promise<DirEntry[]>
readFile(filePath: string): Promise<string>
writeFile(filePath: string, content: string): Promise<boolean>
```

### Git Operations

```typescript
isRepo(repoPath: string): Promise<boolean>
getGitStatus(repoPath: string): Promise<GitStatus>
getCurrentBranch(repoPath: string): Promise<string>
getStatusMatrix(repoPath: string): Promise<FileStatus[]>
gitAdd(repoPath: string, filepath: string): Promise<boolean>
gitRemove(repoPath: string, filepath: string): Promise<boolean>
gitCommit(repoPath: string, message: string): Promise<string>
gitPush(repoPath: string): Promise<boolean>
```

### AI & Commands

```typescript
sendChatMessage(
  messages: Message[],
  context?: {
    filePath?: string
    fileContent?: string
    repoPath?: string
  }
): Promise<string>

executeCommand(command: string, cwd?: string): Promise<CommandResult>
```

---

## AI Engine Architecture

### Tool Use API Integration

```typescript
// Tools available to AI
const tools = [
  {
    name: 'read_file',
    input_schema: {
      file_path: string // Absolute path
    }
  },
  {
    name: 'write_file',
    input_schema: {
      file_path: string,
      content: string
    }
  },
  {
    name: 'execute_command',
    input_schema: {
      command: string,
      cwd?: string // Working directory
    }
  }
]
```

### Execution Loop

```typescript
while (iterations < 10) {
  // Call Claude with tools
  response = await anthropic.messages.create({
    tools,
    messages: conversationHistory
  })

  // Check if AI wants to use tools
  toolCalls = response.content.filter(block => block.type === 'tool_use')

  if (toolCalls.length === 0) break // Done

  // Execute each tool
  for (tool of toolCalls) {
    result = await executeTool(tool)
    toolResults.push(result)
  }

  // Add results to conversation
  conversationHistory.push({
    role: 'assistant',
    content: response.content
  })

  conversationHistory.push({
    role: 'user',
    content: toolResults
  })
}
```

---

## State Management

### Repository State

```typescript
interface Repository {
  id: string
  path: string
  name: string
  branch: string
  gitStatus: GitStatus
}

// Managed in App.tsx
const [repos, setRepos] = useState<Repository[]>([])
```

### File Tabs State

```typescript
interface FileTab {
  path: string
  name: string
  content: string
  isDirty: boolean
}

const [fileTabs, setFileTabs] = useState<FileTab[]>([])
const [activeTab, setActiveTab] = useState<string | null>(null)
```

### Chat State

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'command'
  content: string
  timestamp: Date
  command?: {
    command: string
    cwd?: string
    output?: CommandResult
    collapsed?: boolean
  }
}

const [messages, setMessages] = useState<Message[]>([])
```

---

## Security Architecture

### Context Isolation

```typescript
// preload.ts - Context Bridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Only expose safe APIs
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  // Direct file system access blocked from renderer
})
```

### API Key Protection

- Stored in `.env` file (gitignored)
- Only accessible from main process
- Never sent to renderer
- Loaded via dotenv

### Command Execution Safety

```typescript
// Sanitization (future enhancement)
function sanitizeCommand(cmd: string): string {
  // Block dangerous commands
  const blacklist = ['rm -rf /', 'sudo', 'format']
  // Validate and sanitize
  return cmd
}
```

---

## Performance Considerations

### File Tree Optimization

- **Lazy Loading**: Load directories on-demand
- **Virtual Scrolling**: Only render visible items
- **Caching**: Cache directory contents

### AI Response Optimization

- **Streaming** (planned): Show tokens as they arrive
- **Caching**: Cache file contents for context
- **Batching**: Batch multiple file reads

### Memory Management

- **Tab Limits**: Max 10 open tabs
- **Message History**: Limit to last 50 messages
- **Git Operations**: Lazy git status updates

---

## Error Handling

### AI Errors

```typescript
try {
  response = await anthropic.messages.create(...)
} catch (error) {
  if (error.status === 429) {
    // Rate limit - wait and retry
  } else if (error.status === 401) {
    // Invalid API key - show error
  } else {
    // Generic error - show to user
  }
}
```

### File System Errors

```typescript
try {
  content = await fs.readFile(path)
} catch (error) {
  if (error.code === 'ENOENT') {
    return { error: 'File not found' }
  } else if (error.code === 'EACCES') {
    return { error: 'Permission denied' }
  }
}
```

### Git Errors

```typescript
try {
  await git.commit(...)
} catch (error) {
  if (error.code === 'NoCommits') {
    // Initial commit - handle differently
  } else {
    // Generic git error
  }
}
```

---

## Build & Deployment

### Development Mode

```bash
# Terminal 1: Renderer (Vite dev server)
npm run dev:renderer  # localhost:3000

# Terminal 2: Main (TypeScript compile + Electron)
npm run dev:main      # Launches app
```

### Production Build (Planned)

```bash
npm run build:renderer  # Vite build
npm run build:main      # TypeScript compile
npm run package         # electron-builder
```

### Distribution (Planned)

- **macOS**: .dmg installer
- **Windows**: .exe installer
- **Linux**: .AppImage
- **Auto-update**: electron-updater

---

## Configuration

### Environment Variables (.env)

```bash
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
```

### TypeScript Configs

- **tsconfig.json**: Renderer config (React, DOM)
- **tsconfig.node.json**: Main config (Node.js)
- **tsconfig.main.json**: Electron main process

---

## Testing Strategy (Planned)

### Unit Tests
- AI tool execution logic
- File system operations
- Git operations

### Integration Tests
- IPC communication
- End-to-end workflows

### E2E Tests
- User scenarios with Spectron/Playwright

---

## Monitoring & Logging (Planned)

### Logging Levels
- **Debug**: Tool calls, API requests
- **Info**: User actions, git operations
- **Error**: Failures, exceptions

### Analytics (Future)
- Tool usage patterns
- AI iteration counts
- Feature adoption

---

## Future Architecture Enhancements

### Phase 4: Multi-Agent System

```
┌──────────────────────────────────────┐
│      Agent Orchestrator              │
├──────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐│
│  │Architect│  │Backend │  │Frontend││
│  └────────┘  └────────┘  └────────┘│
│  ┌────────┐  ┌────────┐  ┌────────┐│
│  │Tester  │  │Reviewer│  │Debugger││
│  └────────┘  └────────┘  └────────┘│
└──────────────────────────────────────┘
```

### Phase 5: Streaming

```typescript
const stream = await anthropic.messages.create({
  stream: true,
  ...
})

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    // Update UI in real-time
  }
}
```

### Phase 6: Local AI Models

```
┌─────────────────────┐
│ Cloud AI (Claude)   │ ← Primary
├─────────────────────┤
│ Local AI (Llama)    │ ← Fallback/Offline
└─────────────────────┘
```

---

## Comparison: Current vs Planned

| Feature | Current | Planned |
|---------|---------|---------|
| Single AI agent | ✅ | ✅ |
| Multiple agents | ❌ | Phase 4 |
| Tool Use API | ✅ | ✅ |
| Streaming | ❌ | Phase 5 |
| Voice input | ⚠️ (disabled) | Phase 5 |
| Local AI | ❌ | Phase 6 |
| Multi-repo | ✅ | ✅ |
| Session persistence | ❌ | Phase 4 |

---

*Last Updated: 2025-10-17*
*Status: Architecture document recreated from current implementation*
