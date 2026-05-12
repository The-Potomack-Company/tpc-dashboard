import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';
import App from './App';
import { useAuthStore } from './stores/authStore';
import { initTheme } from './ui/tokens';

// Phase 7 — runtime dark-mode listener. The inline <script> in index.html
// handles the pre-paint sync pass; this attaches a matchMedia listener so a
// runtime OS theme flip updates .tpc-dark on <html> without a reload.
const teardownTheme = initTheme();

if (import.meta.hot) {
  import.meta.hot.dispose(() => teardownTheme());
}

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
