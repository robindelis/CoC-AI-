import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createCocAiServerPlugin, isPortOpen } from './src/ai/aiServerPlugin';

let aiServerProc: ChildProcess | null = null;
const rootDir = path.resolve(__dirname, '..');
const wasmJsPath = path.resolve(__dirname, 'src/wasm-pkg/coc_wasm.js');
const simTsFallbackPath = path.resolve(__dirname, 'src/sim-ts/coc_sim.ts');

export default defineConfig({
  resolve: {
    alias: fs.existsSync(wasmJsPath)
      ? {}
      : {
          './wasm-pkg/coc_wasm': simTsFallbackPath,
          '../wasm-pkg/coc_wasm': simTsFallbackPath,
        },
  },
  plugins: [
    react(),
    createCocAiServerPlugin(rootDir),
    {
      name: 'coc-ai-server-autostart',
      configureServer(server) {
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
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['coc-wasm'],
  },
});
