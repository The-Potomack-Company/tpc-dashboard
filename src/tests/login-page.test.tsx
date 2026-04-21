import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { LoginPage } from '../pages/Login';
import { useAuthStore } from '../stores/authStore';

// The authStore module auto-wires the supabase module; mock supabase to prevent
// real auth calls while the store is imported for test setup.
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

// Stub useNavigate so we can observe navigation calls.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>(
    'react-router',
  );
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      isAdmin: false,
      loading: false,
      profileLoading: false,
      signIn: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => undefined),
    });
  });

  it('renders title "TPC Dashboard" and UI-SPEC subtitle', () => {
    renderLogin();
    expect(
      screen.getByRole('heading', { name: 'TPC Dashboard' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Auction analytics for The Potomack Company'),
    ).toBeInTheDocument();
  });

  it('renders Email/Password inputs with correct types and a Sign In button', () => {
    renderLogin();
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    expect(email).toBeInTheDocument();
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('placeholder', 'you@example.com');
    expect(email).toBeRequired();
    expect(password).toBeInTheDocument();
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toBeRequired();
    expect(
      screen.getByRole('button', { name: 'Sign In' }),
    ).toBeInTheDocument();
  });

  it('submitting the form calls signIn with entered email + password', async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    useAuthStore.setState({ signIn });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('admin@example.com', 'supersecret');
    });
  });

  it('shows role="alert" error on failed signIn', async () => {
    const signIn = vi.fn(async () => ({
      error: new Error('Invalid login credentials'),
    }));
    useAuthStore.setState({ signIn });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid login credentials');
  });

  it('navigates to / on successful signIn', async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    useAuthStore.setState({ signIn });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
