import { defineConfig } from 'vite';

// Runtime entry and output name are shared by local preview and the deployment workflow.
export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/runtime/main.js',
      output: {
        entryFileNames: 'studycrack-mobile.bundle.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames(assetInfo) {
          return assetInfo.name?.endsWith('.css') ? 'studycrack-mobile.css' : 'assets/[name]-[hash][extname]';
        },
        format: 'es',
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/amazon-cognito-identity-js/') || id.includes('/js-cookie/')) return 'vendor-auth';
          return 'vendor';
        }
      }
    }
  }
});
