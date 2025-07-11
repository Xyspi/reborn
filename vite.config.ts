import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'path';

export default defineConfig({
  plugins: [react()],
  root: join(__dirname, 'src/renderer'),
  publicDir: join(__dirname, 'public'),
  build: {
    outDir: join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    // Fix asset paths for Electron
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
  },
  // Use relative paths for assets in production
  base: './',
});