import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
  server: {
    open: true,
    host: '0.0.0.0', // Позволяет принимать подключения с любого IP
    port: 3000, // Стандартный порт для React приложений
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // Локальный бэкенд на этой же машине
        changeOrigin: true,
      },
    },
  },
}); 