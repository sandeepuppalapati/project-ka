/**
 * Serialization utilities for converting between runtime objects and storable formats
 */

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

/**
 * Convert a message with Date timestamp to a storable format
 */
export function serializeMessage(msg: any): PersistedMessage {
  return {
    ...msg,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
  };
}

/**
 * Convert a stored message back to runtime format with Date object
 */
export function deserializeMessage(msg: PersistedMessage): any {
  return {
    ...msg,
    timestamp: new Date(msg.timestamp),
  };
}

/**
 * Convert a bridge message with Date timestamp to a storable format
 */
export function serializeBridgeMessage(msg: any): PersistedBridgeMessage {
  return {
    ...msg,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
  };
}

/**
 * Convert a stored bridge message back to runtime format with Date object
 */
export function deserializeBridgeMessage(msg: PersistedBridgeMessage): any {
  return {
    ...msg,
    timestamp: new Date(msg.timestamp),
  };
}
