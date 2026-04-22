import './ag-grid-modules';
import { installClipboardPolyfill } from './clipboard-polyfill';
installClipboardPolyfill();
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { installFetchMonitor } from './devtools/fetchMonitor';

const queryClient = new QueryClient();
installFetchMonitor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);