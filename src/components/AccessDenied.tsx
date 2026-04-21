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
    <div className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900">
      <div className="w-full max-w-md mx-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center">
          Access denied
        </h1>
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 mt-2 text-center"
        >
          This dashboard is restricted to admin accounts. You're signed in as{' '}
          {user?.email ?? 'unknown'}, which doesn't have dashboard access. Contact
          your admin if you need to be added.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full min-h-12 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 font-semibold mt-6 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default AccessDenied;
