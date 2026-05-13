import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { DashboardAppMark } from '../ui/icons/AppIcons';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(
        signInError.message || 'Incorrect email or password. Try again.',
      );
      setSubmitting(false);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex items-center justify-center h-dvh bg-bg">
      <div className="w-full max-w-sm mx-4">
        <div className="flex flex-col items-center mb-6">
          <DashboardAppMark size={56} />
          <h1 className="text-2xl font-semibold text-ink text-center mt-4">
            TPC Dashboard
          </h1>
          <p className="text-sm text-ink-3 text-center mt-1">
            Auction analytics for The Potomack Company
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-ink-2 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="tpc-input min-h-12 px-4 py-3"
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-ink-2 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="tpc-input min-h-12 px-4 py-3"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-12 rounded-md bg-accent text-accent-ink font-semibold mt-6 disabled:opacity-50 hover:bg-accent-hover focus:ring-2 focus:ring-accent outline-none transition-colors"
          >
            {submitting ? (
              <span
                role="status"
                aria-label="Signing in"
                className="animate-spin h-5 w-5 border-2 border-accent-ink border-t-transparent rounded-full inline-block"
              />
            ) : (
              'Sign In'
            )}
          </button>
          {error && (
            <p
              role="alert"
              className="text-sm text-err mt-3 text-center"
            >
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
