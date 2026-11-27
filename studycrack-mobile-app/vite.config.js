import { defineConfig } from 'vite';

const MOBILE_DIST_BASE = '/studycrack-mobile-app/dist/';

const calculatorOptionalChainCompatibility = {
  name: 'calculator-optional-chain-compatibility',
  apply: 'build',
  generateBundle: {
    order: 'post',
    handler(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const pending = [this.parse(chunk.code)];
        while (pending.length) {
          const node = pending.pop();
          if (!node || typeof node !== 'object') continue;
          if (node.type === 'ChainExpression') {
            // Older Chromium rejects non-final spread arguments in calls along an optional chain.
            let expression = node.expression;
            while (expression) {
              if (expression.type === 'CallExpression') {
                if (expression.arguments.slice(0, -1).some(argument => argument.type === 'SpreadElement')) {
                  this.error(`Non-final spread in an optional chain in ${chunk.fileName}`);
                }
                expression = expression.callee;
              } else if (expression.type === 'MemberExpression') expression = expression.object;
              else break;
            }
          }
          for (const child of Object.values(node)) pending.push(child);
        }
      }
    }
  }
};

// Runtime entry and output name are shared by local preview and the deployment workflow.
export default defineConfig(({ mode }) => ({
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
  }, ...(mode === 'jungsi-calculator' ? [calculatorOptionalChainCompatibility] : [])],
  esbuild: mode === 'jungsi-calculator' ? {
    jsx: 'transform',
    jsxFactory: 'createCalculatorElement',
    jsxFragment: 'CalculatorFragment',
    supported: { 'optional-chain': true },
    jsxInject: "import CalculatorReact from 'react'; const { createElement: createCalculatorElement, Fragment: CalculatorFragment } = CalculatorReact;"
  } : { jsx: 'automatic' },
  build: {
    minify: mode === 'jungsi-calculator' ? 'terser' : 'esbuild',
    ...(mode === 'jungsi-calculator' ? { terserOptions: { compress: { passes: 3, hoist_funs: true, hoist_props: true } } } : {}),
    assetsInlineLimit: () => false,
    outDir: 'dist',
    emptyOutDir: mode !== 'jungsi-calculator',
    rollupOptions: {
      input: mode === 'jungsi-calculator' ? 'src/runtime/jungsi-calculator.js' : 'src/runtime/main.js',
      output: {
        entryFileNames: mode === 'jungsi-calculator' ? 'jungsi-calculator.bundle.js' : 'studycrack-mobile.bundle.js',
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
}));
