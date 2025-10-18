import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import {
  useBridgeMessagesPersistence,
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
}

const BridgeContext = createContext<BridgeContextType | undefined>(undefined);

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<BridgeMessage[]>([]);

  // Load messages from localStorage
  const handleMessagesLoad = useCallback((loadedMessages: PersistedBridgeMessage[]) => {
    if (loadedMessages.length > 0) {
      setMessages(loadedMessages.map(deserializeBridgeMessage));
    }
  }, []);

  // Persist messages
  const persistedMessages: PersistedBridgeMessage[] = messages.map(serializeBridgeMessage);
  useBridgeMessagesPersistence(persistedMessages, handleMessagesLoad);

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

  // Listen for agent posts from main process
  useEffect(() => {
    const handleAgentPost = (_event: any, data: { from: string; message: string; type: string; timestamp: string }) => {
      postToBridge({
        agentId: data.from,
        agentName: `Agent ${data.from}`,
        type: data.type as any,
        content: data.message,
      });
    };

    window.electron.ipcRenderer.on('bridge:agent-post', handleAgentPost);

    return () => {
      window.electron.ipcRenderer.removeListener('bridge:agent-post', handleAgentPost);
    };
  }, [postToBridge]);

  return (
    <BridgeContext.Provider value={{ messages, postToBridge, getRecentMessages }}>
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
