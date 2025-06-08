// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// No need to import `resolve` from 'path' for this simpler alias

export default defineConfig({
  plugins: [react()],
});