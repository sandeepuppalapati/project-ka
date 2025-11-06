import { useState, useCallback, useEffect, useRef } from 'react';
import type { WorkspaceState, UIState, OpenFile, RecentFile } from '../types/workspace';

export function useWorkspaceState(workspacePath: string | null) {
  const [state, setState] = useState<UIState>({
    openFiles: [],
    activeFileIndex: 0,
    expandedFolders: [],
    selectedRepo: null,
    activeChatTab: 'bridge',
    sidebarWidth: 250,
    chatPanelWidth: 400,
    disconnectedAgents: [],
    recentFiles: [],
  });

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workspacePathRef = useRef<string | null>(null);

  // Load state when workspace changes
  useEffect(() => {
    if (!workspacePath) {
      // Reset state when no workspace
      setState({
        openFiles: [],
        activeFileIndex: 0,
        expandedFolders: [],
        selectedRepo: null,
        activeChatTab: 'bridge',
        sidebarWidth: 250,
        chatPanelWidth: 400,
        disconnectedAgents: [],
        recentFiles: [],
      });
      workspacePathRef.current = null;
      return;
    }

    workspacePathRef.current = workspacePath;

    // Load state from workspace
    const loadState = async () => {
      try {
        const loadedState = await window.electronAPI.loadWorkspaceState?.(workspacePath);
        if (loadedState?.ui) {
          setState(loadedState.ui);
        }
      } catch (error) {
        console.error('Failed to load workspace state:', error);
      }
    };

    loadState();
  }, [workspacePath]);

  // Debounced save function
  const debouncedSave = useCallback((newState: UIState) => {
    if (!workspacePathRef.current) return;

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer
    saveTimerRef.current = setTimeout(async () => {
      if (!workspacePathRef.current) return;

      const workspaceState: WorkspaceState = {
        version: '1.0',
        lastModified: new Date().toISOString(),
        ui: newState,
      };

      try {
        await window.electronAPI.saveWorkspaceState?.(workspacePathRef.current, workspaceState);
      } catch (error) {
        console.error('Failed to save workspace state:', error);
      }
    }, 2000); // 2 second debounce
  }, []);

  // Immediate save function (for critical moments like workspace switch)
  const immediateSave = useCallback(async (stateToSave?: UIState) => {
    if (!workspacePathRef.current) return;

    // Cancel any pending debounced save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const workspaceState: WorkspaceState = {
      version: '1.0',
      lastModified: new Date().toISOString(),
      ui: stateToSave || state,
    };

    try {
      await window.electronAPI.saveWorkspaceState?.(workspacePathRef.current, workspaceState);
    } catch (error) {
      console.error('Failed to save workspace state immediately:', error);
    }
  }, [state]);

  // Update functions that trigger auto-save
  const updateOpenFiles = useCallback((openFiles: OpenFile[]) => {
    setState(prev => {
      const newState = { ...prev, openFiles };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  const updateActiveFileIndex = useCallback((index: number) => {
    setState(prev => {
      const newState = { ...prev, activeFileIndex: index };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  const updateExpandedFolders = useCallback((folders: string[]) => {
    setState(prev => {
      const newState = { ...prev, expandedFolders: folders };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  const updateSelectedRepo = useCallback((repoId: string | null) => {
    setState(prev => {
      const newState = { ...prev, selectedRepo: repoId };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  const updateActiveChatTab = useCallback((tabId: string) => {
    setState(prev => {
      const newState = { ...prev, activeChatTab: tabId };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  const updateSidebarWidth = useCallback((width: number) => {
    setState(prev => {
      const newState = { ...prev, sidebarWidth: width };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  const updateChatPanelWidth = useCallback((width: number) => {
    setState(prev => {
      const newState = { ...prev, chatPanelWidth: width };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  // Update cursor/scroll position for a specific file
  const updateFilePosition = useCallback((
    filePath: string,
    cursorPosition?: { line: number; column: number },
    scrollPosition?: number
  ) => {
    setState(prev => {
      const openFiles = prev.openFiles.map(file => {
        if (file.filePath === filePath) {
          return {
            ...file,
            ...(cursorPosition && { cursorPosition }),
            ...(scrollPosition !== undefined && { scrollPosition }),
          };
        }
        return file;
      });
      const newState = { ...prev, openFiles };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  // Add file to recent files (limit to 20 most recent)
  const addRecentFile = useCallback((file: RecentFile) => {
    setState(prev => {
      const recentFiles = prev.recentFiles || [];
      // Remove existing entry for this file
      const filtered = recentFiles.filter(f => f.path !== file.path);
      // Add to front with current timestamp
      const updated = [{ ...file, timestamp: Date.now() }, ...filtered].slice(0, 20);
      const newState = { ...prev, recentFiles: updated };
      debouncedSave(newState);
      return newState;
    });
  }, [debouncedSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    updateOpenFiles,
    updateActiveFileIndex,
    updateExpandedFolders,
    updateSelectedRepo,
    updateActiveChatTab,
    updateSidebarWidth,
    updateChatPanelWidth,
    updateFilePosition,
    addRecentFile,
    immediateSave,
  };
}
