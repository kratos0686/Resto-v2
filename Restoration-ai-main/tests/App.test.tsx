import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Module mocks (hoisted before imports) ───────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
  AppProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/useWindowSize', () => ({
  useWindowSize: vi.fn(),
}));

vi.mock('../components/MobileApp', () => ({
  default: () => React.createElement('div', { 'data-testid': 'mobile-app' }),
}));
vi.mock('../components/DesktopApp', () => ({
  default: () => React.createElement('div', { 'data-testid': 'desktop-app' }),
}));
vi.mock('../components/OAuthHandler', () => ({
  default: () => React.createElement('div', { 'data-testid': 'oauth-handler' }),
}));
vi.mock('../components/LaunchScreen', () => ({
  default: () => React.createElement('div', { 'data-testid': 'launch-screen' }),
}));
vi.mock('../components/CommandCenter', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? React.createElement('div', { 'data-testid': 'command-center' }) : null,
}));
vi.mock('../components/EventToast', () => ({ default: () => null }));

// ─── Imports that get the mocked modules ─────────────────────────────────────

import App from '../App';
import { useAppContext } from '../context/AppContext';
import { useWindowSize } from '../hooks/useWindowSize';

// ─── Shared mock helpers ──────────────────────────────────────────────────────

const mockSetIsCliOpen = vi.fn();

const baseContext = {
  isAuthenticated: true as boolean | null,
  isOnline: true,
  isCliOpen: false,
  setIsCliOpen: mockSetIsCliOpen,
  activeTab: 'dashboard' as const,
  setActiveTab: vi.fn(),
  selectedProjectId: null,
  setSelectedProjectId: vi.fn(),
  currentUser: null,
  setCurrentUser: vi.fn(),
  setAuthentication: vi.fn(),
  accessToken: '',
  setAccessToken: vi.fn(),
  addScanToProject: vi.fn(),
  hasPermission: vi.fn(() => false),
  settings: {
    language: 'English (US)',
    dateFormat: 'Month/Day/Year',
    timeFormat: 'Twelve Hours (AM/PM)',
    units: {
      temperature: 'Fahrenheit' as const,
      dimension: 'LF Inch' as const,
      humidity: 'Grains / Pound' as const,
      volume: 'Pint' as const,
    },
    copyPhotosToGallery: true,
    defaultView: 'Timeline' as const,
  },
  updateSettings: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({ ...baseContext });
    vi.mocked(useWindowSize).mockReturnValue({ width: 1024, height: 768 });
    mockSetIsCliOpen.mockClear();
  });

  it('shows LaunchScreen while authentication state is loading', async () => {
    vi.mocked(useAppContext).mockReturnValue({ ...baseContext, isAuthenticated: null });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('launch-screen')).toBeInTheDocument(),
    );
  });

  it('shows OAuthHandler when user is not authenticated', async () => {
    vi.mocked(useAppContext).mockReturnValue({ ...baseContext, isAuthenticated: false });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument(),
    );
  });

  it('renders DesktopApp when authenticated on a wide viewport', async () => {
    vi.mocked(useWindowSize).mockReturnValue({ width: 1024, height: 768 });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('desktop-app')).toBeInTheDocument(),
    );
  });

  it('renders MobileApp when authenticated on a narrow viewport', async () => {
    vi.mocked(useWindowSize).mockReturnValue({ width: 375, height: 812 });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('mobile-app')).toBeInTheDocument(),
    );
  });

  it('shows offline banner when not connected to network', async () => {
    vi.mocked(useAppContext).mockReturnValue({ ...baseContext, isOnline: false });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/Offline Mode Active/i)).toBeInTheDocument(),
    );
  });

  it('calls setIsCliOpen(true) when Ctrl+K is pressed', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('desktop-app'));
    fireEvent.keyDown(window, { ctrlKey: true, key: 'k' });
    expect(mockSetIsCliOpen).toHaveBeenCalledWith(true);
  });
});
