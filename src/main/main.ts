import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
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
    properties: ['openDirectory', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  // Return array of paths for multi-selection support
  return result.filePaths;
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

    await git.add({
      fs,
      dir: repoPath,
      filepath: cleanPath
    });

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

    // Use resetIndex to unstage without deleting the file
    await git.resetIndex({
      fs,
      dir: repoPath,
      filepath: cleanPath
    });

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

// Execute shell command
ipcMain.handle('shell:execute', async (_event, command: string, cwd?: string) => {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: cwd || process.cwd(),
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: any) {
    console.error('Command execution error:', error);
    return {
      success: false,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message,
      exitCode: error.code,
    };
  }
});

// Settings handlers
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

ipcMain.handle('settings:save', async (_event, settings: { apiKey: string; model: string }) => {
  try {
    await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
});

ipcMain.handle('settings:get', async () => {
  try {
    const data = await fs.readFile(settingsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid - return null
    return null;
  }
});

// Validate API key
ipcMain.handle('settings:validateApiKey', async (_event, apiKey: string) => {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, error: 'API key is required' };
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Make a minimal API call to validate the key
    await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    });

    return { valid: true };
  } catch (error: any) {
    if (error.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    } else if (error.status === 429) {
      return { valid: false, error: 'Rate limit exceeded. Try again later.' };
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return { valid: false, error: 'Network error. Check your internet connection.' };
    } else {
      return { valid: false, error: error.message || 'Failed to validate API key' };
    }
  }
});

// AI Chat handler with Tool Use
interface BridgeMessage {
  agentName: string;
  content: string;
  timestamp: Date;
}

interface ChatContext {
  filePath?: string;
  fileContent?: string;
  repoPath?: string;
  repoName?: string;
  isBridge?: boolean;
  allRepos?: Array<{ id: string; path: string; name: string }>;
  bridgeMessages?: BridgeMessage[];
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (error.status === 401 || error.status === 400) {
        throw error;
      }

      // Check if we should retry
      const isRetryable =
        error.status === 429 || // Rate limit
        error.status === 500 || error.status === 502 || error.status === 503 || // Server errors
        error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT'; // Network errors

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

ipcMain.handle('ai:chat', async (_event, messages: Array<{ role: string; content: string }>, context?: ChatContext, sessionId?: string) => {
  try {
    // Try to load settings from file first, fallback to .env
    let apiKey = process.env.ANTHROPIC_API_KEY;
    let model = 'claude-sonnet-4-5-20250929';

    try {
      const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
      const settings = JSON.parse(settingsData);
      if (settings.apiKey) {
        apiKey = settings.apiKey;
      }
      if (settings.model) {
        model = settings.model;
      }
    } catch {
      // Settings file doesn't exist, use .env
    }

    if (!apiKey) {
      throw new Error('API Key not configured. Please configure your API key in Settings.');
    }

    const anthropic = new Anthropic({ apiKey });

    // Define tools available to AI
    const tools = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: {
          type: 'object' as const,
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file to read'
            }
          },
          required: ['file_path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file (creates or overwrites)',
        input_schema: {
          type: 'object' as const,
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file to write'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['file_path', 'content']
        }
      },
      {
        name: 'execute_command',
        description: 'Execute a shell command',
        input_schema: {
          type: 'object' as const,
          properties: {
            command: {
              type: 'string',
              description: 'Shell command to execute'
            },
            cwd: {
              type: 'string',
              description: 'Working directory for command execution (optional)'
            }
          },
          required: ['command']
        }
      },
      {
        name: 'post_to_bridge',
        description: 'Post a message to the Bridge for other agents to see. Use this when you need help from another agent, want to share status, or need information from another repository.',
        input_schema: {
          type: 'object' as const,
          properties: {
            message: {
              type: 'string',
              description: 'The message to post. Be specific about what you need. You can mention specific agents using @agent-name format.'
            },
            type: {
              type: 'string',
              enum: ['question', 'status', 'request', 'info'],
              description: 'Type of message: question (asking for help), status (update on progress), request (asking agent to do something), info (sharing information)'
            }
          },
          required: ['message', 'type']
        }
      },
      {
        name: 'read_bridge',
        description: 'Read recent messages from the Bridge to see what other agents are doing or if anyone needs your help.',
        input_schema: {
          type: 'object' as const,
          properties: {
            count: {
              type: 'number',
              description: 'Number of recent messages to read (default: 5, max: 20)'
            }
          }
        }
      }
    ];

    // Build system message based on context
    let systemMessage = '';

    if (context?.isBridge) {
      // Bridge coordinator prompt
      systemMessage = `You are the Bridge - a coordination layer for multiple AI agents working across different repositories in a multi-repo project.

Your role:
- Help decompose cross-repo tasks and suggest which agents should handle them
- Summarize multi-agent work for the user
- Facilitate communication between agents
- You don't modify code yourself - you coordinate other agents

Available repositories in this project:
${context.allRepos?.map(r => `- ${r.name} (${r.path})`).join('\n') || 'None'}

You can see messages from agents in the bridge. Help users understand agent collaboration and suggest coordination strategies.`;
    } else {
      // Repo-specific agent prompt
      systemMessage = `You are an AI agent responsible for the "${context?.repoName || 'repository'}" codebase.

You can:
- Read and write files using tools
- Execute shell commands using tools
- Analyze code and debug issues
- Work autonomously to complete multi-step tasks
- **Post to Bridge** to coordinate with other agents
- **Read Bridge** to see what other agents are doing

Your repository path: ${context?.repoPath || 'Not set'}
When executing commands, use this as the working directory (cwd parameter).

${context?.fileContent ? `\n\nThe user is currently viewing/editing this file:\nFile: ${context.filePath}\n\n\`\`\`\n${context.fileContent}\n\`\`\`` : ''}

**Multi-Agent Environment:**
You are part of a multi-repository project with other AI agents. There is a "Bridge" (group chat) where agents can coordinate.

${context?.allRepos && context.allRepos.length > 1 ? `\nOther repositories in this project:\n${context.allRepos.filter(r => r.path !== context.repoPath).map(r => `- ${r.name} Agent (handles ${r.name} repo)`).join('\n')}` : ''}

${context?.bridgeMessages && context.bridgeMessages.length > 0 ? `\n**Recent Bridge Activity** (latest first, messages from other agents):\n${context.bridgeMessages.filter((m: any) => m.agentName !== context.repoName).slice().reverse().map((m: any, idx: number) => `${idx + 1}. [${m.agentName}]: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`).join('\n')}` : ''}

**Autonomous Coordination:**
You should proactively use the bridge when:
1. **You need information from another repo** - Post a question to the Bridge asking the relevant agent
2. **You're stuck or blocked** - Ask for help from other agents or the user
3. **You complete a major task** - Share status updates so others know what you've done
4. **You discover important info** - Share findings that might help other agents
5. **Someone asks you a question** - Monitor the bridge and respond when addressed

Use the \`post_to_bridge\` tool to send messages. Use \`read_bridge\` to check for new messages (though recent messages are already shown above).

Work autonomously - call tools as needed to complete tasks. Don't hesitate to coordinate with other agents when it would help!`;
    }


