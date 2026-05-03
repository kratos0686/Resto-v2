import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import AuthScreen from '../components/AuthScreen';
import { useAppContext } from '../context/AppContext';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthScreen', () => {
  const mockSetAuthentication = vi.fn();

  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({
      setAuthentication: mockSetAuthentication,
    } as ReturnType<typeof useAppContext>);
    mockSetAuthentication.mockClear();
    // Ensure no aistudio global in tests
    delete (window as Window & { aistudio?: unknown }).aistudio;
  });

  it('renders the RestorationAI brand heading', () => {
    render(<AuthScreen />);
    // The h1 heading contains "Restoration" + "AI" in its text content
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/RestorationAI/i);
  });

  it('shows the "Authorize with Google Cloud" button', () => {
    render(<AuthScreen />);
    expect(
      screen.getByRole('button', { name: /Authorize with Google Cloud/i }),
    ).toBeInTheDocument();
  });

  it('shows the IICRC S500 compliance badge', () => {
    render(<AuthScreen />);
    expect(screen.getByText(/IICRC S500/i)).toBeInTheDocument();
  });

  it('calls setAuthentication(true) when the sign-in button is clicked (local dev path)', async () => {
    render(<AuthScreen />);
    fireEvent.click(
      screen.getByRole('button', { name: /Authorize with Google Cloud/i }),
    );
    await waitFor(() =>
      expect(mockSetAuthentication).toHaveBeenCalledWith(true),
    );
  });

  it('calls setAuthentication via aistudio path when window.aistudio is available', async () => {
    (window as Window & { aistudio?: { openSelectKey: () => Promise<void>; hasSelectedApiKey: () => Promise<boolean> } }).aistudio = {
      openSelectKey: vi.fn().mockResolvedValue(undefined),
      hasSelectedApiKey: vi.fn().mockResolvedValue(true),
    };

    render(<AuthScreen />);
    fireEvent.click(
      screen.getByRole('button', { name: /Authorize with Google Cloud/i }),
    );

    await waitFor(() =>
      expect(mockSetAuthentication).toHaveBeenCalledWith(true),
    );
  });
});
