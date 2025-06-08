// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// No need to import `resolve` from 'path' for this simpler alias

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Tell Vite to use the installed 'events' package
      // when it encounters an import for the Node.js 'events' module.
      'events': 'events', 
    },
  },
  optimizeDeps: {
    // Explicitly include 'events' for pre-bundling by Vite's optimizer.
    // This helps ensure it's correctly processed.
    include: ['events'],
  },
  // If you are building a library or have specific needs, you might also need build options:
  // build: {
  //   rollupOptions: {
  //     plugins: [
  //       // You might need rollup-plugin-node-polyfills if 'events': 'events' alias isn't enough
  //       // import nodePolyfills from 'rollup-plugin-node-polyfills';
  //       // nodePolyfills(),
  //     ],
  //   },
  //   commonjsOptions: {
  //     transformMixedEsModules: true, // May help with mixed CJS/ESM dependencies
  //   }
  // }
});