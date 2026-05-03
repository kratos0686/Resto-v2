import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mock all heavy child components ─────────────────────────────────────────

vi.mock('../components/DesktopDashboard', () => ({
  default: ({ projects }: { projects: unknown[] }) => (
    <div data-testid="desktop-dashboard">DesktopDashboard ({projects.length} projects)</div>
  ),
}));
vi.mock('../components/ProjectDetails', () => ({ default: () => <div data-testid="project-details">ProjectDetails</div> }));
vi.mock('../components/PhotoDocumentation', () => ({ default: () => <div data-testid="photos">PhotoDocumentation</div> }));
vi.mock('../components/EquipmentManager', () => ({ default: () => <div data-testid="equipment">EquipmentManager</div> }));
vi.mock('../components/TicSheet', () => ({ default: () => <div data-testid="tic-sheet">TicSheet</div> }));
vi.mock('../components/Billing', () => ({ default: () => <div>Billing</div> }));
vi.mock('../components/Reporting', () => ({ default: () => <div>Reporting</div> }));
vi.mock('../components/AdminPanel', () => ({ default: () => <div>AdminPanel</div> }));
vi.mock('../components/ARMapping', () => ({ default: () => <div>ARMapping</div> }));

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      [
        { id: 'p-1', data: () => ({ client: 'Alpha Corp', address: '1 St', status: 'Active', currentStage: 'Monitor', totalCost: 5000, companyId: 'c-1', rooms: [], milestones: [], tasks: [], lineItems: [], invoiceStatus: 'Draft', roomScans: [], videos: [], dailyNarratives: [], progress: 50, riskLevel: 'low' }) },
        { id: 'p-2', data: () => ({ client: 'Beta Inc', address: '2 Ave', status: 'Closed', currentStage: 'Closeout', totalCost: 3000, companyId: 'c-1', rooms: [], milestones: [], tasks: [], lineItems: [], invoiceStatus: 'Paid', roomScans: [], videos: [], dailyNarratives: [], progress: 100, riskLevel: 'low' }) },
      ].forEach(cb);
    },
  }),
}));

vi.mock('../services/api', () => ({
  updateProject: vi.fn().mockResolvedValue({}),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import DesktopApp from '../components/DesktopApp';
import { useAppContext } from '../context/AppContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeCtx = (overrides = {}) => ({
  activeTab: 'dashboard',
  setActiveTab: vi.fn(),
  selectedProjectId: null,
  setSelectedProjectId: vi.fn(),
  isOnline: true,
  currentUser: { id: 'u-1', companyId: 'c-1', name: 'Admin', email: 'a@a.com', role: 'SuperAdmin', permissions: [] },
  hasPermission: vi.fn().mockReturnValue(true),
  setAuthentication: vi.fn(),
  setIsCliOpen: vi.fn(),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DesktopApp', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue(makeCtx() as ReturnType<typeof useAppContext>);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  it('renders without crashing', async () => {
    const { container } = render(<DesktopApp />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders the sidebar with navigation buttons', async () => {
    render(<DesktopApp />);
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
  });

  it('renders the DesktopDashboard on the "dashboard" tab', async () => {
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByTestId('desktop-dashboard')).toBeInTheDocument());
  });

  // ── Offline banner ───────────────────────────────────────────────────────────

  it('shows the Offline Mode banner when isOnline is false', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ isOnline: false }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    expect(screen.getByText(/Offline Mode Active/i)).toBeInTheDocument();
  });

  it('does NOT show the Offline Mode banner when online', async () => {
    render(<DesktopApp />);
    expect(screen.queryByText(/Offline Mode Active/i)).not.toBeInTheDocument();
  });

  // ── Sign out ─────────────────────────────────────────────────────────────────

  it('calls setAuthentication(false) when the sign-out button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    const signOutBtn = screen.getByTitle('Sign Out');
    fireEvent.click(signOutBtn);
    expect(ctx.setAuthentication).toHaveBeenCalledWith(false);
  });

  // ── Sidebar navigation ───────────────────────────────────────────────────────

  it('calls setActiveTab("dashboard") when Dashboard nav button is clicked', async () => {
    const ctx = makeCtx({ activeTab: 'losses' });
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(screen.getByTitle('Dashboard'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('dashboard');
  });

  it('calls setActiveTab("losses") when Projects nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(screen.getByTitle('Projects'));
    expect(ctx.setSelectedProjectId).toHaveBeenCalledWith(null);
    expect(ctx.setActiveTab).toHaveBeenCalledWith('losses');
  });

  it('calls setActiveTab("billing") when Billing nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(screen.getByTitle('Billing'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('billing');
  });

  it('calls setActiveTab("reporting") when Reports nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(screen.getByTitle('Reports'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('reporting');
  });

  it('calls setActiveTab("admin") when Admin nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(screen.getByTitle('Admin'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('admin');
  });

  it('calls setIsCliOpen(true) when Terminal nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(screen.getByTitle('Terminal'));
    expect(ctx.setIsCliOpen).toHaveBeenCalledWith(true);
  });

  // ── Permission-gated nav items ───────────────────────────────────────────────

  it('hides Projects / Billing when view_projects / view_billing permission is denied', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ hasPermission: vi.fn().mockReturnValue(false) }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    expect(screen.queryByTitle('Projects')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Billing')).not.toBeInTheDocument();
  });

  // ── Project list secondary sidebar ───────────────────────────────────────────

  it('shows the secondary project list sidebar when activeTab is "losses"', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'losses' }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByText(/Active Projects/i)).toBeInTheDocument());
  });

  it('loads and displays projects from Firestore in the sidebar', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'losses' }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByText('Alpha Corp')).toBeInTheDocument());
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  // ── Access Denied component ───────────────────────────────────────────────────

  it('renders Access Restricted when viewing reporting without view_admin permission', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({
        activeTab: 'reporting',
        hasPermission: vi.fn().mockReturnValue(false),
      }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument());
  });
});
