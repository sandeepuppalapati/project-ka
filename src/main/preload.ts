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

  // File System APIs
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  // AI APIs
  sendChatMessage: (messages: Array<{ role: string; content: string }>, context?: { filePath?: string; fileContent?: string }) =>
    ipcRenderer.invoke('ai:chat', messages, context),
});
