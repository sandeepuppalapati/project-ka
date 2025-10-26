import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { Workspace, WorkspaceRepo, WorkspaceState } from '../renderer/types/workspace';

/**
 * Create a new workspace folder with initial structure
 */
export async function createWorkspace(
  basePath: string,
  name: string,
  repos: WorkspaceRepo[]
): Promise<Workspace> {
  // Sanitize workspace name for folder
  const folderName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const workspacePath = path.join(basePath, folderName);

  // Check if workspace already exists
  try {
    await fs.access(workspacePath);
    // Exists, append number
    let counter = 2;
    let newPath = `${workspacePath}-${counter}`;
    while (true) {
      try {
        await fs.access(newPath);
        counter++;
        newPath = `${workspacePath}-${counter}`;
      } catch {
        // Doesn't exist, use this path
        break;
      }
    }
    return createWorkspace(basePath, `${name} (${counter})`, repos);
  } catch {
    // Doesn't exist, continue
  }

  // Create workspace folder structure
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.mkdir(path.join(workspacePath, 'chats'), { recursive: true });

  // Create workspace config
  const workspace: Workspace = {
    name,
    path: workspacePath,
    created: new Date().toISOString(),
    repos
  };

  // Save workspace.json
  await fs.writeFile(
    path.join(workspacePath, 'workspace.json'),
    JSON.stringify(workspace, null, 2),
    'utf-8'
  );

  // Create empty state.json
  const initialState: WorkspaceState = {
    version: '1.0',
    lastModified: new Date().toISOString(),
    ui: {
      openFiles: [],
      activeFileIndex: 0,
      expandedFolders: [],
      selectedRepo: null,
      activeChatTab: 'bridge',
      sidebarWidth: 250,
      chatPanelWidth: 400
    }
  };

  await fs.writeFile(
    path.join(workspacePath, 'state.json'),
    JSON.stringify(initialState, null, 2),
    'utf-8'
  );

  return workspace;
}

/**
 * Load workspace from workspace.json
 */
export async function loadWorkspace(workspacePath: string): Promise<Workspace | null> {
  try {
    const configPath = path.join(workspacePath, 'workspace.json');
    const data = await fs.readFile(configPath, 'utf-8');
    const workspace: Workspace = JSON.parse(data);
    return workspace;
  } catch (error) {
    console.error('Failed to load workspace:', error);
    return null;
  }
}

/**
 * Save workspace config
 */
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const configPath = path.join(workspace.path, 'workspace.json');
  await fs.writeFile(configPath, JSON.stringify(workspace, null, 2), 'utf-8');
}

/**
 * Delete workspace folder and all its contents
 */
export async function deleteWorkspace(workspacePath: string): Promise<void> {
  await fs.rm(workspacePath, { recursive: true, force: true });
}

/**
 * List all workspaces in a directory
 */
export async function listWorkspaces(basePath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const workspaces: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const workspacePath = path.join(basePath, entry.name);
        const configPath = path.join(workspacePath, 'workspace.json');

        try {
          await fs.access(configPath);
          workspaces.push(workspacePath);
        } catch {
          // Not a workspace folder, skip
        }
      }
    }

    return workspaces;
  } catch {
    // Base path doesn't exist yet
    return [];
  }
}

/**
 * Load chat messages from workspace
 */
export async function loadChat(
  workspacePath: string,
  chatId: string
): Promise<any[]> {
  try {
    const chatPath = path.join(workspacePath, 'chats', `${chatId}.json`);
    const data = await fs.readFile(chatPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Chat file doesn't exist yet, return empty
    return [];
  }
}

/**
 * Save chat messages to workspace
 */
export async function saveChat(
  workspacePath: string,
  chatId: string,
  messages: any[]
): Promise<void> {
  const chatPath = path.join(workspacePath, 'chats', `${chatId}.json`);
  await fs.writeFile(chatPath, JSON.stringify(messages, null, 2), 'utf-8');
}

/**
 * Load workspace state
 */
export async function loadWorkspaceState(
  workspacePath: string
): Promise<WorkspaceState | null> {
  try {
    const statePath = path.join(workspacePath, 'state.json');
    const data = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save workspace state
 */
export async function saveWorkspaceState(
  workspacePath: string,
  state: WorkspaceState
): Promise<void> {
  const statePath = path.join(workspacePath, 'state.json');
  state.lastModified = new Date().toISOString();
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Get default workspace base path
 */
export function getDefaultWorkspacePath(): string {
  return path.join(app.getPath('documents'), 'ai-ide-workspaces');
}
