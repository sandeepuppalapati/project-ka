import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import git from 'isomorphic-git';
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
