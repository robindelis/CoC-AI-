import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

let aiServerProc: ChildProcess | null = null;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'coc-ai-server-autostart',
      configureServer(server) {
        const rootDir = path.resolve(__dirname, '..');
        const venvPython = path.join(rootDir, '.venv', 'bin', 'python');
        const scriptPath = path.join(rootDir, 'python', 'ai_server.py');

        isPortOpen(8000).then((open) => {
          if (open || aiServerProc || !fs.existsSync(venvPython)) return;
          aiServerProc = spawn(venvPython, [scriptPath], {
            cwd: rootDir,
            stdio: 'ignore',
            detached: true,
          });
          aiServerProc.unref();
        });

        server.httpServer?.once('close', () => {
          if (aiServerProc && !aiServerProc.killed) {
            try {
              aiServerProc.kill();
            } catch {
              // ignore
            }
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
  },
  optimizeDeps: {
    exclude: ['coc-wasm'],
  },
});
