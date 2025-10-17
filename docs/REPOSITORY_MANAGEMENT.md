# Repository Management - Multi-Repo Project Model

**Date**: 2025-10-17 (Recreated)
**Status**: Phase 4 In Progress - Basic multi-repo, cross-repo coordination planned

---

## Overview

This IDE is designed **from the ground up** for managing multiple repositories simultaneously. Not a monorepo - actual separate Git repositories working together.

### Key Principle

> **Multiple repositories, single project context**

---

## Current Implementation (Phase 2-3)

### What Works ✅

1. **Add Multiple Repos**
   - User can add multiple repo folders
   - Each repo shows in sidebar
   - Switch between repos with click

2. **Repository Context**
   - AI knows current repo path
   - Commands execute in correct repo directory
   - File operations scoped to repo

3. **Independent Git Status**
   - Each repo has own git status
   - Stage/unstage files per repo
   - Commit per repo

### What's Planned ⏳

1. **Cross-Repo Coordination**
   - AI understands relationships
   - Linked commits across repos
   - Dependency awareness

2. **Session Persistence**
   - Save/restore project state
   - Remember open repos
   - Restore conversation history

3. **Branch Synchronization**
   - Coordinated branch switching
   - Track branch relationships
   - Parallel git operations

---

## Project Model

### Data Structure

```typescript
interface Project {
  id: string
  name: string
  createdAt: Date
  repositories: ProjectRepository[]
  settings: ProjectSettings
}

interface ProjectRepository {
  id: string              // UUID
  path: string            // Absolute path on disk
  name: string            // Display name
  branch: string          // Active branch
  remoteUrl?: string      // Git remote
  role?: string           // "backend" | "frontend" | "docs"
  dependencies?: string[] // IDs of dependent repos
}

interface ProjectSettings {
  autoCommit: boolean
  branchStrategy: 'independent' | 'synchronized'
  aiModel: 'claude' | 'gpt4'
}
```

### Example Project

```json
{
  "id": "proj_123",
  "name": "E-Commerce Platform",
  "repositories": [
    {
      "id": "repo_backend",
      "path": "/Users/dev/ecommerce-api",
      "name": "Backend API",
      "branch": "feature/auth",
      "role": "backend",
      "dependencies": []
    },
    {
      "id": "repo_frontend",
      "path": "/Users/dev/ecommerce-web",
      "name": "Web Frontend",
      "branch": "feature/login",
      "role": "frontend",
      "dependencies": ["repo_backend"]
    },
    {
      "id": "repo_mobile",
      "path": "/Users/dev/ecommerce-mobile",
      "name": "Mobile App",
      "branch": "feature/login",
      "role": "mobile",
      "dependencies": ["repo_backend"]
    }
  ],
  "settings": {
    "autoCommit": false,
    "branchStrategy": "synchronized",
    "aiModel": "claude"
  }
}
```

---

## User Workflows

### Workflow 1: Create New Project

```
1. User: Click "New Project"
2. IDE: Show project wizard
3. User: Enter project name
4. User: Add repositories:
   - Click "Add Repository"
   - Choose folder
   - Select branch
   - Set role (optional)
5. IDE: Save project configuration
6. IDE: Load all repos into workspace
```

**UI Mockup**:
```
┌────────────────────────────────────┐
│ Create New Project                 │
├────────────────────────────────────┤
│ Project Name: [E-Commerce Platform]│
│                                    │
│ Repositories:                      │
│ ┌──────────────────────────────┐  │
│ │ ✅ ecommerce-api             │  │
│ │    📁 /Users/dev/ecommerce-api│ │
│ │    🌿 feature/auth            │  │
│ │    [Remove]                   │  │
│ └──────────────────────────────┘  │
│                                    │
│ [+ Add Repository]                 │
│                                    │
│ [Cancel]  [Create Project]         │
└────────────────────────────────────┘
```

### Workflow 2: Open Existing Project

```
1. User: Click "Open Project"
2. IDE: Show recent projects or browse
3. User: Select project
4. IDE: Load project configuration
5. IDE: Verify all repo paths exist
6. IDE: Load git status for each repo
7. IDE: Restore last active repo
```

### Workflow 3: Add Repository to Project

```
1. User: Click "+ Add Repo" in sidebar
2. IDE: Show folder picker
3. User: Choose repo folder
4. IDE: Verify it's a git repo
5. IDE: Ask for branch (default: current)
6. IDE: Add to project
7. IDE: Save project config
```

---

## Git Integration

