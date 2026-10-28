import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { queryClient } from './lib/queryClient';
import { apiClient } from './services/api-client';
import { useAuthStore } from './store';

apiClient.setToken(useAuthStore.getState().token ?? '');

function TokenSync() {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (token) apiClient.setToken(token);
    else apiClient.clearToken();
  }, [token]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TokenSync />
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
