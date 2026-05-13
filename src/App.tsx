import { Routes, Route, Navigate } from 'react-router';
import { LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';
import { ExtensionPage } from './pages/Extension';
import { ActivityPage } from './pages/Activity';
import { SessionDetailPage } from './pages/SessionDetail';
import { StuckItemsPage } from './pages/StuckItems';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

// Phase 1 / INFR-03 — dev-only /kit route gated by import.meta.env.DEV.
// Vite replaces `import.meta.env.DEV` with the literal `false` at build time,
// so the ternary's else branch (null) is evaluated and the dynamic import is
// dead code. Rollup's tree-shaker drops the chunk. Verified post-build by
// scripts/verify-no-kit-in-dist.mjs.
//
// Requires tsconfig.app.json target=ES2022 + module=ESNext for top-level await
// (RESEARCH Pitfall 7).

const KitPage = import.meta.env.DEV
  ? (await import('./pages/Kit')).KitPage
  : null;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/extension" element={<ExtensionPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route
            path="/activity/sessions/:id"
            element={<SessionDetailPage />}
          />
          <Route path="/activity/stuck" element={<StuckItemsPage />} />
          {KitPage && <Route path="/kit" element={<KitPage />} />}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