### Per-Repository Operations

```typescript
class RepositoryManager {
  async getStatus(repoPath: string): Promise<GitStatus>
  async getCurrentBranch(repoPath: string): Promise<string>
  async getChangedFiles(repoPath: string): Promise<FileStatus[]>
  async stageFile(repoPath: string, filePath: string): Promise<boolean>
  async commit(repoPath: string, message: string): Promise<string>
  async push(repoPath: string): Promise<boolean>
}
```

### Cross-Repository Operations (Planned)

```typescript
// Commit same feature across multiple repos
async commitAcrossRepos(
  repos: string[],
  message: string
): Promise<Map<string, string>> // repoPath → commitHash

// Create linked branches
async createLinkedBranches(
  repos: string[],
  branchName: string,
  baseBranch: string = 'main'
): Promise<void>

// Switch branches together
async switchBranchesSync(
  repos: string[],
  branchName: string
): Promise<void>
```

---

## Branch Management Strategy

### Option 1: Independent Branches (Current)

Each repo has its own branch, no coordination.

```
ecommerce-api:      feature/auth
ecommerce-web:      feature/login
ecommerce-mobile:   main
```

**Pros**: Flexibility
**Cons**: Can get out of sync

### Option 2: Synchronized Branches (Planned)

All repos use same branch name, switched together.

```
ecommerce-api:      feature/auth
ecommerce-web:      feature/auth
ecommerce-mobile:   feature/auth
```

**Pros**: Clear relationships
**Cons**: Forces same naming

### Option 3: Linked Branches (Future)

Repos have different branches but with explicit links.

```
ecommerce-api:      feature/auth        ← defines API
ecommerce-web:      feature/auth-ui     ← consumes API
ecommerce-mobile:   feature/mobile-auth ← consumes API
```

**Pros**: Best of both worlds
**Cons**: More complex to manage

---

## AI Context Across Repos

### Current: Single Repo Context

```
User is working in: /Users/dev/ecommerce-api (branch: feature/auth)
```

AI knows:
- Current repo path
- Uses it for commands (cwd)
- File paths relative to repo

### Planned: Multi-Repo Context

```
User's project has 3 repos:
1. ecommerce-api (backend, feature/auth)
2. ecommerce-web (frontend, feature/login)
3. ecommerce-docs (docs, main)

Currently viewing: ecommerce-api
```

AI knows:
- All repo paths
- Repo relationships
- Which repo to work in
- When to switch repos

---

## Cross-Repo Change Coordination

### Scenario: API Change Affects Frontend

```
User: "Add pagination to /api/products endpoint"

AI (Smart Multi-Repo):
1. Analyze: Endpoint in backend repo
2. Modify: backend/src/api/products.ts
3. Detect: Frontend repo uses this endpoint
4. Check: frontend/src/services/api.ts
5. Update: Frontend code to handle pagination
6. Test: Run tests in both repos
7. Report: "Updated backend + frontend"
```

### Dependency Graph

```
┌─────────────┐
│   Backend   │
└──────┬──────┘
       │ provides API
       ├────────────────┐
       │                │
  ┌────▼────┐     ┌────▼────┐
  │ Frontend│     │  Mobile │
  └─────────┘     └─────────┘
```

AI uses this to:
- Know which repos are affected
- Suggest changes in dependent repos
- Validate consistency

---

## Session Persistence (Planned)

### What to Save

```typescript
interface ProjectSession {
  projectId: string
  lastOpened: Date

  // Repo states
  activeRepoId: string
  repoBranches: Map<string, string>

  // UI state
  openFiles: FileTab[]
  activeFile: string | null
  scrollPositions: Map<string, number>

  // Chat state (optional)
  chatHistory: Message[]

  // Git state
  uncommittedChanges: Map<string, FileStatus[]>
}
```

### Save/Load Flow

```
On Close:
1. Collect all state
2. Serialize to JSON
3. Save to ~/.ai-ide/sessions/proj_123.json

On Open:
1. Load proj_123.json
2. Verify repos still exist
3. Restore branches
4. Restore open files
5. Restore chat (if enabled)
```

---

## File Path Resolution

### Problem

```
File in backend: src/auth/jwt.ts
File in frontend: src/auth/Login.tsx
```

Both have `src/auth` - how to distinguish?

### Solution: Repo-Scoped Paths

