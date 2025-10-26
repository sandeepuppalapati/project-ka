# Workspace Feature Design

## Overview

Workspaces are virtual groupings of repositories/folders that allow users to organize related projects together. All workspace data (chats, settings, state) is stored in dedicated workspace folders.

## Core Concept

- **Virtual grouping** - No physical folder structure requirement
- **Named workspace** - User gives it a meaningful name
- **Include any repos/folders** - Can be from anywhere on disk
- **Workspace folder for data** - All chats, settings, state stored in dedicated folder
- **Default path setting** - User configures where workspace folders are created
- **Per-workspace state** - Each workspace remembers open files, cursor positions, etc.

## Design Decisions

### Confirmed Requirements

1. ✅ **Workspace switching** - Closes all files, restores state per workspace
2. ✅ **API keys** - Global only (stored in app settings, not per-workspace)
3. ✅ **Templates** - Not needed (skip for MVP)
4. ✅ **Multi-workspace** - Single workspace at a time (future: multiple windows)
5. ✅ **Deletion** - Delete entire workspace folder and all data
6. ✅ **Bridge** - Workspace-specific (each workspace has its own Bridge chat)
7. ✅ **State persistence** - Save open files, cursor positions, expanded folders, etc.

## File Structure

```
~/Documents/ai-ide-workspaces/              # Default path (user configurable)
├── ecommerce-platform/                     # Workspace folder
│   ├── workspace.json                      # Workspace configuration
│   ├── chats/                              # All chat history
│   │   ├── frontend-repo.json              # Repo-specific chat
│   │   ├── backend-repo.json               # Repo-specific chat
│   │   └── bridge.json                     # Workspace Bridge (not global!)
│   └── state.json                          # UI state (open files, cursor pos, etc.)
│
├── side-project/                           # Another workspace
│   ├── workspace.json
│   ├── chats/
│   │   ├── main-repo.json
│   │   └── bridge.json                     # Different Bridge per workspace
│   └── state.json
│
└── client-work/                            # Another workspace
    ├── workspace.json
    ├── chats/
    └── state.json
```

## Data Structures

### workspace.json

```json
{
  "name": "E-commerce Platform",
  "created": "2025-01-15T10:30:00Z",
  "repos": [
    {
      "id": "repo-1",
      "name": "Frontend",
      "path": "/Users/sandeep/projects/ecommerce/frontend"
    },
    {
      "id": "repo-2",
      "name": "Backend",
      "path": "/Users/sandeep/work/backend-api"
    }
  ]
}
```

### state.json

```json
{
  "version": "1.0",
  "lastModified": "2025-01-15T14:30:00Z",
  "ui": {
    "openFiles": [
      {
        "repoId": "repo-1",
        "filePath": "/Users/sandeep/projects/ecommerce/frontend/src/App.tsx",
        "cursorPosition": { "line": 45, "column": 12 },
        "scrollPosition": 320,
        "isDirty": false
      },
      {
        "repoId": "repo-2",
        "filePath": "/Users/sandeep/work/backend-api/server.ts",
        "cursorPosition": { "line": 102, "column": 5 },
        "scrollPosition": 1840,
        "isDirty": true
      }
    ],
    "activeFileIndex": 0,
    "expandedFolders": [
      "repo-1:/src",
      "repo-1:/src/components",
      "repo-2:/api"
    ],
    "selectedRepo": "repo-1",
    "activeChatTab": "repo-1",
    "sidebarWidth": 250,
    "chatPanelWidth": 400
  }
}
```

### App Settings (Global)

```json
{
  "apiKey": "encrypted...",           // Global Anthropic key
  "openaiApiKey": "encrypted...",     // Global OpenAI key
  "model": "claude-sonnet-4-5",       // Global default
  "workspaces": {
    "defaultPath": "~/Documents/ai-ide-workspaces/",
    "current": "ecommerce-platform",  // Last opened
    "recent": [
      "ecommerce-platform",
      "side-project"
    ]
  }
}
```

## State Persistence

### What State to Persist?

**Essential (Always Save):**
- ✅ Open files (paths)
- ✅ Active file/tab
- ✅ Expanded folders in file tree
- ✅ Selected repo

**Nice to Have:**
- ✅ Cursor position per file
- ✅ Scroll position per file
- ✅ Dirty state (unsaved changes)
- ✅ Active chat tab
- ✅ Panel widths (sidebar, chat panel)

### Auto-save Triggers

