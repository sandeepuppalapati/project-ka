import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Dialog APIs
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Git APIs
  isRepo: (repoPath: string) => ipcRenderer.invoke('git:isRepo', repoPath),
  getGitStatus: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
  getCurrentBranch: (repoPath: string) => ipcRenderer.invoke('git:currentBranch', repoPath),
  getFileStatus: (repoPath: string, filePath: string) => ipcRenderer.invoke('git:fileStatus', repoPath, filePath),
  getStatusMatrix: (repoPath: string) => ipcRenderer.invoke('git:statusMatrix', repoPath),
  gitAdd: (repoPath: string, filepath: string) => ipcRenderer.invoke('git:add', repoPath, filepath),
  gitRemove: (repoPath: string, filepath: string) => ipcRenderer.invoke('git:remove', repoPath, filepath),
  gitCommit: (repoPath: string, message: string) => ipcRenderer.invoke('git:commit', repoPath, message),
  gitPush: (repoPath: string) => ipcRenderer.invoke('git:push', repoPath),

  // File System APIs
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  // AI APIs
  sendChatMessage: (messages: Array<{ role: string; content: string }>, context?: { filePath?: string; fileContent?: string; repoPath?: string }, sessionId?: string) =>
    ipcRenderer.invoke('ai:chat', messages, context, sessionId),
  onStreamChunk: (callback: (chunk: any) => void) => {
    ipcRenderer.on('ai:stream-chunk', (_event, chunk) => callback(chunk));
    return () => ipcRenderer.removeAllListeners('ai:stream-chunk');
  },
  onToolExecution: (callback: (event: any) => void) => {
    ipcRenderer.on('ai:tool-execution', (_event, toolEvent) => callback(toolEvent));
    return () => ipcRenderer.removeAllListeners('ai:tool-execution');
  },

  // Shell APIs
  executeCommand: (command: string, cwd?: string) => ipcRenderer.invoke('shell:execute', command, cwd),

  // Settings APIs
  saveSettings: (settings: { apiKey: string; model: string }) => ipcRenderer.invoke('settings:save', settings),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  validateApiKey: (apiKey: string) => ipcRenderer.invoke('settings:validateApiKey', apiKey),

  // Workspace APIs
  getDefaultWorkspacePath: () => ipcRenderer.invoke('workspace:getDefaultPath'),
  createWorkspace: (basePath: string, name: string, repos: any[], description?: string, tags?: string[]) =>
    ipcRenderer.invoke('workspace:create', basePath, name, repos, description, tags),
  loadWorkspace: (workspacePath: string, updateAccessTime?: boolean) =>
    ipcRenderer.invoke('workspace:load', workspacePath, updateAccessTime),
  saveWorkspace: (workspace: any) => ipcRenderer.invoke('workspace:save', workspace),
  deleteWorkspace: (workspacePath: string) => ipcRenderer.invoke('workspace:delete', workspacePath),
  listWorkspaces: (basePath: string) => ipcRenderer.invoke('workspace:list', basePath),
  loadChat: (workspacePath: string, chatId: string) =>
    ipcRenderer.invoke('workspace:loadChat', workspacePath, chatId),
  saveChat: (workspacePath: string, chatId: string, messages: any[]) =>
    ipcRenderer.invoke('workspace:saveChat', workspacePath, chatId, messages),
  loadWorkspaceState: (workspacePath: string) => ipcRenderer.invoke('workspace:loadState', workspacePath),
  saveWorkspaceState: (workspacePath: string, state: any) =>
    ipcRenderer.invoke('workspace:saveState', workspacePath, state),

  // Terminal APIs
  createTerminal: (terminalId: string, cwd: string) => ipcRenderer.invoke('terminal:create', terminalId, cwd),
  writeToTerminal: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write', terminalId, data),
  resizeTerminal: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
  closeTerminal: (terminalId: string) => ipcRenderer.invoke('terminal:close', terminalId),
  onTerminalData: (callback: (event: any, terminalId: string, data: string) => void) => {
    ipcRenderer.on('terminal:data', callback);
  },
});

// Expose a separate electron API for IPC event handling
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args);
    },
  }
});