```typescript
interface FilePath {
  repoId: string
  relativePath: string
  absolutePath: string
}

// Examples
{
  repoId: "repo_backend",
  relativePath: "src/auth/jwt.ts",
  absolutePath: "/Users/dev/ecommerce-api/src/auth/jwt.ts"
}

{
  repoId: "repo_frontend",
  relativePath: "src/auth/Login.tsx",
  absolutePath: "/Users/dev/ecommerce-web/src/auth/Login.tsx"
}
```

### AI Tool Calls

```typescript
// AI specifies repo in file path
read_file({
  file_path: "/Users/dev/ecommerce-api/src/auth/jwt.ts"
})

// OR (future enhancement)
read_file({
  repo: "backend",
  path: "src/auth/jwt.ts"
})
```

---

## Repository Roles (Optional)

### Purpose

Help AI understand what each repo does.

### Predefined Roles

- **backend**: API servers, databases
- **frontend**: Web interfaces
- **mobile**: Mobile apps
- **docs**: Documentation
- **infra**: Infrastructure/DevOps
- **shared**: Shared libraries

### AI Usage

```
User: "Add authentication"

AI sees:
- backend repo (role: backend)
- frontend repo (role: frontend)

AI knows:
- Backend = implement JWT
- Frontend = add login UI
```

---

## Linked Commits (Future)

### Concept

Commits across multiple repos for same feature are linked.

### Example

```
Feature: "Add Product Reviews"

Commits:
├─ ecommerce-api:     abc123 "Add review API endpoints"
├─ ecommerce-web:     def456 "Add review UI component"
└─ ecommerce-mobile:  ghi789 "Add review screen"

Link ID: feature_reviews_2025_10_17
```

### Benefits

- Track related changes
- Rollback together
- Understand feature scope
- Generate changelogs

---

## UI Design (Current & Planned)

### Current: Simple Repository List

```
┌────────────────┐
│ Repositories   │
├────────────────┤
│ ● ecommerce-api│ ← Active
│ ○ ecommerce-web│
│ ○ docs         │
└────────────────┘
```

### Planned: Rich Repository Panel

```
┌──────────────────────────────┐
│ Project: E-Commerce Platform │
├──────────────────────────────┤
│ ● Backend API                │
│   🌿 feature/auth            │
│   📝 3 uncommitted           │
│   [Switch Branch] [Commit]   │
├──────────────────────────────┤
│ ○ Web Frontend               │
│   🌿 feature/login           │
│   ✅ Clean                    │
├──────────────────────────────┤
│ ○ Documentation              │
│   🌿 main                    │
│   ✅ Clean                    │
└──────────────────────────────┘
```

---

## Performance Considerations

### Challenge: Multiple Git Operations

Checking git status for 5+ repos can be slow.

### Solutions

1. **Lazy Loading**: Only check active repo
2. **Background Updates**: Check others async
3. **Caching**: Cache status, invalidate on change
4. **Debouncing**: Don't check on every file save

### Implementation

```typescript
class GitStatusManager {
  private cache = new Map<string, {status: GitStatus, timestamp: number}>()
  private TTL = 5000 // 5 seconds

  async getStatus(repoPath: string): Promise<GitStatus> {
    const cached = this.cache.get(repoPath)
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.status
    }

    const status = await git.status(repoPath)
    this.cache.set(repoPath, { status, timestamp: Date.now() })
    return status
  }
}
```

---

## Error Handling

### Repository Not Found

```
User opens project
  → Repo path /Users/dev/old-repo doesn't exist
  → IDE shows error: "Repository not found"
  → Offer: Remove from project OR Choose new location
```

### Branch Doesn't Exist

```
User switches to branch "feature/new"
  → Branch doesn't exist in repo
  → IDE: "Create new branch 'feature/new'?"
  → User: Yes → Create from current branch
```

### Git Conflicts

```
User commits in backend repo
  → Git detects conflict
  → IDE shows conflict UI
  → User resolves → Retry commit
```

---

## Future Enhancements

### 1. Monorepo Support

For users who DO use monorepos:

```
my-monorepo/
├── packages/
│   ├── backend/
│   ├── frontend/
│   └── shared/
```

Treat each `packages/*` as separate "repo" in IDE.

### 2. Remote Repo Cloning

```
User: "Add repo"
  → Option: Local folder OR GitHub URL
  → If URL: Clone to workspace
  → Add to project
```

### 3. Submodule Support

```
main-repo/
└── submodules/
    ├── theme/
    └── common/
```

Treat submodules as linked repos.

---

*Last Updated: 2025-10-17*
*Status: Basic multi-repo working, advanced features planned*
