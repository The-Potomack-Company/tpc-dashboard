import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { Session, User } from '@supabase/supabase-js';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuthStore } from '../stores/authStore';
import type { Database } from '../db/database.types';

// Mock the supabase module to prevent any real auth calls while exercising
// ProtectedRoute; authStore itself imports supabase at module load time.
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null, error: null })),
    })),
  },
}));

type Profile = Database['public']['Tables']['profiles']['Row'];

function makeSession(userId: string, email: string): Session {
  return {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: userId, email } as unknown as User,
  } as unknown as Session;
}

function makeProfile(role: 'admin' | 'specialist'): Profile {
  return {
    id: 'u1',
    role,
    display_name: role === 'admin' ? 'Admin' : 'Spec',
    is_active: true,
  } as unknown as Profile;
}

function TestTree() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/login"
          element={<div data-testid="login-page">LOGIN</div>}
        />
        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={<div data-testid="dashboard-content">DASH</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      isAdmin: false,
      loading: true,
      profileLoading: false,
      signIn: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => undefined),
    });
  });

  it('shows auth-loading spinner while loading===true', () => {
    render(<TestTree />);
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('redirects to /login when loading===false and session===null', () => {
    useAuthStore.setState({ loading: false, session: null });
    render(<TestTree />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('shows profile-loading spinner while session is set but profile is null', () => {
    const session = makeSession('u1', 'a@b.co');
    useAuthStore.setState({
      loading: false,
      session,
      user: session.user,
      profile: null,
      profileLoading: true,
    });
    render(<TestTree />);
    expect(screen.getByTestId('profile-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('shows AccessDenied when authenticated but not admin', () => {
    const session = makeSession('u2', 'spec@b.co');
    useAuthStore.setState({
      loading: false,
      session,
      user: session.user,
      profile: makeProfile('specialist'),
      profileLoading: false,
      isAdmin: false,
    });
    render(<TestTree />);
    expect(
      screen.getByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('renders Outlet content for authenticated admin', () => {
    const session = makeSession('u1', 'info@b.co');
    useAuthStore.setState({
      loading: false,
      session,
      user: session.user,
      profile: makeProfile('admin'),
      profileLoading: false,
      isAdmin: true,
    });
    render(<TestTree />);
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });
});
