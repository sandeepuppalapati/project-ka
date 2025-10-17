import { createContext, useContext, useState, ReactNode } from 'react';

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
