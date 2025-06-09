// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills'; // Import the plugin

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ // Add the plugin instance here
      // You can enable specific polyfills if you know which ones are needed.
      // For libraries like Tone.js, it's often safer to include common ones.
      // global: true,
      // process: true,
      // buffer: true,
      // events: true, // If you use the 'events' module
      // stream: true, // If needed
      // util: true, // If needed
      // etc.
      // Or, to include all polyfills (can increase bundle size):
      // include: null, // This is often the default or can be set to include all
      protocolImports: true, // Important if you use 'node:events' style imports
    }),
  ],
  // Optional: if Tone.js or its deps are CJS and cause issues with HMR or build
  // optimizeDeps: {
  //   include: ['tone', '@tonejs/midi', '@tonejs/piano', 'events'],
  // },
});