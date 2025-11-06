import { useEffect } from 'react';

interface KeyboardShortcuts {
  onSave?: () => void;
  onCloseTab?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onQuickOpen?: () => void;
  onGlobalSearch?: () => void;
  onToggleSidebar?: () => void;
  onToggleTerminal?: () => void;
}

export function useKeyboardShortcuts({
  onSave,
  onCloseTab,
  onNextTab,
  onPrevTab,
  onQuickOpen,
  onGlobalSearch,
  onToggleSidebar,
  onToggleTerminal,
}: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + S: Save
      if (modifier && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }

      // Cmd/Ctrl + W: Close tab
      if (modifier && e.key === 'w') {
        e.preventDefault();
        onCloseTab?.();
      }

      // Cmd/Ctrl + Tab: Next tab
      if (modifier && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        onNextTab?.();
      }

      // Cmd/Ctrl + Shift + Tab: Previous tab
      if (modifier && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        onPrevTab?.();
      }

      // Cmd/Ctrl + P: Quick open
      if (modifier && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        onQuickOpen?.();
      }

      // Cmd/Ctrl + Shift + F: Global search
      if (modifier && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        onGlobalSearch?.();
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (modifier && e.key === 'b') {
        e.preventDefault();
        onToggleSidebar?.();
      }

      // Ctrl + `: Toggle terminal
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        onToggleTerminal?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onCloseTab, onNextTab, onPrevTab, onQuickOpen, onToggleSidebar, onToggleTerminal]);
}
