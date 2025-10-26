import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './Terminal.css';

interface TerminalProps {
  terminalId: string;
  cwd?: string;
}

export function Terminal({ terminalId, cwd }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#4fc3f7',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      scrollback: 1000,
      allowProposedApi: true,
    });

    // Create fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Open terminal in DOM
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Focus the terminal so it can receive input
    xterm.focus();

    // Create terminal process via IPC
    window.electronAPI.createTerminal?.(terminalId, cwd || process.cwd()).then(() => {
      console.log('[Terminal] Created terminal process:', terminalId);
    });

    // Handle terminal input (user typing)
    xterm.onData((data) => {
      console.log('[Terminal] User input:', { terminalId, data: data.substring(0, 50) });
      window.electronAPI.writeToTerminal?.(terminalId, data);
    });

    // Listen for output from terminal process
    const handleTerminalData = (event: any, id: string, data: string) => {
      console.log('[Terminal] Received data:', { id, data: data.substring(0, 50) });
      if (id === terminalId && xtermRef.current) {
        xtermRef.current.write(data);
      }
    };

    window.electronAPI.onTerminalData?.(handleTerminalData);

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = xtermRef.current;
        window.electronAPI.resizeTerminal?.(terminalId, cols, rows);
      }
    };

    // Fit on mount and window resize
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      window.electronAPI.closeTerminal?.(terminalId);
      xterm.dispose();
    };
  }, [terminalId, cwd]);

  const handleClick = () => {
    xtermRef.current?.focus();
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        <span className="terminal-cwd">{cwd || '~'}</span>
      </div>
      <div ref={terminalRef} className="terminal-content" onClick={handleClick} />
    </div>
  );
}
