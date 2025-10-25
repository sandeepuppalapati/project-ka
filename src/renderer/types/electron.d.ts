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
