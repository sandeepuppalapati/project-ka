import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  currentFile: { path: string; name: string } | null;
}

export function ChatPanel({ currentFile }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI coding assistant. I can help you work across multiple repositories. Try typing or using voice input!',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsProcessing(true);

    try {
      // Get current file content if available
      let context;
      if (currentFile?.path) {
        const fileContent = await window.electronAPI.readFile(currentFile.path);
        if (fileContent) {
          context = {
            filePath: currentFile.path,
            fileContent: fileContent
          };
        }
      }

      // Build conversation history for API (exclude system messages)
      const apiMessages = newMessages
        .filter(msg => msg.id !== '1') // Skip initial greeting
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const response = await window.electronAPI.sendChatMessage(apiMessages, context);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response. Check your API key in .env'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
        <h3>AI Assistant</h3>
        <span className="chat-status">Ready</span>
      </div>

      <div className="chat-messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
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
            placeholder="Type or use voice input..."
            rows={3}
            disabled={isProcessing}
          />
          {transcript && (
            <div className="transcript-preview">{transcript}</div>
          )}
        </div>
        <button
          className="chat-send"
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
        >
          Send
        </button>
      </div>
    </div>
  );
}
