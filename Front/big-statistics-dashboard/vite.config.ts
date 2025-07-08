import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    host: '0.0.0.0', // Позволяет принимать подключения с любого IP
    port: 3000, // Стандартный порт для React приложений
  },
}); 