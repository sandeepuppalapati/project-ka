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
