import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { AccessDenied } from './AccessDenied';

export function ProtectedRoute() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const profile = useAuthStore((s) => s.profile);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  // Stage 1: session resolving
  if (loading) {
    return (
      <div
        data-testid="auth-loading"
        aria-label="Checking your session"
        className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  // Stage 2: not signed in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Stage 3: profile still loading (prevents flash of protected content)
  if (profileLoading || profile === null) {
    return (
      <div
        data-testid="profile-loading"
        aria-label="Checking your session"
        className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  // Stage 4: not admin
  if (!isAdmin) {
    return <AccessDenied />;
  }

  // Stage 5: admin — render nested routes
  return <Outlet />;
}

export default ProtectedRoute;
