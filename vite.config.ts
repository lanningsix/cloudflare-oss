import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy is removed in favor of direct CORS requests to the Worker
    // this reduces "Failed to fetch" errors caused by proxy misconfiguration.
  }
});