import { defineConfig } from 'vite';

// base './' keeps every asset path relative, so the same build works on
// GitHub Pages (/hackathon-2026-mo-tong/) and on a ModelScope static space
// served from its own root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    outDir: 'dist',
  },
  server: { port: 5183, strictPort: true },
});
