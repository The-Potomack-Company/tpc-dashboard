import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

export function AccessDenied() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex items-center justify-center h-dvh bg-bg">
      <div className="w-full max-w-md mx-4">
        <h1 className="text-2xl font-semibold text-ink text-center">
          Access denied
        </h1>
        <p
          role="alert"
          className="text-sm text-err mt-2 text-center"
        >
          This dashboard is restricted to admin accounts. You're signed in as{' '}
          {user?.email ?? 'unknown'}, which doesn't have dashboard access. Contact
          your admin if you need to be added.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="tpc-btn tpc-btn-secondary w-full min-h-12 mt-6 font-semibold"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default AccessDenied;
