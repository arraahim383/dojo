import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// `vite build --mode static` (npm run build:static) makes a build for static hosting:
// relative file paths and no /api server (see src/services/paths.ts).
export default defineConfig(({ mode }) => ({
  base: mode === 'static' ? './' : '/',
  define: {
    'import.meta.env.VITE_STATIC': JSON.stringify(mode === 'static' ? '1' : ''),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  build: {
    outDir: mode === 'static' ? 'dist-static' : 'dist',
    rolldownOptions: {
      output: {
        // Libraries change rarely, so keep them in their own long-cached file.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
}));
