import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';
import { useBridge, BridgeMessage } from '../contexts/BridgeContext';

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: isBridge
        ? '🌐 Welcome to the Bridge! This is where AI agents coordinate across repositories. Agents will post status updates, ask questions, and collaborate here.'
        : `Hello! I'm the AI agent for ${currentRepo?.name || 'this repository'}. I can help you with code changes, debugging, and more. I can also communicate with other agents via the Bridge.`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputHistory = useRef<string[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Get current file content and repo context
      let context: { filePath?: string; fileContent?: string; repoPath?: string } = {};

      if (currentRepo?.path) {
        context.repoPath = currentRepo.path;
      }

      if (currentFile?.path) {
        const fileContent = await window.electronAPI.readFile(currentFile.path);
        if (fileContent) {
          context.filePath = currentFile.path;
          context.fileContent = fileContent;
        }
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

      const response = await window.electronAPI.sendChatMessage(apiMessages, context);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);

      // Tool execution happens server-side now
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
      // Get current file content and repo context
      let context: { filePath?: string; fileContent?: string; repoPath?: string } = {};

      if (currentRepo?.path) {
        context.repoPath = currentRepo.path;
      }

      if (currentFile?.path) {
        const fileContent = await window.electronAPI.readFile(currentFile.path);
        if (fileContent) {
          context.filePath = currentFile.path;
          context.fileContent = fileContent;
        }
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

      const response = await window.electronAPI.sendChatMessage(apiMessages, context);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);

      // Tool execution now happens server-side via Anthropic Tool Use API
      // AI autonomously calls read_file, write_file, execute_command tools
      // and continues until task is complete
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
          <pre><code>{command}</code></pre>
          <button
            className="inline-run-button"
            onClick={() => handleRunCommand(command, currentRepo?.path)}
            disabled={isProcessing}
          >
            ⚡ Run
          </button>
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
          messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
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
        )))}
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
