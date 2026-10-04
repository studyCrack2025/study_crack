import { defineConfig } from 'vite';

const MOBILE_DIST_BASE = '/studycrack-mobile-app/dist/';

// Runtime entry and output name are shared by local preview and the deployment workflow.
export default defineConfig({
  base: MOBILE_DIST_BASE,
  plugins: [{
    name: 'explicit-module-recovery',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const entry = bundle['studycrack-mobile.bundle.js'];
        if (entry?.type !== 'chunk') return;
        entry.code = entry.code.replace(/import\(("\.\/chunks\/screen-registry-app-[\w-]+\.js")\)/g,
          'import($1+(new URLSearchParams(globalThis.location?.search).has("_reload")?"?r="+encodeURIComponent(new URLSearchParams(globalThis.location.search).get("_reload")):""))');
      }
    }
  }],
  esbuild: {
    jsx: 'automatic'
  },
  build: {
    assetsInlineLimit: () => false,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/runtime/main.js',
      output: {
        entryFileNames: 'studycrack-mobile.bundle.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames(assetInfo) {
          if (assetInfo.name === 'main.css') return 'studycrack-mobile.css';
          if (assetInfo.name?.endsWith('.css')) return 'chunks/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
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
