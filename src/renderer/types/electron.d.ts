import type { Workspace, WorkspaceState } from './workspace';

export interface StreamChunk {
  type: 'text' | 'tool' | 'done' | 'error';
  sessionId?: string;
  content?: string;
  tool?: string;
  status?: 'executing' | 'complete' | 'error';
  params?: any;
  result?: any;
  error?: string;
}

export interface ElectronAPI {
  platform: string;
  openFolder: () => Promise<string[] | null>;
  isRepo: (repoPath: string) => Promise<boolean>;
  getGitStatus: (repoPath: string) => Promise<GitStatus | null>;
  getCurrentBranch: (repoPath: string) => Promise<string | null>;
  getFileStatus: (repoPath: string, filePath: string) => Promise<string>;
  getStatusMatrix: (repoPath: string) => Promise<FileStatus[] | null>;
  gitAdd: (repoPath: string, filepath: string) => Promise<boolean>;
  gitRemove: (repoPath: string, filepath: string) => Promise<boolean>;
  gitCommit: (repoPath: string, message: string) => Promise<string | null>;
  gitPush: (repoPath: string) => Promise<boolean>;
  gitDiff: (repoPath: string, filepath: string) => Promise<GitDiff | null>;
  gitDiffAll: (repoPath: string) => Promise<GitDiff[]>;
  readDir: (dirPath: string) => Promise<DirEntry[] | null>;
  readFile: (filePath: string) => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  sendChatMessage: (messages: Array<{ role: string; content: string }>, context?: { filePath?: string; fileContent?: string; repoPath?: string }, sessionId?: string) => Promise<string>;
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => () => void;
  executeCommand: (command: string, cwd?: string) => Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode?: number;
  }>;
  saveSettings?: (settings: { apiKey: string; model: string; openaiApiKey?: string }) => Promise<void>;
  getSettings?: () => Promise<{ apiKey: string; model: string; openaiApiKey?: string } | null>;

  // Workspace API
  getDefaultWorkspacePath?: () => Promise<string>;
  createWorkspace?: (basePath: string, name: string, repos: any[], description?: string, tags?: string[]) => Promise<Workspace>;
  loadWorkspace?: (workspacePath: string, updateAccessTime?: boolean) => Promise<Workspace | null>;
  saveWorkspace?: (workspace: Workspace) => Promise<void>;
  deleteWorkspace?: (workspacePath: string) => Promise<void>;
  listWorkspaces?: (basePath: string) => Promise<string[]>;
  loadChat?: (workspacePath: string, chatId: string) => Promise<any[]>;
  saveChat?: (workspacePath: string, chatId: string, messages: any[]) => Promise<void>;
  loadWorkspaceState?: (workspacePath: string) => Promise<WorkspaceState | null>;
  saveWorkspaceState?: (workspacePath: string, state: WorkspaceState) => Promise<void>;

  // Terminal API
  createTerminal?: (terminalId: string, cwd: string) => Promise<void>;
  writeToTerminal?: (terminalId: string, data: string) => Promise<void>;
  resizeTerminal?: (terminalId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal?: (terminalId: string) => Promise<void>;
  onTerminalData?: (callback: (event: any, terminalId: string, data: string) => void) => void;

  // File Watcher API
  startFileWatcher?: (repoPaths: string[]) => Promise<void>;
  stopFileWatcher?: (repoPath: string) => Promise<void>;
  getWatchedPaths?: () => Promise<string[]>;
  onFileChanged?: (callback: (event: any, data: FileChangeEvent) => void) => () => void;
}

export interface GitStatus {
  modified: number;
  staged: number;
  untracked: number;
  clean: boolean;
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface FileStatus {
  filepath: string;
  status: 'untracked' | 'modified' | 'deleted' | 'staged' | 'unmodified';
}

export interface GitDiff {
  filepath: string;
  oldContent: string;
  newContent: string;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  repoPath: string;
  filePath: string;
  absolutePath: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
    };
  }
}
