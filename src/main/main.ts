import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Enable media devices before app is ready
app.commandLine.appendSwitch('enable-speech-input');
app.commandLine.appendSwitch('enable-features', 'MediaDevices');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Enable microphone permissions
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'microphone', 'audioCapture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Also handle permission checks
  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    const allowedPermissions = ['media', 'microphone', 'audioCapture'];
    return allowedPermissions.includes(permission);
  });

  // Set a proper user agent to avoid being blocked by Google's speech API
  mainWindow.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Check if directory is a git repo
ipcMain.handle('git:isRepo', async (_event, repoPath: string) => {
  try {
    const gitDir = path.join(repoPath, '.git');
    await fs.access(gitDir);
    return true;
  } catch {
    return false;
  }
});

// Get git status
ipcMain.handle('git:status', async (_event, repoPath: string) => {
  try {
    const status = await git.statusMatrix({
      fs,
      dir: repoPath,
    });

    const modified = status.filter(row => row[2] === 2 && row[1] !== 0).length;
    const staged = status.filter(row => row[3] === 2).length;
    const untracked = status.filter(row => row[1] === 0 && row[2] === 2).length;

    return {
      modified,
      staged,
      untracked,
      clean: modified === 0 && staged === 0 && untracked === 0
    };
  } catch (error) {
    console.error('Git status error:', error);
    return null;
  }
});

// Get current branch
ipcMain.handle('git:currentBranch', async (_event, repoPath: string) => {
  try {
    const branch = await git.currentBranch({
      fs,
      dir: repoPath,
      fullname: false
    });
    return branch || 'main';
  } catch (error) {
    console.error('Git branch error:', error);
    return null;
  }
});

// Get file status for individual files
ipcMain.handle('git:fileStatus', async (_event, repoPath: string, filePath: string) => {
  try {
    const status = await git.status({
      fs,
      dir: repoPath,
      filepath: filePath.replace(repoPath + '/', '')
    });
    return status; // Returns: "ignored", "unmodified", "*modified", "*deleted", "*added", etc.
  } catch (error) {
    console.error('Git file status error:', error);
    return 'unknown';
  }
});

// Get changed files list
ipcMain.handle('git:statusMatrix', async (_event, repoPath: string) => {
  try {
    const status = await git.statusMatrix({
      fs,
      dir: repoPath,
    });

    return status.map(([filepath, head, workdir, stage]) => {
      // head: 0=absent, 1=present
      // workdir: 0=absent, 1=identical, 2=different
      // stage: 0=absent, 1=identical, 2=different, 3=added

      let fileStatus: string;

      if (head === 1 && workdir === 2 && stage === 1) {
        fileStatus = 'modified'; // Modified but not staged
      } else if (head === 1 && workdir === 2 && stage === 2) {
        fileStatus = 'staged'; // Modified and staged
      } else if (head === 0 && workdir === 2 && stage === 0) {
        fileStatus = 'untracked'; // New file, not staged
      } else if (head === 0 && workdir === 2 && stage === 3) {
        fileStatus = 'staged'; // New file, staged
      } else if (head === 1 && workdir === 0) {
        fileStatus = 'deleted'; // Deleted
      } else if (stage === 3) {
        fileStatus = 'staged'; // Staged for addition
      } else {
        fileStatus = 'unmodified';
      }

      return { filepath, status: fileStatus };
    });
  } catch (error) {
    console.error('Git status matrix error:', error);
    return null;
  }
});

// Stage file
ipcMain.handle('git:add', async (_event, repoPath: string, filepath: string) => {
  try {
    // Clean the filepath - remove repo path if it's included
    let cleanPath = filepath;
    if (filepath.startsWith(repoPath)) {
      cleanPath = filepath.substring(repoPath.length + 1);
    }

    console.log('Git add - repo:', repoPath, 'file:', cleanPath);

    await git.add({
      fs,
      dir: repoPath,
      filepath: cleanPath
    });

    console.log('Git add successful');
    return true;
  } catch (error) {
    console.error('Git add error:', error);
    return false;
  }
});

// Unstage file (reset from index)
ipcMain.handle('git:remove', async (_event, repoPath: string, filepath: string) => {
  try {
    // Clean the filepath - remove repo path if it's included
    let cleanPath = filepath;
    if (filepath.startsWith(repoPath)) {
      cleanPath = filepath.substring(repoPath.length + 1);
    }

    console.log('Git unstage - repo:', repoPath, 'file:', cleanPath);

    // Use resetIndex to unstage without deleting the file
    await git.resetIndex({
      fs,
      dir: repoPath,
      filepath: cleanPath
    });

    console.log('Git unstage successful');
    return true;
  } catch (error) {
    console.error('Git unstage error:', error);
    return false;
  }
});

// Commit changes
ipcMain.handle('git:commit', async (_event, repoPath: string, message: string) => {
  try {
    const sha = await git.commit({
      fs,
      dir: repoPath,
      message,
      author: {
        name: 'AI IDE User',
        email: 'user@ai-ide.local'
      }
    });
    return sha;
  } catch (error) {
    console.error('Git commit error:', error);
    return null;
  }
});

// Push changes
ipcMain.handle('git:push', async (_event, repoPath: string) => {
  try {
    await git.push({
      fs,
      http,
      dir: repoPath,
      remote: 'origin',
    });
    return true;
  } catch (error) {
    console.error('Git push error:', error);
    return false;
  }
});

// Read directory
ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name)
    }));
  } catch (error) {
    console.error('Read dir error:', error);
    return null;
  }
});

// Read file contents
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Read file error:', error);
    return null;
  }
});

// Write file contents
ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Write file error:', error);
    return false;
  }
});

// AI Chat handler
ipcMain.handle('ai:chat', async (_event, messages: Array<{ role: string; content: string }>, context?: { filePath?: string; fileContent?: string }) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set in .env file');
    }

    const anthropic = new Anthropic({ apiKey });

    // Build messages with context if provided
    const systemMessage = context?.fileContent
      ? `You are an AI coding assistant integrated into an IDE. The user is currently viewing/editing this file:\n\nFile: ${context.filePath}\n\n\`\`\`\n${context.fileContent}\n\`\`\`\n\nHelp them with their questions about this code or any coding tasks.`
      : 'You are an AI coding assistant integrated into an IDE. Help users with their coding questions and tasks.';

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemMessage,
      messages: messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    });

    const textContent = response.content.find(block => block.type === 'text');
    return textContent ? textContent.text : 'No response';
  } catch (error) {
    console.error('AI chat error:', error);
    throw error;
  }
});
