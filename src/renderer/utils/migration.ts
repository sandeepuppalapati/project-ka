/**
 * Migration utility to move localStorage data to workspace files
 */

const MIGRATION_COMPLETE_KEY = 'workspace_migration_complete';

interface OldStorageData {
  repos: Array<{ id: string; name: string; path: string }>;
  chatMessages: Record<string, any[]>;
  bridgeMessages: any[];
  workspace: any;
}

/**
 * Check if migration has already been completed
 */
export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_COMPLETE_KEY) === 'true';
}

/**
 * Mark migration as complete
 */
function markMigrationComplete() {
  localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
}

/**
 * Detect if there's old data that needs migration
 */
export function hasOldData(): boolean {
  // Check if migration already done
  if (isMigrationComplete()) {
    return false;
  }

  // Check for old localStorage keys
  const hasRepos = !!localStorage.getItem('app_repositories');
  const hasChats = !!localStorage.getItem('chat_messages');
  const hasBridge = !!localStorage.getItem('bridge_messages');

  return hasRepos || hasChats || hasBridge;
}

/**
 * Load all old data from localStorage
 */
function loadOldData(): OldStorageData {
  const repos = JSON.parse(localStorage.getItem('app_repositories') || '[]');
  const chatMessages = JSON.parse(localStorage.getItem('chat_messages') || '{}');
  const bridgeMessages = JSON.parse(localStorage.getItem('bridge_messages') || '[]');
  const workspace = JSON.parse(localStorage.getItem('app_workspace') || 'null');

  return {
    repos,
    chatMessages,
    bridgeMessages,
    workspace,
  };
}

/**
 * Migrate old localStorage data to a new workspace
 */
export async function migrateToWorkspace(): Promise<string | null> {
  try {
    console.log('[Migration] Starting migration to workspace...');

    // Load old data
    const oldData = loadOldData();

    if (oldData.repos.length === 0) {
      console.log('[Migration] No repos found, skipping migration');
      markMigrationComplete();
      return null;
    }

    // Get default workspace path
    const basePath = await window.electronAPI.getDefaultWorkspacePath?.();
    if (!basePath) {
      throw new Error('Could not get default workspace path');
    }

    // Create default workspace with existing repos
    console.log('[Migration] Creating "Default Workspace" with', oldData.repos.length, 'repos');
    const workspace = await window.electronAPI.createWorkspace?.(
      basePath,
      'Default Workspace',
      oldData.repos
    );

    if (!workspace) {
      throw new Error('Failed to create workspace');
    }

    console.log('[Migration] Workspace created at:', workspace.path);

    // Migrate chat messages (per repo)
    console.log('[Migration] Migrating chat messages...');
    for (const [repoId, messages] of Object.entries(oldData.chatMessages)) {
      if (messages && messages.length > 0) {
        await window.electronAPI.saveChat?.(workspace.path, repoId, messages);
        console.log(`[Migration] Migrated ${messages.length} messages for repo ${repoId}`);
      }
    }

    // Migrate bridge messages
    if (oldData.bridgeMessages && oldData.bridgeMessages.length > 0) {
      console.log('[Migration] Migrating', oldData.bridgeMessages.length, 'bridge messages');
      await window.electronAPI.saveChat?.(workspace.path, 'bridge', oldData.bridgeMessages);
    }

    // Clear old localStorage data (but keep app_settings)
    console.log('[Migration] Cleaning up old localStorage data...');
    localStorage.removeItem('app_repositories');
    localStorage.removeItem('chat_messages');
    localStorage.removeItem('bridge_messages');
    localStorage.removeItem('app_workspace');

    // Mark migration as complete
    markMigrationComplete();

    console.log('[Migration] Migration complete!');
    return workspace.path;
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    throw error;
  }
}

/**
 * Clear migration flag (for testing)
 */
export function resetMigrationFlag() {
  localStorage.removeItem(MIGRATION_COMPLETE_KEY);
}
