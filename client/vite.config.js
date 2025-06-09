// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  server: { // Thêm cấu hình server
    proxy: {
      // Proxy requests to /api to your backend server
      '/api': {
        target: 'http://localhost:3000', // URL của backend server
        changeOrigin: true,
        // secure: false, // Nếu backend dùng HTTPS với self-signed cert
        // rewrite: (path) => path.replace(/^\/api/, '') // Nếu backend không có prefix /api
      }
    }
  }
});