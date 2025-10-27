import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatPanel.css';
import { useBridge, BridgeMessage } from '../contexts/BridgeContext';
import {
  useChatMessagesPersistence,
  serializeMessage,
  deserializeMessage,
  type PersistedMessage
} from '../hooks/usePersistence';
import { VoiceRecorder } from './VoiceRecorder';

interface ToolExecution {
  tool: string;
  status: 'executing' | 'complete' | 'error';
  params: any;
  result?: any;
  error?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'command';
  content: string;
  timestamp: Date;
  hidden?: boolean; // For internal system messages not shown in UI
  tools?: ToolExecution[]; // Track tool executions for this message
  toolsCollapsed?: boolean; // Whether tool details are collapsed
  command?: {
    command: string;
    cwd?: string;
    output?: {
      success: boolean;
      stdout: string;
      stderr: string;
      exitCode?: number;
    };
    collapsed?: boolean;
  };
}

interface Repository {
  id: string;
  path: string;
  name: string;
}

interface ChatPanelProps {
  currentFile: { path: string; name: string } | null;
  currentRepo: Repository | null;
  isBridge: boolean;
  allRepos: Repository[];
}

export function ChatPanel({ currentFile, currentRepo, isBridge, allRepos }: ChatPanelProps) {
  const bridge = useBridge();

  // Generate unique tab ID for persistence - use useMemo to ensure stability
  const tabId = isBridge ? 'bridge' : `repo-${currentRepo?.id || 'unknown'}`;

  // Generate unique session ID for this ChatPanel instance to filter streaming responses
  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random()}`);

  // Voice recorder ref for keyboard shortcut
  const voiceRecorderRef = useRef<any>(null);

  // Welcome message - memoize to prevent recreation on each render
  const welcomeMessage: Message = {
    id: '1',
    role: 'assistant',
    content: isBridge
      ? '🌐 Welcome to the Bridge! This is where AI agents coordinate across repositories. Agents will post status updates, ask questions, and collaborate here.'
      : `Hello! I'm the AI agent for ${currentRepo?.name || 'this repository'}. I can help you with code changes, debugging, and more. I can also communicate with other agents via the Bridge.`,
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBridgeActivityCollapsed, setIsBridgeActivityCollapsed] = useState(false);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputHistory = useRef<string[]>([]);

  // Load messages from localStorage
  const handleMessagesLoad = useCallback((loadedMessages: PersistedMessage[]) => {
    if (loadedMessages.length > 0) {
      const deserialized = loadedMessages.map(deserializeMessage);
      setMessages(deserialized);
    }
  }, [tabId]);

  // Persist messages (convert to serializable format) - memoized to prevent unnecessary saves
  const persistedMessages = useMemo<PersistedMessage[]>(() => {
    return messages.map(msg => ({
      ...serializeMessage(msg),
      commandOutput: msg.command?.output ? {
        command: msg.command.command,
        success: msg.command.output.success,
        output: msg.command.output.stdout || msg.command.output.stderr,
      } : undefined,
    }));
  }, [messages]);

  useChatMessagesPersistence(tabId, persistedMessages, handleMessagesLoad);

  // Listen for storage events to sync clear operations across tabs/components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chat_messages' && e.newValue === null) {
        // All chats were cleared
        setMessages([welcomeMessage]);
      } else if (e.key === 'chat_messages' && e.newValue) {
        // Check if this tab's messages were cleared
        const allMessages = JSON.parse(e.newValue);
        if (!allMessages[tabId]) {
          setMessages([welcomeMessage]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [tabId, welcomeMessage]);

  // Check for OpenAI API key on mount and listen for settings changes
  useEffect(() => {
    const checkOpenAIKey = async () => {
      const settings = await window.electronAPI.getSettings?.();
      setHasOpenAIKey(!!settings?.openaiApiKey);
    };

    checkOpenAIKey();

    // Listen for settings updates
    const handleSettingsUpdate = (event: any) => {
      const settings = event.detail;
      setHasOpenAIKey(!!settings?.openaiApiKey);
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
  }, []);

  // Keyboard shortcut for voice input (Cmd/Ctrl+Shift+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
        e.preventDefault();
        if (hasOpenAIKey) {
          voiceRecorderRef.current?.toggleRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasOpenAIKey]);

  const handleExportChat = () => {
    const markdown = messages
      .map(msg => {
        const timestamp = msg.timestamp.toLocaleString();
        const role = msg.role === 'user' ? '**You**' : '**Assistant**';
        return `### ${role} - ${timestamp}\n\n${msg.content}\n\n---\n`;
      })
      .join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const chatName = isBridge ? 'bridge' : currentRepo?.name || 'chat';
    a.download = `${chatName}-conversation-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearChat = () => {
    if (isBridge) {
      // Bridge clear: clear bridge AND all agent chats (coordination context)
      if (confirm('Clear Bridge and all agent chats?\n\nThis will reset all conversations across the entire workspace. This cannot be undone.')) {
        // Clear bridge messages
        bridge.messages.length = 0;
        localStorage.removeItem('bridge_messages');

        // Clear all chat messages
        localStorage.removeItem('chat_messages');

        // Reset current bridge messages
        setMessages([welcomeMessage]);

        // Trigger storage event manually for same-window components
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'chat_messages',
          newValue: null,
          oldValue: localStorage.getItem('chat_messages'),
          storageArea: localStorage,
          url: window.location.href,
        }));
      }
    } else {
      // Agent chat: just clear this agent's chat
      if (confirm('Clear all messages in this chat? This cannot be undone.')) {
        setMessages([welcomeMessage]);
        // Clear from localStorage
        const allMessages = JSON.parse(localStorage.getItem('chat_messages') || '{}');
        delete allMessages[tabId];
        localStorage.setItem('chat_messages', JSON.stringify(allMessages));

        // Trigger storage event manually for same-window components
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'chat_messages',
          newValue: JSON.stringify(allMessages),
          oldValue: localStorage.getItem('chat_messages'),
          storageArea: localStorage,
          url: window.location.href,
        }));
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Check if user is at the bottom (within 50px threshold)
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Auto-scroll when messages change, but only if autoScroll is enabled
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, bridge.messages, autoScroll]);

  // Set up streaming listener (skip for Bridge tab)
  useEffect(() => {
    if (isBridge) {
      // Bridge doesn't use AI streaming
      return;
    }

    const cleanup = window.electronAPI.onStreamChunk((chunk) => {
      // Only process chunks for this ChatPanel's session
      if (chunk.sessionId !== sessionIdRef.current) {
        return;
      }

      if (chunk.type === 'text') {
        setIsStreaming(true);
        // Append text chunk to the last assistant message
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          // Always append to the last assistant message during streaming
          if (lastMsg && lastMsg.role === 'assistant') {
            // Update existing streaming message
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                content: lastMsg.content + chunk.content,
              }
            ];
          } else {
            // Create new assistant message for streaming (only if last msg is not assistant)
            return [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'assistant' as const,
                content: chunk.content || '',
                timestamp: new Date(),
              }
            ];
          }
        });
      } else if (chunk.type === 'tool') {
        // Track tool execution in tools array
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            const tools = lastMsg.tools || [];

            if (chunk.status === 'executing') {
              // Add new tool execution
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMsg,
                  tools: [...tools, {
                    tool: chunk.tool,
                    status: 'executing' as const,
                    params: chunk.params,
                  }],
                  toolsCollapsed: true, // Start collapsed
                }
              ];
            } else {
              // Update existing tool execution
              const toolIndex = tools.findIndex(t => t.tool === chunk.tool && t.status === 'executing');
              if (toolIndex >= 0) {
                const updatedTools = [...tools];
                updatedTools[toolIndex] = {
                  ...updatedTools[toolIndex],
                  status: chunk.status,
                  result: chunk.result,
                  error: chunk.error,
                };
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMsg,
                    tools: updatedTools,
                  }
                ];
              }
            }
          }
          return prev;
        });
      } else if (chunk.type === 'retry') {
        // Show retry notification
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            // Append retry notification to current message
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                content: lastMsg.content + `\n\n🔄 ${chunk.message}`,
              }
            ];
          }
          return prev;
        });
      } else if (chunk.type === 'done') {
        // Streaming complete - stop processing
        setIsStreaming(false);
        setIsProcessing(false);
      } else if (chunk.type === 'error') {
        // Handle streaming error
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: `Error: ${chunk.error}`,
            timestamp: new Date(),
          }
        ]);
        setIsStreaming(false);
        setIsProcessing(false);
      }
    });

    return cleanup;
  }, []);

  // Auto-respond when mentioned in bridge (for repo agents only)
  const lastBridgeMessageIdRef = useRef<string | null>(null);
  const autoResponseCountRef = useRef<number>(0);
  const autoResponseWindowRef = useRef<number>(Date.now());

  const handleAutoResponse = useCallback(async (bridgeMessage: BridgeMessage) => {
    // Circuit breaker: limit auto-responses to prevent infinite loops
    const now = Date.now();
    const WINDOW_MS = 60000; // 1 minute window
    const MAX_RESPONSES = 5; // Max 5 auto-responses per minute

    // Reset counter if window has passed
    if (now - autoResponseWindowRef.current > WINDOW_MS) {
      autoResponseCountRef.current = 0;
      autoResponseWindowRef.current = now;
    }

    // Check if we've exceeded the limit
    if (autoResponseCountRef.current >= MAX_RESPONSES) {
      console.warn(`[ChatPanel ${tabId}] Auto-response circuit breaker activated! Too many responses in the last minute.`);
      const warningMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `⚠️ Auto-response paused: Too many automatic responses detected. This prevents infinite loops. You can still manually respond if needed.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, warningMessage]);
      return;
    }

    autoResponseCountRef.current++;

    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    try {
      // Build context with bridge awareness
      const context: any = {
        isBridge: false,
        allRepos,
      };

      if (currentRepo) {
        context.repoPath = currentRepo.path;
        context.repoName = currentRepo.name;
      }

      if (currentFile?.path) {
        const fileContent = await window.electronAPI.readFile(currentFile.path);
        if (fileContent) {
          context.filePath = currentFile.path;
          context.fileContent = fileContent;
        }
      }

      // Include recent bridge messages
      const recentBridgeMessages = bridge.getRecentMessages(5);
      context.bridgeMessages = recentBridgeMessages.map(m => ({
        agentName: m.agentName,
        content: m.content,
        timestamp: m.timestamp,
      }));

      // Build API messages from current state
      const isUserBroadcast = bridgeMessage.agentName === 'You';
      const promptContent = isUserBroadcast
        ? `The user posted a message in the Bridge:\n\n"${bridgeMessage.content}"\n\nThis message was sent to ALL agents. Analyze if it's relevant to your repository:\n- If it's a request for information, status, summary, or help that you can provide → Use post_to_bridge to reply with relevant information\n- If it's not relevant to your repository → Simply respond "Not applicable to my repository"\n\nWhen responding, be helpful and provide specific information from your codebase.`
        : `You were mentioned by ${bridgeMessage.agentName} in the Bridge:\n\n"${bridgeMessage.content}"\n\nAnalyze this message carefully:\n- If it's a QUESTION or REQUEST that needs your response → Use post_to_bridge to reply\n- If it's just an ACKNOWLEDGMENT or STATUS UPDATE → Simply respond "No response needed" (do NOT use post_to_bridge)\n\nBe brief and only respond when truly necessary.`;

      const apiMessages = [
        {
          role: 'user' as const,
          content: promptContent,
        }
      ];

      // Add to UI as hidden message (for persistence but not display)
      const autoMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: apiMessages[0].content,
        timestamp: new Date(),
        hidden: true, // Don't show this internal trigger message
      };
      setMessages(prev => [...prev, autoMessage]);

      // Streaming will handle adding the response message
      await window.electronAPI.sendChatMessage(apiMessages, context, sessionIdRef.current);
    } catch (error: any) {
      console.error('Auto-response error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error auto-responding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsProcessing(false);
    }
  }, [tabId, allRepos, currentRepo, currentFile, bridge.getRecentMessages]);

  useEffect(() => {
    if (isBridge || !currentRepo || isProcessing) return;

    const recentMessages = bridge.getRecentMessages(1);
    if (recentMessages.length === 0) return;

    const latestMessage = recentMessages[0];

    // Skip if we've already processed this message
    if (latestMessage.id === lastBridgeMessageIdRef.current) return;

    // Skip if this agent is the author of the message (don't respond to self)
    if (latestMessage.agentName === `${currentRepo.name} Agent` || latestMessage.agentId === currentRepo.id) {
      lastBridgeMessageIdRef.current = latestMessage.id;
      return;
    }

    // Only respond to USER messages, not other agents' messages
    const isUserMessage = latestMessage.agentName === 'You';

    // Check if this agent is explicitly mentioned
    const agentMentions = [
      `@${currentRepo.name}`,
    ];

    const isMentioned = agentMentions.some(mention =>
      latestMessage.content.toLowerCase().includes(mention.toLowerCase())
    );

    // Auto-respond ONLY if it's a user message OR if explicitly mentioned
    // Do NOT respond to other agents' posts
    if (isMentioned || isUserMessage) {
      lastBridgeMessageIdRef.current = latestMessage.id;

      // Trigger automatic response - agent will decide if response is needed
      setTimeout(() => {
        handleAutoResponse(latestMessage);
      }, 500);
    }
  }, [bridge.messages, isBridge, currentRepo, isProcessing, handleAutoResponse, tabId]);


  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
  };

  const handleContinue = async () => {
    if (isProcessing) return;

    const continueMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: 'Continue',
      timestamp: new Date(),
    };

    const newMessages = [...messages, continueMessage];
    setMessages(newMessages);
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    try {
      // Build context with bridge awareness
      const context: any = {
        isBridge,
        allRepos,
      };

      if (currentRepo) {
        context.repoPath = currentRepo.path;
        context.repoName = currentRepo.name;
      }

      if (currentFile?.path) {
        const fileContent = await window.electronAPI.readFile(currentFile.path);
        if (fileContent) {
          context.filePath = currentFile.path;
          context.fileContent = fileContent;
        }
      }

      // Include recent bridge messages for repo agents
      if (!isBridge && bridge.messages.length > 0) {
        context.bridgeMessages = bridge.getRecentMessages(5).map(m => ({
          agentName: m.agentName,
          content: m.content,
          timestamp: m.timestamp,
        }));
      }

      // Build conversation history
      const apiMessages = newMessages
        .filter(msg => msg.id !== '1')
        .map(msg => {
          if (msg.role === 'command' && msg.command?.output) {
            return {
              role: 'assistant' as const,
              content: `Command executed: ${msg.command.command}\n\nOutput:\n${msg.command.output.stdout || ''}${msg.command.output.stderr ? '\nError: ' + msg.command.output.stderr : ''}`
            };
          }
          return {
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          };
        });

      // Streaming will handle adding the response message via onStreamChunk listener
      await window.electronAPI.sendChatMessage(apiMessages, context, sessionIdRef.current);
    } catch (error: any) {
      console.error('AI error:', error);
      if (error.name === 'AbortError') {
        const cancelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Request cancelled.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, cancelMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Add to history
    inputHistory.current.push(input.trim());
    setHistoryIndex(-1);

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    // If in Bridge, just post the message directly without AI response
    if (isBridge) {
      bridge.postToBridge({
        agentId: 'user',
        agentName: 'You',
        type: 'question',
        content: userMessage.content,
        metadata: {},
      });
      return;
    }

    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    try {
      // Build context with bridge awareness
      const context: any = {
        isBridge,
        allRepos,
      };

      if (currentRepo) {
        context.repoPath = currentRepo.path;
        context.repoName = currentRepo.name;
      }

      if (currentFile?.path) {
        const fileContent = await window.electronAPI.readFile(currentFile.path);
        if (fileContent) {
          context.filePath = currentFile.path;
          context.fileContent = fileContent;
        }
      }

      // Include recent bridge messages for repo agents
      if (!isBridge && bridge.messages.length > 0) {
        context.bridgeMessages = bridge.getRecentMessages(5).map(m => ({
          agentName: m.agentName,
          content: m.content,
          timestamp: m.timestamp,
        }));
      }

      // Build conversation history for API (exclude system messages, convert command messages to assistant context)
      const apiMessages = newMessages
        .filter(msg => msg.id !== '1') // Skip initial greeting
        .map(msg => {
          if (msg.role === 'command' && msg.command?.output) {
            // Convert command messages to assistant messages with output
            return {
              role: 'assistant' as const,
              content: `Command executed: ${msg.command.command}\n\nOutput:\n${msg.command.output.stdout || ''}${msg.command.output.stderr ? '\nError: ' + msg.command.output.stderr : ''}`
            };
          }
          return {
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          };
        });

      // Streaming will handle adding the response message via onStreamChunk listener
      await window.electronAPI.sendChatMessage(apiMessages, context, sessionIdRef.current);
    } catch (error: any) {
      console.error('AI error:', error);
      if (error.name === 'AbortError') {
        const cancelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Request cancelled.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, cancelMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response. Check your API key in .env'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const fileData = JSON.parse(data);
        if (fileData.type === 'file') {
          // Just add the file path to input
          setInput(prev => prev + (prev ? ' ' : '') + fileData.path);
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (inputHistory.current.length === 0) return;

      const newIndex = historyIndex === -1
        ? inputHistory.current.length - 1
        : Math.max(0, historyIndex - 1);

      setHistoryIndex(newIndex);
      setInput(inputHistory.current[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;

      const newIndex = historyIndex + 1;

      if (newIndex >= inputHistory.current.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(inputHistory.current[newIndex]);
      }
    }
  };

  const toggleCommandOutput = (messageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId && msg.command
        ? {
            ...msg,
            command: {
              ...msg.command,
              collapsed: !msg.command.collapsed
            }
          }
        : msg
    ));
  };

  const toggleToolsDisplay = (messageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, toolsCollapsed: !msg.toolsCollapsed }
        : msg
    ));
  };

  const popoutCommandOutput = (command: string, output: string) => {
    // Open in new window (future enhancement)
    alert(`Command: ${command}\n\nOutput:\n${output}`);
  };

  const handleFileEdit = async (filePath: string, content: string) => {
    const editMessage: Message = {
      id: Date.now().toString(),
      role: 'command',
      content: `Editing: ${filePath}`,
      timestamp: new Date(),
      command: {
        command: `Edit file: ${filePath}`,
        collapsed: true
      }
    };

    setMessages(prev => [...prev, editMessage]);
    setIsProcessing(true);

    try {
      const success = await window.electronAPI.writeFile(filePath, content);

      setMessages(prev => prev.map(msg =>
        msg.id === editMessage.id
          ? {
              ...msg,
              command: {
                ...msg.command!,
                output: {
                  success,
                  stdout: success ? 'File saved successfully' : '',
                  stderr: success ? '' : 'Failed to save file',
                }
              }
            }
          : msg
      ));
    } catch (error) {
      console.error('File edit error:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === editMessage.id
          ? {
              ...msg,
              command: {
                ...msg.command!,
                output: {
                  success: false,
                  stdout: '',
                  stderr: error instanceof Error ? error.message : 'Unknown error',
                }
              }
            }
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunCommand = async (command: string, cwd?: string) => {
    const commandMessage: Message = {
      id: Date.now().toString(),
      role: 'command',
      content: `Running: ${command}`,
      timestamp: new Date(),
      command: {
        command,
        cwd,
        collapsed: true // Start collapsed
      }
    };

    setMessages(prev => [...prev, commandMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const result = await window.electronAPI.executeCommand(command, cwd);

      // Update the command message with output
      setMessages(prev => prev.map(msg =>
        msg.id === commandMessage.id
          ? {
              ...msg,
              command: {
                ...msg.command!,
                output: result
              }
            }
          : msg
      ));
    } catch (error) {
      console.error('Command execution error:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === commandMessage.id
          ? {
              ...msg,
              command: {
                ...msg.command!,
                output: {
                  success: false,
                  stdout: '',
                  stderr: error instanceof Error ? error.message : 'Unknown error',
                }
              }
            }
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    // Could add a toast notification here
  };

  const renderMessageWithCommands = (content: string) => {
    return (
      <ReactMarkdown
        components={{
          p({ children }) {
            return <div className="markdown-paragraph">{children}</div>;
          },
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');
            const isShellCommand = !inline && (language === 'bash' || language === 'shell' || language === 'sh');

            if (isShellCommand) {
              return (
                <div className="code-block">
                  <div className="code-block-header">
                    <span className="code-language">bash</span>
                    <div className="code-actions">
                      <button
                        className="code-action-btn copy-btn"
                        onClick={() => handleCopyCode(codeString)}
                        title="Copy code"
                      >
                        📋 Copy
                      </button>
                      <button
                        className="code-action-btn run-btn"
                        onClick={() => handleRunCommand(codeString, currentRepo?.path)}
                        disabled={isProcessing}
                        title="Run command"
                      >
                        ⚡ Run
                      </button>
                    </div>
                  </div>
                  <div className="code-block-body">
                    <pre><code>{codeString}</code></pre>
                  </div>
                </div>
              );
            }

            if (!inline && language) {
              // Code block with language
              return (
                <div className="code-block">
                  <div className="code-block-header">
                    <span className="code-language">{language}</span>
                    <button
                      className="code-action-btn copy-btn"
                      onClick={() => handleCopyCode(codeString)}
                      title="Copy code"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div className="code-block-body">
                    <pre><code className={className} {...props}>{children}</code></pre>
                  </div>
                </div>
              );
            }

            return inline ? (
              <code className="inline-code" {...props}>
                {children}
              </code>
            ) : (
              <div className="code-block">
                <div className="code-block-header">
                  <span className="code-language">code</span>
                  <button
                    className="code-action-btn copy-btn"
                    onClick={() => handleCopyCode(codeString)}
                    title="Copy code"
                  >
                    📋 Copy
                  </button>
                </div>
                <div className="code-block-body">
                  <pre><code {...props}>{children}</code></pre>
                </div>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const handlePostToBridge = () => {
    // Find the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage || !currentRepo) return;

    bridge.postToBridge({
      agentId: currentRepo.id,
      agentName: `${currentRepo.name} Agent`,
      type: 'info',
      content: lastAssistantMessage.content,
      metadata: {
        repoPath: currentRepo.path,
      }
    });

    // Show confirmation
    alert(`Posted to Bridge from ${currentRepo.name} Agent`);
  };


  return (
    <div
      className={`chat-panel ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="chat-header">
        <h3>{isBridge ? '🌐 Bridge' : `🤖 ${currentRepo?.name || 'AI Agent'}`}</h3>
        <div className="chat-header-actions">
          {!isBridge && currentRepo && (
            <button
              className="post-to-bridge-btn"
              onClick={handlePostToBridge}
              title="Post last AI response to Bridge"
            >
              📤 Bridge
            </button>
          )}
          <button
            className="export-chat-btn"
            onClick={handleExportChat}
            title="Export chat to markdown"
          >
            📥 Export
          </button>
          <button
            className="clear-chat-btn"
            onClick={handleClearChat}
            title="Clear all messages"
          >
            🗑️ Clear
          </button>
          <span className="chat-status">{isBridge ? 'Coordinating' : 'Ready'}</span>
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {isBridge ? (
          // Bridge tab: show bridge messages
          <>
            <div className="message assistant">
              <div className="message-avatar">🌐</div>
              <div className="message-content">
                <div className="message-text">
                  {messages[0].content}
                </div>
              </div>
            </div>
            {bridge.messages.map(bridgeMsg => (
              <div key={bridgeMsg.id} className="message assistant bridge-message">
                <div className="message-avatar">📡</div>
                <div className="message-content">
                  <div className="bridge-agent-header">
                    <div className="bridge-agent-label">
                      [{bridgeMsg.agentName}]
                    </div>
                    {bridgeMsg.agentId !== 'user' && (
                      <button
                        className="disconnect-agent-btn"
                        onClick={() => {
                          if (confirm(`Disconnect ${bridgeMsg.agentName} from the Bridge? This will remove all messages from this agent.`)) {
                            bridge.disconnectAgent(bridgeMsg.agentId);
                          }
                        }}
                        title={`Disconnect ${bridgeMsg.agentName}`}
                      >
                        🔌 Disconnect
                      </button>
                    )}
                  </div>
                  <div className="message-text">
                    {renderMessageWithCommands(bridgeMsg.content)}
                  </div>
                  <div className="message-time">
                    {bridgeMsg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          // Regular chat: show local messages (exclude hidden messages)
          <>
          {messages.filter(m => !m.hidden).map((message, idx) => (
          <div key={message.id} className={`message ${message.role} ${isStreaming && idx === messages.length - 1 && message.role === 'assistant' ? 'streaming' : ''}`}>
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : message.role === 'command' ? '⚡' : '🤖'}
            </div>
            <div className="message-content">
              {message.role === 'command' && message.command ? (
                <div className="command-message">
                  <div className="command-input">
                    <span className="command-prompt">$</span>
                    <code>{message.command.command}</code>
                  </div>
                  {message.command.output && (
                    <>
                      <div className="command-output-controls">
                        <button
                          className="command-control-button"
                          onClick={() => toggleCommandOutput(message.id)}
                          title={message.command.collapsed ? "Expand output" : "Collapse output"}
                        >
                          {message.command.collapsed ? '▶ Show' : '▼ Hide'}
                        </button>
                        <button
                          className="command-control-button"
                          onClick={() => popoutCommandOutput(
                            message.command!.command,
                            `${message.command!.output?.stdout || ''}\n${message.command!.output?.stderr || ''}`
                          )}
                          title="Open in popup"
                        >
                          ⤢ Popout
                        </button>
                      </div>
                      {!message.command.collapsed && (
                        <div className={`command-output ${message.command.output.success ? 'success' : 'error'}`}>
                          {message.command.output.stdout && (
                            <pre className="stdout">{message.command.output.stdout}</pre>
                          )}
                          {message.command.output.stderr && (
                            <pre className="stderr">{message.command.output.stderr}</pre>
                          )}
                          {message.command.output.exitCode !== undefined && (
                            <div className="exit-code">Exit code: {message.command.output.exitCode}</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Tool executions display */}
                  {message.tools && message.tools.length > 0 && (
                    <div className="tools-display">
                      <button
                        className="tools-toggle"
                        onClick={() => toggleToolsDisplay(message.id)}
                      >
                        ⚙️ Using tools... {message.toolsCollapsed ? `[▼ Show ${message.tools.length} tools]` : `[▲ Hide ${message.tools.length} tools]`}
                      </button>
                      {!message.toolsCollapsed && (
                        <div className="tools-list">
                          {message.tools.map((tool, idx) => {
                            const icon = tool.status === 'complete' ? '✅' : tool.status === 'error' ? '❌' : '⏳';
                            const toolName = tool.tool;
                            let params = '';

                            // Format params based on tool type
                            if (toolName === 'read_file' && tool.params?.file_path) {
                              params = tool.params.file_path;
                            } else if (toolName === 'write_file' && tool.params?.file_path) {
                              params = tool.params.file_path;
                            } else if (toolName === 'execute_command' && tool.params?.command) {
                              params = tool.params.command;
                            } else if (toolName === 'post_to_bridge' && tool.params?.message) {
                              params = tool.params.message.substring(0, 60) + (tool.params.message.length > 60 ? '...' : '');
                            } else if (tool.params) {
                              params = JSON.stringify(tool.params).substring(0, 60);
                            }

                            return (
                              <div key={idx} className={`tool-execution ${tool.status}`}>
                                {icon} <strong>{toolName}</strong>: {params}
                                {tool.error && <div className="tool-error">Error: {tool.error}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="message-text">
                    {renderMessageWithCommands(message.content)}
                  </div>
                </>
              )}
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {!isBridge && isProcessing && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="message-text typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </>
        )}
      </div>

      <div className="chat-input-container">
        {/* Show recent bridge activity for repo agents */}
        {!isBridge && bridge.messages.length > 0 && (
          <div className="bridge-activity">
            <div className="bridge-activity-header">
              <span>🌐 Recent Bridge Activity</span>
              <div className="bridge-activity-controls">
                <span className="bridge-activity-count">{bridge.messages.length} messages</span>
                <button
                  className="bridge-activity-minimize"
                  onClick={() => setIsBridgeActivityCollapsed(!isBridgeActivityCollapsed)}
                  title={isBridgeActivityCollapsed ? "Show bridge activity" : "Hide bridge activity"}
                >
                  {isBridgeActivityCollapsed ? '▼' : '▲'}
                </button>
              </div>
            </div>
            {!isBridgeActivityCollapsed && (
              <div className="bridge-activity-messages">
                {bridge.getRecentMessages(3).map(msg => (
                  <div key={msg.id} className="bridge-activity-item">
                    <span className="bridge-activity-agent">[{msg.agentName}]</span>
                    <span className="bridge-activity-content">{msg.content.substring(0, 60)}...</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {currentRepo && (
          <div className="chat-context-bar">
            <span className="context-label">📁</span>
            <span className="context-path" title={currentRepo.path}>
              {currentRepo.name}
            </span>
          </div>
        )}
        <div className="input-row">
          <div className="input-wrapper">
            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isProcessing ? "AI is thinking..." : "Type a message or command..."}
              rows={3}
              disabled={isProcessing}
            />
            {hasOpenAIKey && (
              <VoiceRecorder
                ref={voiceRecorderRef}
                onTranscription={async (text) => {
                  if (!text.trim() || isProcessing) return;

                  const finalInput = (input + (input ? ' ' : '') + text).trim();

                  const userMessage: Message = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: finalInput,
                    timestamp: new Date(),
                  };

                  // Add to history
                  inputHistory.current.push(finalInput);
                  setHistoryIndex(-1);

                  const newMessages = [...messages, userMessage];
                  setMessages(newMessages);
                  setInput('');

                  // If in Bridge, just post the message
                  if (isBridge) {
                    bridge.postToBridge({
                      agentId: 'user',
                      agentName: 'You',
                      type: 'question',
                      content: userMessage.content,
                      metadata: {},
                    });
                    return;
                  }

                  setIsProcessing(true);
                  abortControllerRef.current = new AbortController();

                  try {
                    // Build context with bridge awareness
                    const context: any = {
                      isBridge,
                      allRepos,
                    };

                    if (currentRepo) {
                      context.repoPath = currentRepo.path;
                      context.repoName = currentRepo.name;
                    }

                    if (currentFile?.path) {
                      const fileContent = await window.electronAPI.readFile(currentFile.path);
                      if (fileContent) {
                        context.filePath = currentFile.path;
                        context.fileContent = fileContent;
                      }
                    }

                    // Include recent bridge messages for repo agents
                    if (!isBridge && bridge.messages.length > 0) {
                      context.bridgeMessages = bridge.getRecentMessages(5).map(m => ({
                        agentName: m.agentName,
                        content: m.content,
                        timestamp: m.timestamp,
                      }));
                    }

                    // Build conversation history for API
                    const apiMessages = newMessages
                      .filter(msg => msg.id !== '1') // Skip initial greeting
                      .map(msg => {
                        if (msg.role === 'command' && msg.command?.output) {
                          return {
                            role: 'assistant' as const,
                            content: `Command executed: ${msg.command.command}\n\nOutput:\n${msg.command.output.stdout || ''}${msg.command.output.stderr ? '\nError: ' + msg.command.output.stderr : ''}`
                          };
                        }
                        return {
                          role: msg.role as 'user' | 'assistant',
                          content: msg.content
                        };
                      });

                    await window.electronAPI.sendChatMessage(apiMessages, context, sessionIdRef.current);
                  } catch (error: any) {
                    console.error('AI error:', error);
                    if (error.name === 'AbortError') {
                      const cancelMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: 'Request cancelled.',
                        timestamp: new Date(),
                      };
                      setMessages(prev => [...prev, cancelMessage]);
                    } else {
                      const errorMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response. Check your API key in .env'}`,
                        timestamp: new Date(),
                      };
                      setMessages(prev => [...prev, errorMessage]);
                    }
                    setIsProcessing(false);
                    abortControllerRef.current = null;
                  }
                }}
                disabled={isProcessing}
              />
            )}
          </div>
          <div className="action-buttons">
            {isProcessing ? (
              <button
                className="chat-cancel"
                onClick={handleCancel}
              >
                ✕ Cancel
              </button>
            ) : (
              <>
                <button
                  className="chat-run"
                  onClick={() => handleRunCommand(input.trim(), currentRepo?.path)}
                  disabled={!input.trim() || isProcessing}
                  title="Run as shell command"
                >
                  ⚡ Run
                </button>
                <button
                  className="chat-send"
                  onClick={handleSend}
                  disabled={!input.trim() || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : (
                    'Send'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
