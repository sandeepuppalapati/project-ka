export interface Workspace {
  name: string;
  path: string;
  created: string;
  lastAccessed?: string;
  description?: string;
  tags?: string[];
  repos: WorkspaceRepo[];
}

export interface WorkspaceRepo {
  id: string;
  name: string;
  path: string;
}

export interface WorkspaceSettings {
  defaultPath: string;
  current: string | null;
  recent: string[];
}

export interface WorkspaceState {
  version: string;
  lastModified: string;
  ui: UIState;
}

export interface UIState {
  openFiles: OpenFile[];
  activeFileIndex: number;
  expandedFolders: string[];
  selectedRepo: string | null;
  activeChatTab: string;
  sidebarWidth: number;
  chatPanelWidth: number;
  disconnectedAgents: string[]; // IDs of agents disconnected from Bridge
  recentFiles?: RecentFile[]; // Recently opened files
}

export interface RecentFile {
  path: string;
  name: string;
  repoName: string;
  timestamp: number;
}

export interface OpenFile {
  repoId: string;
  filePath: string;
  cursorPosition: { line: number; column: number };
  scrollPosition: number;
  isDirty: boolean;
}
