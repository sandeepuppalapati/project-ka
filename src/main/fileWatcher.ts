import * as chokidar from 'chokidar';
import type { BrowserWindow } from 'electron';
import * as path from 'path';

interface WatcherInfo {
  watcher: chokidar.FSWatcher;
  repoPath: string;
}

const watchers = new Map<string, WatcherInfo>();

export function startWatching(window: BrowserWindow, repoPaths: string[]): void {
  // Stop any existing watchers
  stopAllWatchers();

  // Start watching each repo
  for (const repoPath of repoPaths) {
    const watcher = chokidar.watch(repoPath, {
      ignored: [
        /(^|[\/\\])\../, // Ignore dotfiles
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/coverage/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/target/**', // Rust/Java
        '**/bin/**',
        '**/obj/**', // .NET
        '**/__pycache__/**', // Python
        '**/venv/**',
        '**/.venv/**',
        '**/vendor/**', // PHP/Go
        '**/*.asar', // Electron packages
        '**/*.asar/**',
      ],
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files
      awaitWriteFinish: {
        stabilityThreshold: 500, // Increased for better performance with large repos
        pollInterval: 100,
      },
      depth: 10, // Limit recursion depth for performance
    });

    // File added
    watcher.on('add', (filePath) => {
      const relativePath = path.relative(repoPath, filePath);
      console.log('[FileWatcher] File added:', relativePath);
      window.webContents.send('file:changed', {
        type: 'add',
        repoPath,
        filePath: relativePath,
        absolutePath: filePath,
      });
    });

    // File changed
    watcher.on('change', (filePath) => {
      const relativePath = path.relative(repoPath, filePath);
      console.log('[FileWatcher] File changed:', relativePath);
      window.webContents.send('file:changed', {
        type: 'change',
        repoPath,
        filePath: relativePath,
        absolutePath: filePath,
      });
    });

    // File deleted
    watcher.on('unlink', (filePath) => {
      const relativePath = path.relative(repoPath, filePath);
      console.log('[FileWatcher] File deleted:', relativePath);
      window.webContents.send('file:changed', {
        type: 'unlink',
        repoPath,
        filePath: relativePath,
        absolutePath: filePath,
      });
    });

    // Directory added
    watcher.on('addDir', (dirPath) => {
      const relativePath = path.relative(repoPath, dirPath);
      console.log('[FileWatcher] Directory added:', relativePath);
      window.webContents.send('file:changed', {
        type: 'addDir',
        repoPath,
        filePath: relativePath,
        absolutePath: dirPath,
      });
    });

    // Directory deleted
    watcher.on('unlinkDir', (dirPath) => {
      const relativePath = path.relative(repoPath, dirPath);
      console.log('[FileWatcher] Directory deleted:', relativePath);
      window.webContents.send('file:changed', {
        type: 'unlinkDir',
        repoPath,
        filePath: relativePath,
        absolutePath: dirPath,
      });
    });

    // Error handling
    watcher.on('error', (error) => {
      console.error('[FileWatcher] Error:', error);
    });

    watchers.set(repoPath, { watcher, repoPath });
    console.log('[FileWatcher] Started watching:', repoPath);
  }
}

export function stopWatching(repoPath: string): void {
  const watcherInfo = watchers.get(repoPath);
  if (watcherInfo) {
    watcherInfo.watcher.close();
    watchers.delete(repoPath);
    console.log('[FileWatcher] Stopped watching:', repoPath);
  }
}

export async function stopAllWatchers(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [repoPath, watcherInfo] of watchers.entries()) {
    // Close watchers in parallel with timeout
    const closePromise = Promise.race([
      watcherInfo.watcher.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)) // 1s timeout
    ]).then(() => {
      console.log('[FileWatcher] Stopped watching:', repoPath);
    }).catch((err) => {
      console.error('[FileWatcher] Error stopping watcher:', err);
    });

    closePromises.push(closePromise);
  }

  await Promise.all(closePromises);
  watchers.clear();
}

export function getWatchedPaths(): string[] {
  return Array.from(watchers.keys());
}