- File opened/closed → debounced save (2s)
- File switched → debounced save (2s)
- Folder expanded/collapsed → debounced save (2s)
- Cursor moved → debounced save (2s)
- Panel resized → debounced save (2s)
- Tab switched → debounced save (2s)

### Immediate Save (No Debounce)

- Workspace switch → immediate save
- App close → immediate save

### Restore Behavior

On workspace load:
1. Validate all file paths still exist
2. Filter out files from removed repos
3. Restore open files with cursor/scroll positions
4. Restore expanded folders
5. Set active file and chat tab
6. Restore panel widths

## User Flow

### First Launch (No Workspaces)

```
┌─────────────────────────────────────┐
│  Welcome to AI IDE                  │
│                                     │
│  ○ Create New Workspace             │
│  ○ Open Existing Workspace          │
│                                     │
│  [Set Default Workspace Path]       │
│  ~/Documents/ai-ide-workspaces/     │
└─────────────────────────────────────┘
```

### Create Workspace

```
┌─────────────────────────────────────┐
│  Create Workspace                   │
│                                     │
│  Name: [E-commerce Platform____]    │
│                                     │
│  Add Repositories/Folders:          │
│  ┌───────────────────────────────┐ │
│  │ + Add Repository              │ │
│  │ + Add Folder                  │ │
│  └───────────────────────────────┘ │
│                                     │
│  Save to:                           │
│  ~/Documents/ai-ide-workspaces/     │
│     ecommerce-platform/             │
│                                     │
│          [Cancel]  [Create]         │
└─────────────────────────────────────┘
```

### Main UI with Workspace

```
┌────────────────────────────────────────────────┐
│ [⚡ E-commerce Platform ▼]   Settings          │  ← Workspace selector
├────────┬───────────────────────────────────────┤
│ Repos  │ ... (same as before)                  │
│ ○ Front│                                       │
│ ○ Back │                                       │
├────────┤                                       │
│ Chat   │                                       │
│ ○ Bridge    ← Workspace-specific Bridge       │
│ ○ Front│                                       │
│ ○ Back │                                       │
└────────┴───────────────────────────────────────┘
```

## Implementation Details

### Workspace File System API

New file: `src/main/workspace.ts`

```typescript
// Create workspace folder and files
async function createWorkspace(name: string, repos: Repo[]): Promise<string>

// Load workspace.json
async function loadWorkspace(workspacePath: string): Promise<Workspace>

// Save workspace.json
async function saveWorkspace(workspace: Workspace): Promise<void>

// Delete workspace (entire folder)
async function deleteWorkspace(workspacePath: string): Promise<void>

// List all workspaces in default path
async function listWorkspaces(basePath: string): Promise<string[]>

// Chat file operations
async function loadChat(workspacePath: string, chatId: string): Promise<Message[]>
async function saveChat(workspacePath: string, chatId: string, messages: Message[]): Promise<void>

// State file operations
async function saveWorkspaceState(workspacePath: string, state: WorkspaceState): Promise<void>
async function loadWorkspaceState(workspacePath: string): Promise<WorkspaceState | null>
```

### Workspace Switching Logic

```typescript
async function switchWorkspace(newWorkspacePath: string) {
  // 1. Save current workspace state
  await saveCurrentState();

  // 2. Close all open files/tabs
  closeAllTabs();

  // 3. Clear chat messages from UI
  clearAllChats();

  // 4. Load new workspace
  const workspace = await loadWorkspace(newWorkspacePath);

  // 5. Load workspace repos
  setRepos(workspace.repos);

  // 6. Load workspace chats
  const chats = await loadWorkspaceChats(newWorkspacePath);

  // 7. Load workspace Bridge
  const bridge = await loadChat(newWorkspacePath, 'bridge');

  // 8. Load workspace state
  const state = await loadWorkspaceState(newWorkspacePath);

  // 9. Restore UI state (open files, cursor positions, etc.)
  if (state) {
    await restoreWorkspaceState(state);
  }

  // 10. Update app state
  setCurrentWorkspace(workspace);
}
```

### Migration for Existing Users

On first launch with workspace feature:

