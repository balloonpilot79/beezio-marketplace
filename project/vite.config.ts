import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Consolidated Vite config: single default export, React plugin, stable dev server port
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 3000,
    host: true,
    strictPort: false,
  },
  preview: {
    port: 3000,
    host: true,
    strictPort: false,
  },
});
