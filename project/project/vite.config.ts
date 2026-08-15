import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import lovingNutritionBrandingPlugin from './build-plugins/lovingNutritionBrandingPlugin';

export default defineConfig({
  plugins: [lovingNutritionBrandingPlugin(), react()],
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
