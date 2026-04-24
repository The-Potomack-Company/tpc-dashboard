import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';
import App from './App';
import { useAuthStore } from './stores/authStore';

// Module-level QueryClient so hot reloads reuse the same cache and Plan 04+
// components compose with a single provider tree.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Initialize auth listener before React renders. Matches TPC App pattern.
const unsubscribe = useAuthStore.getState().initialize();

// Cleanup the subscription on HMR dispose so the listener count stays at 1.
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribe());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);