```typescript
async function migrateToWorkspaces() {
  // Detect old localStorage data
  const hasOldData = localStorage.getItem('repos') ||
                     localStorage.getItem('chat_messages');

  if (!hasOldData) return; // New user, skip

  // Prompt user
  const migrate = confirm(
    'New Workspace Feature!\n\n' +
    'Your repos and chats will be moved to a workspace.\n\n' +
    'Create "Default Workspace"?'
  );

  if (!migrate) return;

  // Create default workspace
  const oldRepos = JSON.parse(localStorage.getItem('repos') || '[]');
  const workspace = await createWorkspace('Default Workspace', oldRepos);

  // Migrate chat history
  const oldChats = JSON.parse(localStorage.getItem('chat_messages') || '{}');
  for (const [repoId, messages] of Object.entries(oldChats)) {
    await saveChat(workspace.path, repoId, messages);
  }

  // Migrate bridge
  const oldBridge = JSON.parse(localStorage.getItem('bridge_messages') || '[]');
  await saveChat(workspace.path, 'bridge', oldBridge);

  // Clear old data
  localStorage.removeItem('repos');
  localStorage.removeItem('chat_messages');
  localStorage.removeItem('bridge_messages');

  // Set as current
  setCurrentWorkspace(workspace);
}
```

## TypeScript Types

```typescript
interface Workspace {
  name: string;
  path: string;
  created: string;
  repos: WorkspaceRepo[];
}

interface WorkspaceRepo {
  id: string;
  name: string;
  path: string;
}

interface WorkspaceSettings {
  defaultPath: string;
  current: string | null;
  recent: string[];
}

interface WorkspaceState {
  version: string;
  lastModified: string;
  ui: UIState;
}

interface UIState {
  openFiles: OpenFile[];
  activeFileIndex: number;
  expandedFolders: string[];
  selectedRepo: string | null;
  activeChatTab: string;
  sidebarWidth: number;
  chatPanelWidth: number;
}

interface OpenFile {
  repoId: string;
  filePath: string;
  cursorPosition: { line: number; column: number };
  scrollPosition: number;
  isDirty: boolean;
}
```

## Edge Cases to Handle

1. **Workspace folder deleted externally** - Show error, prompt to recreate or switch
2. **Invalid workspace.json** - Validation, show error, offer to fix
3. **Duplicate workspace names** - Append number (e.g., "Project (2)")
4. **Repo path no longer exists** - Mark as missing, allow removal
5. **File no longer exists** - Skip when restoring open files
6. **Repo removed from workspace** - Filter out its files from open files
7. **Concurrent modifications** - File locking or last-write-wins
8. **Large chat history** - Pagination or lazy loading

## UI Components

### New Components

- `WorkspaceManager.tsx` - Manage workspaces (list, switch, delete)
- `CreateWorkspace.tsx` - Create new workspace modal
- `WorkspaceSelector.tsx` - Dropdown selector in header

### Modified Components

- `App.tsx` - Workspace context, switching logic
- `Settings.tsx` - Add workspace path setting
- `RepoManager.tsx` - Load from workspace instead of localStorage
- `ChatPanel.tsx` - Load/save from workspace files
- `BridgeContext.tsx` - Make Bridge workspace-specific
- `FileViewer.tsx` - Track cursor/scroll positions for state

## File Changes Summary

### New Files

- `src/main/workspace.ts` - Workspace file system operations
- `src/renderer/components/WorkspaceManager.tsx` - Manage workspaces
- `src/renderer/components/CreateWorkspace.tsx` - Creation modal
- `src/renderer/components/WorkspaceSelector.tsx` - Dropdown selector
- `src/renderer/types/workspace.d.ts` - TypeScript types
- `docs/WORKSPACE_DESIGN.md` - This design document

### Modified Files

- `src/main/main.ts` - Add IPC handlers for workspace operations
- `src/renderer/App.tsx` - Workspace context, switching logic
- `src/renderer/components/Settings.tsx` - Add workspace path setting
- `src/renderer/components/RepoManager.tsx` - Load from workspace
- `src/renderer/components/ChatPanel.tsx` - Load/save from workspace files
- `src/renderer/contexts/BridgeContext.tsx` - Make Bridge workspace-specific
- `src/renderer/components/FileViewer.tsx` - Track state for persistence

## Benefits

✅ **Organize projects** - Group related repos together
✅ **Seamless experience** - Pick up exactly where you left off
✅ **Multi-file workflows** - Keep context across sessions
✅ **Per-workspace isolation** - Different state for different projects
✅ **Lost work prevention** - Restore unsaved files (with warning)
✅ **Better context for AI** - AI knows about all repos in workspace
✅ **Portable** - Workspace config can be shared with team

## Future Enhancements

- Multiple workspace windows
- Workspace templates
- Workspace-level search (across all repos)
- Workspace dependencies graph
- Import/export workspace config
- Workspace tags/categories
