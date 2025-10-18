import { useEffect, useCallback, useRef } from 'react';

// Storage keys
const STORAGE_KEYS = {
  REPOS: 'app_repositories',
  WORKSPACE: 'app_workspace',
  CHAT_MESSAGES: 'chat_messages',
  BRIDGE_MESSAGES: 'bridge_messages',
  VERSION: 'storage_version',
} as const;

const STORAGE_VERSION = '1.0.0';

// Types
export interface PersistedRepo {
  id: string;
  path: string;
  name: string;
}

export interface PersistedWorkspace {
  activeTabId: string | null;
  activeChatTab: string;
  openTabs: {
    id: string;
    path: string;
    name: string;
    isDirty: boolean;
  }[];
}

export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant' | 'command';
  content: string;
  timestamp: string; // ISO string
  commandOutput?: {
    command: string;
    success: boolean;
    output: string;
  };
}

export interface PersistedBridgeMessage {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  type: 'status' | 'request' | 'info' | 'question' | 'user';
  content: string;
  metadata?: {
    repoPath?: string;
    filePaths?: string[];
  };
}

// Initialize storage with version check
export function initializeStorage() {
  const version = localStorage.getItem(STORAGE_KEYS.VERSION);

  if (version !== STORAGE_VERSION) {
    // Version mismatch - clear old data
    console.log(`Storage version mismatch (${version} -> ${STORAGE_VERSION}), clearing...`);
    clearAllStorage();
    localStorage.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);
  }
}

// Clear all persisted data
export function clearAllStorage() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

// Repositories persistence
export function saveRepositories(repos: PersistedRepo[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.REPOS, JSON.stringify(repos));
  } catch (error) {
    console.error('Failed to save repositories:', error);
  }
}

export function loadRepositories(): PersistedRepo[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REPOS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load repositories:', error);
    return [];
  }
}

// Workspace persistence
export function saveWorkspace(workspace: PersistedWorkspace) {
  try {
    localStorage.setItem(STORAGE_KEYS.WORKSPACE, JSON.stringify(workspace));
  } catch (error) {
    console.error('Failed to save workspace:', error);
  }
}

export function loadWorkspace(): PersistedWorkspace | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WORKSPACE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load workspace:', error);
    return null;
  }
}

// Chat messages persistence (per tab)
export function saveChatMessages(tabId: string, messages: PersistedMessage[]) {
  try {
    const allMessages = loadAllChatMessages();
    allMessages[tabId] = messages;
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(allMessages));
  } catch (error) {
    console.error(`Failed to save chat messages for ${tabId}:`, error);
  }
}

export function loadChatMessages(tabId: string): PersistedMessage[] {
  try {
    const allMessages = loadAllChatMessages();
    return allMessages[tabId] || [];
  } catch (error) {
    console.error(`Failed to load chat messages for ${tabId}:`, error);
    return [];
  }
}

function loadAllChatMessages(): Record<string, PersistedMessage[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load all chat messages:', error);
    return {};
  }
}

// Bridge messages persistence
export function saveBridgeMessages(messages: PersistedBridgeMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.BRIDGE_MESSAGES, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save bridge messages:', error);
  }
}

export function loadBridgeMessages(): PersistedBridgeMessage[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BRIDGE_MESSAGES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load bridge messages:', error);
    return [];
  }
}

// Hook for auto-saving repositories
export function useRepositoriesPersistence(
  repos: PersistedRepo[],
  onLoad: (repos: PersistedRepo[]) => void
) {
  // Load on mount
  useEffect(() => {
    initializeStorage();
    const saved = loadRepositories();
    if (saved.length > 0) {
      onLoad(saved);
    }
  }, [onLoad]);

  // Save on change
  useEffect(() => {
    if (repos.length > 0) {
      saveRepositories(repos);
    }
  }, [repos]);
}

// Hook for auto-saving workspace state
export function useWorkspacePersistence(
  workspace: PersistedWorkspace,
  onLoad: (workspace: PersistedWorkspace) => void
) {
  // Load on mount
  useEffect(() => {
    const saved = loadWorkspace();
    if (saved) {
      onLoad(saved);
    }
  }, [onLoad]);

  // Save on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveWorkspace(workspace);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [workspace]);
}

// Hook for auto-saving chat messages
export function useChatMessagesPersistence(
  tabId: string,
  messages: PersistedMessage[],
  onLoad: (messages: PersistedMessage[]) => void
) {
  const loadedRef = useRef(false);
  const tabIdRef = useRef(tabId);

  // Update ref when tabId changes
  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  // Load on mount ONLY
  useEffect(() => {
    if (!loadedRef.current) {
      const saved = loadChatMessages(tabIdRef.current);
      if (saved.length > 0) {
        onLoad(saved);
      }
      loadedRef.current = true;
    }
  }, [onLoad]);

  // Save on change (debounced)
  useEffect(() => {
    if (messages.length > 0 && loadedRef.current) {
      const timer = setTimeout(() => {
        saveChatMessages(tabIdRef.current, messages);
      }, 1000); // Debounce 1s

      return () => clearTimeout(timer);
    }
  }, [messages]);
}

// Hook for auto-saving bridge messages
export function useBridgeMessagesPersistence(
  messages: PersistedBridgeMessage[],
  onLoad: (messages: PersistedBridgeMessage[]) => void
) {
  // Load on mount
  useEffect(() => {
    const saved = loadBridgeMessages();
    if (saved.length > 0) {
      onLoad(saved);
    }
  }, [onLoad]);

  // Save on change (debounced)
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        saveBridgeMessages(messages);
      }, 1000); // Debounce 1s

      return () => clearTimeout(timer);
    }
  }, [messages]);
}

// Utility to convert between Date and ISO string
export function deserializeMessage(msg: PersistedMessage): any {
  return {
    ...msg,
    timestamp: new Date(msg.timestamp),
  };
}

export function serializeMessage(msg: any): PersistedMessage {
  return {
    ...msg,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
  };
}

export function deserializeBridgeMessage(msg: PersistedBridgeMessage): any {
  return {
    ...msg,
    timestamp: new Date(msg.timestamp),
  };
}

export function serializeBridgeMessage(msg: any): PersistedBridgeMessage {
  return {
    ...msg,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
  };
}
