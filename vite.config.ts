import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// `vite build --mode static` (npm run build:static) makes a build for static hosting:
// relative file paths and no /api server (see src/services/paths.ts).
export default defineConfig(({ mode }) => {
  // Vercel's Supabase Marketplace integration uses NEXT_PUBLIC_ names. Map
  // just the two public client values so no unrelated variable is exposed.
  const publicSupabaseEnv = loadEnv(mode, process.cwd(), 'NEXT_PUBLIC_SUPABASE_');
  return {
    base: mode === 'static' ? './' : '/',
    define: {
      'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(publicSupabaseEnv.NEXT_PUBLIC_SUPABASE_URL || ''),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(publicSupabaseEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_STATIC': JSON.stringify(mode === 'static' ? '1' : ''),
      'import.meta.env.VITE_GEMINI_COACH': JSON.stringify(
        process.env.VITE_GEMINI_COACH === '1' || process.env.VERCEL === '1' || process.env.VERCEL === 'true' ? '1' : '',
      ),
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
  };
});
