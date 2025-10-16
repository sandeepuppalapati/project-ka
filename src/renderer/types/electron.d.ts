export interface ElectronAPI {
  platform: string;
  openFolder: () => Promise<string | null>;
  isRepo: (repoPath: string) => Promise<boolean>;
  getGitStatus: (repoPath: string) => Promise<GitStatus | null>;
  getCurrentBranch: (repoPath: string) => Promise<string | null>;
  readDir: (dirPath: string) => Promise<DirEntry[] | null>;
  readFile: (filePath: string) => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  sendChatMessage: (messages: Array<{ role: string; content: string }>, context?: { filePath?: string; fileContent?: string }) => Promise<string>;
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