    let conversationMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    let finalResponse = '';
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    // Tool execution loop with streaming
    while (iterations < maxIterations) {
      iterations++;

      // Use streaming API with retry logic
      const stream = await retryWithBackoff(async () => {
        try {
          return await anthropic.messages.stream({
            model: model,
            max_tokens: 4096,
            system: systemMessage,
            messages: conversationMessages,
            tools: tools
          });
        } catch (error: any) {
          // Send retry notification to UI
          if (error.status === 429 || error.status >= 500 ||
              error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            _event.sender.send('ai:stream-chunk', {
              type: 'retry',
              sessionId,
              message: error.status === 429 ? 'Rate limited, retrying...' : 'Connection issue, retrying...'
            });
          }
          throw error;
        }
      });

      let currentText = '';
      let currentToolUses: any[] = [];

      // Send stream chunks to renderer
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            currentText += chunk.delta.text;
            // Send text chunk to renderer
            _event.sender.send('ai:stream-chunk', { type: 'text', content: chunk.delta.text, sessionId });
          }
        } else if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'tool_use') {
            currentToolUses.push(chunk.content_block);
          }
        }
      }

      const response = await stream.finalMessage();

      // Collect text content
      const textBlocks = response.content.filter(block => block.type === 'text');
      for (const block of textBlocks) {
        if (block.type === 'text') {
          finalResponse += block.text + '\n';
        }
      }

      // Check if AI wants to use tools
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

      if (toolUseBlocks.length === 0) {
        // No more tools to call, we're done
        break;
      }

      // Execute tools and collect results
      const toolResults: any[] = [];

      for (const toolBlock of toolUseBlocks) {
        if (toolBlock.type !== 'tool_use') continue;

        const toolName = toolBlock.name;
        const toolInput = toolBlock.input as any;
        const toolUseId = toolBlock.id;

        let result: any;

        try {
          switch (toolName) {
            case 'read_file':
              _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'read_file', status: 'executing', params: toolInput });
              const fileContent = await fs.readFile(toolInput.file_path, 'utf-8');
              result = { success: true, content: fileContent };
              finalResponse += `\n📄 Read: ${toolInput.file_path}\n`;
              _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'read_file', status: 'complete', params: toolInput });
              break;

            case 'write_file':
              _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'write_file', status: 'executing', params: { file_path: toolInput.file_path } });
              await fs.writeFile(toolInput.file_path, toolInput.content, 'utf-8');
              result = { success: true, message: 'File written successfully' };
              finalResponse += `\n✏️ Wrote: ${toolInput.file_path}\n`;
              _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'write_file', status: 'complete', params: { file_path: toolInput.file_path } });
              break;

            case 'execute_command':
              _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'execute_command', status: 'executing', params: toolInput });
              try {
                const { stdout, stderr } = await execAsync(toolInput.command, {
                  cwd: toolInput.cwd || process.cwd(),
                  maxBuffer: 1024 * 1024 * 10,
                });
                result = { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
                finalResponse += `\n⚡ Ran: ${toolInput.command}\n`;
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'execute_command', status: 'complete', params: toolInput, result: { stdout: stdout.trim() } });
              } catch (error: any) {
                result = {
                  success: false,
                  stdout: error.stdout?.trim() || '',
                  stderr: error.stderr?.trim() || error.message,
                  exitCode: error.code
                };
                finalResponse += `\n⚡ Ran: ${toolInput.command} (failed)\n`;
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'execute_command', status: 'error', params: toolInput, error: error.message });
              }
              break;

            case 'post_to_bridge':
              try {
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'post_to_bridge', status: 'executing', params: toolInput });

                // Send bridge message to renderer
                _event.sender.send('bridge:agent-post', {
                  from: context?.repoName || 'unknown',
                  message: toolInput.message,
                  type: toolInput.type || 'info',
                  timestamp: new Date().toISOString()
                });

                result = {
                  success: true,
                  message: 'Posted to bridge successfully'
                };

                finalResponse += `\n📢 Posted to Bridge: ${toolInput.message.substring(0, 100)}${toolInput.message.length > 100 ? '...' : ''}\n`;
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'post_to_bridge', status: 'complete', params: toolInput });
              } catch (error: any) {
                result = {
                  success: false,
                  error: error.message
                };
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'post_to_bridge', status: 'error', error: error.message });
              }
              break;

            case 'read_bridge':
              try {
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'read_bridge', status: 'executing', params: toolInput });

                // Bridge messages are already provided in your system prompt under "Recent Bridge Activity"
                // Check the context provided at the start of our conversation
                result = {
                  success: true,
                  message: 'Bridge messages are included in your system context. Check the "Recent Bridge Activity" section in your system prompt for the latest messages from other agents. Use post_to_bridge to add new messages.'
                };

                finalResponse += `\n👁️ Checked Bridge messages\n`;
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'read_bridge', status: 'complete', params: toolInput });
              } catch (error: any) {
                result = {
                  success: false,
                  error: error.message
                };
                _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: 'read_bridge', status: 'error', error: error.message });
              }
              break;

            default:
              result = { error: 'Unknown tool' };
          }
        } catch (error: any) {
          result = { error: error.message };
          _event.sender.send('ai:stream-chunk', { type: 'tool', sessionId, tool: toolName, status: 'error', error: error.message });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: JSON.stringify(result)
        });
      }

      // Add assistant message and tool results to conversation
      conversationMessages.push({
        role: 'assistant',
        content: response.content as any
      });

      conversationMessages.push({
        role: 'user',
        content: toolResults as any
      });
    }

    // Send completion event
    _event.sender.send('ai:stream-chunk', { type: 'done', sessionId });

    return finalResponse.trim() || 'Task completed';
  } catch (error: any) {
    console.error('AI chat error:', error);

    // Provide user-friendly error messages
    let userMessage = 'An error occurred while communicating with the AI.';

    if (error.status === 401) {
      userMessage = 'Invalid API key. Please check your API key in Settings.';
    } else if (error.status === 429) {
      userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (error.status === 500 || error.status === 502 || error.status === 503) {
      userMessage = 'Anthropic API is experiencing issues. Please try again in a few moments.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      userMessage = 'Network error. Please check your internet connection.';
    } else if (error.message?.includes('API Key not configured')) {
      userMessage = error.message;
    } else if (error.message) {
      userMessage = `Error: ${error.message}`;
    }

    _event.sender.send('ai:stream-chunk', {
      type: 'error',
      sessionId,
      error: userMessage,
      details: error.message || 'Unknown error'
    });
    throw new Error(userMessage);
  }
});
