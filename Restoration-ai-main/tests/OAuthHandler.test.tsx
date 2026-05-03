import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock Firebase ────────────────────────────────────────────────────────────

vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {}
  return {
    signInWithPopup: vi.fn().mockResolvedValue({
      user: {
        uid: 'uid-123',
        email: 'test@example.com',
        displayName: 'Test User',
      },
    }),
    GoogleAuthProvider: MockGoogleAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import OAuthHandler from '../components/OAuthHandler';
import { useAppContext } from '../context/AppContext';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OAuthHandler', () => {
  const setAuthentication = vi.fn();
  const setCurrentUser = vi.fn();

  beforeEach(() => {
    setAuthentication.mockClear();
    setCurrentUser.mockClear();
    vi.mocked(useAppContext).mockReturnValue({
      setAuthentication,
      setCurrentUser,
    } as ReturnType<typeof useAppContext>);
  });

  it('renders the login card', () => {
    render(<OAuthHandler />);
    // "Restoration<span>AI</span> Secure Login" spans multiple elements — match h1 by its full textContent
    const h1 = document.querySelector('h1')!;
    expect(h1.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/RestorationAI Secure Login/);
  });

  it('shows the "Sign In with Google" button in idle state', () => {
    render(<OAuthHandler />);
    expect(screen.getByRole('button', { name: /Sign In with Google/i })).toBeInTheDocument();
  });

  it('renders three workflow steps', () => {
    render(<OAuthHandler />);
    expect(screen.getByText(/Authorization Request/i)).toBeInTheDocument();
    expect(screen.getByText(/Verifying User/i)).toBeInTheDocument();
    expect(screen.getByText(/Session Granted/i)).toBeInTheDocument();
  });

  it('shows the TLS encryption footer', () => {
    render(<OAuthHandler />);
    expect(screen.getByText(/256-bit TLS Encryption/i)).toBeInTheDocument();
  });

  it('shows the status message', () => {
    render(<OAuthHandler />);
    expect(screen.getByText(/Initializing Secure Login/i)).toBeInTheDocument();
  });

  it('calls signInWithPopup when the button is clicked', async () => {
    render(<OAuthHandler />);
    fireEvent.click(screen.getByRole('button', { name: /Sign In with Google/i }));
    const { signInWithPopup } = await import('firebase/auth');
    // Give async flow a tick to start
    await vi.waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
  });
});
