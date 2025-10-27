import * as fs from 'fs/promises';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import type { Workspace, WorkspaceRepo, WorkspaceState } from '../renderer/types/workspace';

/**
 * Encrypt data using Electron's safeStorage
 */
function encryptData(data: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system');
  }
  return safeStorage.encryptString(data);
}

/**
 * Decrypt data using Electron's safeStorage
 */
function decryptData(buffer: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system');
  }
  return safeStorage.decryptString(buffer);
}

/**
 * Create a new workspace folder with initial structure
 */
export async function createWorkspace(
  basePath: string,
  name: string,
  repos: WorkspaceRepo[],
  description?: string,
  tags?: string[]
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
    return createWorkspace(basePath, `${name} (${counter})`, repos, description, tags);
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
    description,
    tags,
    repos
  };

  // Save workspace.json (encrypted)
  const workspaceData = JSON.stringify(workspace, null, 2);
  const encryptedWorkspace = encryptData(workspaceData);
  await fs.writeFile(
    path.join(workspacePath, 'workspace.json'),
    encryptedWorkspace
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
      chatPanelWidth: 400,
      disconnectedAgents: []
    }
  };

  // Save state.json (encrypted)
  const stateData = JSON.stringify(initialState, null, 2);
  const encryptedState = encryptData(stateData);
  await fs.writeFile(
    path.join(workspacePath, 'state.json'),
    encryptedState
  );

  return workspace;
}

/**
 * Load workspace from workspace.json
 */
export async function loadWorkspace(workspacePath: string, updateAccessTime: boolean = false): Promise<Workspace | null> {
  try {
    const configPath = path.join(workspacePath, 'workspace.json');
    const encryptedData = await fs.readFile(configPath);
    const decryptedData = decryptData(encryptedData);
    const workspace: Workspace = JSON.parse(decryptedData);

    // Update last accessed time if requested
    if (updateAccessTime) {
      workspace.lastAccessed = new Date().toISOString();
      const workspaceData = JSON.stringify(workspace, null, 2);
      const encryptedWorkspace = encryptData(workspaceData);
      await fs.writeFile(configPath, encryptedWorkspace);
    }

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
  const workspaceData = JSON.stringify(workspace, null, 2);
  const encryptedWorkspace = encryptData(workspaceData);
  await fs.writeFile(configPath, encryptedWorkspace);
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
    const encryptedData = await fs.readFile(chatPath);
    const decryptedData = decryptData(encryptedData);
    return JSON.parse(decryptedData);
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
  const chatData = JSON.stringify(messages, null, 2);
  const encryptedChat = encryptData(chatData);
  await fs.writeFile(chatPath, encryptedChat);
}

/**
 * Load workspace state
 */
export async function loadWorkspaceState(
  workspacePath: string
): Promise<WorkspaceState | null> {
  try {
    const statePath = path.join(workspacePath, 'state.json');
    const encryptedData = await fs.readFile(statePath);
    const decryptedData = decryptData(encryptedData);
    return JSON.parse(decryptedData);
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
  const stateData = JSON.stringify(state, null, 2);
  const encryptedState = encryptData(stateData);
  await fs.writeFile(statePath, encryptedState);
}

/**
 * Get default workspace base path
 */
export function getDefaultWorkspacePath(): string {
  return path.join(app.getPath('documents'), 'ai-ide-workspaces');
}
