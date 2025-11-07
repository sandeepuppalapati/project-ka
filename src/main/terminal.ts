import * as pty from 'node-pty';
import * as os from 'os';
import type { BrowserWindow } from 'electron';

interface TerminalProcess {
  pty: pty.IPty;
  cwd: string;
}

const terminals = new Map<string, TerminalProcess>();

export function createTerminal(window: BrowserWindow, terminalId: string, cwd: string): void {
  // Get shell based on platform
  const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';

  // Create PTY process
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: process.env as { [key: string]: string },
  });

  // Send data to renderer
  ptyProcess.onData((data) => {
    window.webContents.send('terminal:data', terminalId, data);
  });

  // Handle process exit
  ptyProcess.onExit(({ exitCode }) => {
    console.log('[Terminal] Process exited:', terminalId, 'with code:', exitCode);
    terminals.delete(terminalId);
  });

  terminals.set(terminalId, {
    pty: ptyProcess,
    cwd,
  });

  console.log('[Terminal] Created:', terminalId, 'in', cwd);
}

export function writeToTerminal(terminalId: string, data: string): void {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.pty.write(data);
  }
}

export function resizeTerminal(terminalId: string, cols: number, rows: number): void {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.pty.resize(cols, rows);
  }
}

export function closeTerminal(terminalId: string): void {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.pty.kill();
    terminals.delete(terminalId);
    console.log('[Terminal] Closed:', terminalId);
  }
}

export function closeAllTerminals(): void {
  for (const [id, terminal] of terminals.entries()) {
    try {
      // Force kill with SIGKILL
      terminal.pty.kill('SIGKILL');
      console.log('[Terminal] Closed:', id);
    } catch (err) {
      console.error('[Terminal] Error closing:', id, err);
    }
  }
  terminals.clear();
}
