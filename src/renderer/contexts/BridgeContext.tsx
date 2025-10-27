import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import {
  serializeBridgeMessage,
  deserializeBridgeMessage,
  type PersistedBridgeMessage
} from '../hooks/usePersistence';

export interface BridgeMessage {
  id: string;
  timestamp: Date;
  agentId: string;      // repo ID or 'user'
  agentName: string;    // e.g., "Backend Agent", "Frontend Agent", "You"
  type: 'status' | 'request' | 'info' | 'question' | 'user';
  content: string;
  metadata?: {
    repoPath?: string;
    filePaths?: string[];
  };
}

interface BridgeContextType {
  messages: BridgeMessage[];
  postToBridge: (message: Omit<BridgeMessage, 'id' | 'timestamp'>) => void;
  getRecentMessages: (count?: number) => BridgeMessage[];
  clearMessages: () => void;
  disconnectAgent: (agentId: string) => void;
  getConnectedAgents: () => string[];
  loadMessagesFromWorkspace: (workspacePath: string) => Promise<void>;
  saveMessagesToWorkspace: (workspacePath: string) => Promise<void>;
}

const BridgeContext = createContext<BridgeContextType | undefined>(undefined);

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<BridgeMessage[]>([]);

  // Note: Messages are now loaded from workspace files via loadMessagesFromWorkspace()
  // No longer using localStorage persistence

  const postToBridge = (message: Omit<BridgeMessage, 'id' | 'timestamp'>) => {
    const newMessage: BridgeMessage = {
      ...message,
      id: `bridge-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const getRecentMessages = (count: number = 10) => {
    return messages.slice(-count);
  };

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const disconnectAgent = useCallback((agentId: string) => {
    setMessages(prev => prev.filter(msg => msg.agentId !== agentId));
  }, []);

  const getConnectedAgents = useCallback(() => {
    const agentIds = new Set(messages.map(msg => msg.agentId));
    return Array.from(agentIds).filter(id => id !== 'user');
  }, [messages]);

  const loadMessagesFromWorkspace = useCallback(async (workspacePath: string) => {
    try {
      const loadedMessages = await window.electronAPI.loadChat?.(workspacePath, 'bridge');
      if (loadedMessages && loadedMessages.length > 0) {
        setMessages(loadedMessages.map(deserializeBridgeMessage));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load Bridge messages from workspace:', error);
      setMessages([]);
    }
  }, []);

  const saveMessagesToWorkspace = useCallback(async (workspacePath: string) => {
    try {
      const persistedMessages = messages.map(serializeBridgeMessage);
      await window.electronAPI.saveChat?.(workspacePath, 'bridge', persistedMessages);
    } catch (error) {
      console.error('Failed to save Bridge messages to workspace:', error);
    }
  }, [messages]);

  // Listen for agent posts from main process
  useEffect(() => {
    const handleAgentPost = (data: { from: string; message: string; type: string; timestamp: string }) => {
      const newMessage: BridgeMessage = {
        agentId: data.from,
        agentName: `${data.from} Agent`,  // Add " Agent" suffix to match format
        type: data.type as any,
        content: data.message,
        id: `bridge-${Date.now()}-${Math.random()}`,
        timestamp: new Date(data.timestamp),
      };
      setMessages(prev => [...prev, newMessage]);
    };

    window.electron.ipcRenderer.on('bridge:agent-post', handleAgentPost);

    return () => {
      window.electron.ipcRenderer.removeListener('bridge:agent-post', handleAgentPost);
    };
  }, []);

  return (
    <BridgeContext.Provider value={{
      messages,
      postToBridge,
      getRecentMessages,
      clearMessages,
      disconnectAgent,
      getConnectedAgents,
      loadMessagesFromWorkspace,
      saveMessagesToWorkspace
    }}>
      {children}
    </BridgeContext.Provider>
  );
}

export function useBridge() {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error('useBridge must be used within BridgeProvider');
  }
  return context;
}
