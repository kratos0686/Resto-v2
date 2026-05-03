import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock all heavy child components ─────────────────────────────────────────

vi.mock('../components/Dashboard', () => ({ default: () => <div data-testid="dashboard">Dashboard</div> }));
vi.mock('../components/NewProject', () => ({ default: () => <div data-testid="new-project">NewProject</div> }));
vi.mock('../components/ProjectDetails', () => ({ default: () => <div data-testid="project-details">ProjectDetails</div> }));
vi.mock('../components/TicSheet', () => ({ default: () => <div data-testid="tic-sheet">TicSheet</div> }));
vi.mock('../components/Settings', () => ({ default: () => <div data-testid="settings">Settings</div> }));
vi.mock('../components/Downloads', () => ({ default: () => <div data-testid="downloads">Downloads</div> }));
vi.mock('../components/EquipmentManager', () => ({ default: () => <div data-testid="equipment">Equipment</div> }));
vi.mock('../components/ARScanner', () => ({ default: () => <div data-testid="ar-scanner">ARScanner</div> }));
vi.mock('../components/GeminiAssistant', () => ({ default: () => <div data-testid="gemini">GeminiAssistant</div> }));

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getProjectById: vi.fn().mockResolvedValue(null),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import MobileApp from '../components/MobileApp';
import { useAppContext } from '../context/AppContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeCtx = (overrides = {}) => ({
  activeTab: 'dashboard',
  setActiveTab: vi.fn(),
  selectedProjectId: null,
  addScanToProject: vi.fn(),
  isOnline: true,
  hasPermission: vi.fn().mockReturnValue(true),
  setIsCliOpen: vi.fn(),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileApp', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue(makeCtx() as ReturnType<typeof useAppContext>);
  });

  it('renders without crashing', () => {
    const { container } = render(<MobileApp />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders the bottom navigation bar', () => {
    render(<MobileApp />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders the Dashboard when activeTab is "dashboard"', () => {
    render(<MobileApp />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('renders Downloads when activeTab is "downloads"', () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'downloads' }) as ReturnType<typeof useAppContext>,
    );
    render(<MobileApp />);
    expect(screen.getByTestId('downloads')).toBeInTheDocument();
  });

  it('renders NewProject when activeTab is "new-loss"', () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'new-loss' }) as ReturnType<typeof useAppContext>,
    );
    render(<MobileApp />);
    expect(screen.getByTestId('new-project')).toBeInTheDocument();
  });

  it('renders Settings when activeTab is "settings"', () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'settings' }) as ReturnType<typeof useAppContext>,
    );
    render(<MobileApp />);
    expect(screen.getByTestId('settings')).toBeInTheDocument();
  });

  it('shows Offline Banner when isOnline is false', () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ isOnline: false }) as ReturnType<typeof useAppContext>,
    );
    render(<MobileApp />);
    expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument();
  });

  it('does NOT show Offline Banner when online', () => {
    render(<MobileApp />);
    expect(screen.queryByText(/Offline Mode/i)).not.toBeInTheDocument();
  });

  it('calls setActiveTab("losses") when the Home nav button is clicked', () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<MobileApp />);
    const nav = screen.getByRole('navigation');
    // First nav button is Home
    fireEvent.click(nav.querySelectorAll('button')[0]);
    expect(ctx.setActiveTab).toHaveBeenCalledWith('losses');
  });

  it('calls setActiveTab("downloads") when the Downloads nav button is clicked', () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<MobileApp />);
    const nav = screen.getByRole('navigation');
    fireEvent.click(nav.querySelectorAll('button')[1]);
    expect(ctx.setActiveTab).toHaveBeenCalledWith('downloads');
  });

  it('calls setActiveTab("new-loss") when the + FAB is clicked', () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<MobileApp />);
    // The center "+" button lives in the nav bar area but above it
    const plusBtn = screen.getByRole('navigation').closest('div')!.querySelector('button.bg-brand-cyan')!;
    fireEvent.click(plusBtn);
    expect(ctx.setActiveTab).toHaveBeenCalledWith('new-loss');
  });

  it('hides bottom nav when activeTab is "scanner"', () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'scanner' }) as ReturnType<typeof useAppContext>,
    );
    render(<MobileApp />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('toggles the More menu when the Grid button is clicked', () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<MobileApp />);
    const nav = screen.getByRole('navigation');
    // Last button in nav is the More/Grid button
    const buttons = nav.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
