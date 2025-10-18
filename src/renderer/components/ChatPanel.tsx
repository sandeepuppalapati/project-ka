import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './ChatPanel.css';
import { useBridge, BridgeMessage } from '../contexts/BridgeContext';
import {
  useChatMessagesPersistence,
  serializeMessage,
  deserializeMessage,
  type PersistedMessage
} from '../hooks/usePersistence';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'command';
  content: string;
  timestamp: Date;
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
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputHistory = useRef<string[]>([]);

  // Load messages from localStorage
  const handleMessagesLoad = useCallback((loadedMessages: PersistedMessage[]) => {
    console.log(`[ChatPanel ${tabId}] handleMessagesLoad called with ${loadedMessages.length} messages`);
    console.log(`[ChatPanel ${tabId}] Message IDs:`, loadedMessages.map(m => m.id));
    if (loadedMessages.length > 0) {
      const deserialized = loadedMessages.map(deserializeMessage);
      console.log(`[ChatPanel ${tabId}] Setting messages to:`, deserialized.map(m => ({ id: m.id, content: m.content.substring(0, 50) })));
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

  const handleClearChat = () => {
    if (isBridge) {
      // Bridge clear: offer to clear all chats
      const clearAll = confirm('Clear Bridge messages?\n\nClick OK to clear Bridge only, or Cancel to clear ALL chats (Bridge + all agents).');
      if (clearAll === false) {
        // User clicked Cancel = clear everything
        if (confirm('This will clear the Bridge AND all agent chats. Continue?')) {
          // Clear bridge messages
          bridge.messages.length = 0;
          localStorage.removeItem('bridge_messages');

          // Clear all chat messages
          const allMessages = localStorage.getItem('chat_messages');
          if (allMessages) {
            localStorage.removeItem('chat_messages');
          }

          // Reset current bridge messages
          setMessages([getWelcomeMessage()]);

          alert('All chats cleared! Refresh the page to see the changes in agent tabs.');
        }
      } else {
        // User clicked OK = clear bridge only
        bridge.messages.length = 0;
        localStorage.removeItem('bridge_messages');
        setMessages([getWelcomeMessage()]);
      }
    } else {
      // Agent chat: just clear this agent's chat
      if (confirm('Clear all messages in this chat? This cannot be undone.')) {
        setMessages([getWelcomeMessage()]);
        // Clear from localStorage
        const allMessages = JSON.parse(localStorage.getItem('chat_messages') || '{}');
        delete allMessages[tabId];
        localStorage.setItem('chat_messages', JSON.stringify(allMessages));
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Set up streaming listener
  useEffect(() => {
    const cleanup = window.electronAPI.onStreamChunk((chunk) => {
      console.log(`[ChatPanel ${tabId}] Received chunk:`, { chunkSessionId: chunk.sessionId, mySessionId: sessionIdRef.current, type: chunk.type });

      // Only process chunks for this ChatPanel's session
      if (chunk.sessionId !== sessionIdRef.current) {
        console.log(`[ChatPanel ${tabId}] Ignoring chunk - sessionId mismatch`);
        return;
      }

      if (chunk.type === 'text') {
        setIsStreaming(true);
        // Append text chunk to the last assistant message
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content.includes('✅')) {
            // Update existing streaming message
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                content: lastMsg.content + chunk.content,
              }
            ];
          } else {
            // Create new assistant message for streaming
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
        // Show tool execution status with better formatting
        let toolDisplay = '';

        if (chunk.status === 'executing') {
          const params = chunk.params ? JSON.stringify(chunk.params).substring(0, 80) : '';
          toolDisplay = `\n\n🔧 **${chunk.tool}** (${params}${params.length >= 80 ? '...' : ''})`;
        } else if (chunk.status === 'complete') {
          toolDisplay = `\n✅ **${chunk.tool}** completed`;
        } else if (chunk.status === 'error') {
          toolDisplay = `\n❌ **${chunk.tool}** failed: ${chunk.error}`;
        }

        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            // Append tool status to current message
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                content: lastMsg.content + toolDisplay,
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

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput(prev => prev + finalTranscript);
          setTranscript('');
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        // Only stop recording for certain errors
        if (event.error === 'no-speech' || event.error === 'aborted') {
          setIsRecording(false);
          setTranscript('');
        }
        // Ignore network errors - they don't always prevent transcription
      };

      recognition.onend = () => {
        setIsRecording(false);
        setTranscript('');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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

  const popoutCommandOutput = (command: string, output: string) => {
    // Open in new window (future enhancement)
    console.log('Popout:', command, output);
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

  const renderMessageWithCommands = (content: string) => {
    // Parse markdown code blocks and add run buttons
    const parts: JSX.Element[] = [];
    const codeBlockRegex = /```(?:bash|shell|sh)?\n(.*?)\n```/gs;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add code block with run button
      const command = match[1].trim();
      parts.push(
        <div key={`code-${match.index}`} className="inline-command-block">
          <div className="command-header">
            <span className="command-label">Shell Command</span>
          </div>
          <div className="command-body">
            <pre><code>{command}</code></pre>
            <button
              className="inline-run-button"
              onClick={() => handleRunCommand(command, currentRepo?.path)}
              disabled={isProcessing}
            >
              ⚡ Run
            </button>
          </div>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : content;
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

  const toggleVoiceInput = async () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        // Request microphone permission first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Stop the stream since we just needed permission
        stream.getTracks().forEach(track => track.stop());

        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting voice recognition:', error);
        alert(`Voice input currently has limitations in Electron. Using text input for now.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="chat-panel">
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
            className="clear-chat-btn"
            onClick={handleClearChat}
            title="Clear all messages"
          >
            🗑️ Clear
          </button>
          <span className="chat-status">{isBridge ? 'Coordinating' : 'Ready'}</span>
        </div>
      </div>

      <div className="chat-messages">
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
                  <div className="bridge-agent-label">
                    [{bridgeMsg.agentName}]
                  </div>
                  <div className="message-text">
                    {bridgeMsg.content}
                  </div>
                  <div className="message-time">
                    {bridgeMsg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          // Regular chat: show local messages
          <>
          {messages.map((message, idx) => (
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
                <div className="message-text">
                  {renderMessageWithCommands(message.content)}
                </div>
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
              <span className="bridge-activity-count">{bridge.messages.length} messages</span>
            </div>
            <div className="bridge-activity-messages">
              {bridge.getRecentMessages(3).map(msg => (
                <div key={msg.id} className="bridge-activity-item">
                  <span className="bridge-activity-agent">[{msg.agentName}]</span>
                  <span className="bridge-activity-content">{msg.content.substring(0, 60)}...</span>
                </div>
              ))}
            </div>
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
        {/* Voice button hidden until API integration is complete */}
        {/* <button
          className={`voice-button ${isRecording ? 'recording' : ''}`}
          onClick={toggleVoiceInput}
          disabled={isProcessing}
          title={isRecording ? 'Stop recording' : 'Start voice input'}
        >
          🎤
        </button> */}
        <div className="input-wrapper">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message or command..."
            rows={3}
            disabled={isProcessing}
          />
          {transcript && (
            <div className="transcript-preview">{transcript}</div>
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
                Send
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
