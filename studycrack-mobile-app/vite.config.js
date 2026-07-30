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
        format: 'iife'
      }
    }
  }
});
