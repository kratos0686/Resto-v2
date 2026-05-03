import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LossFile } from '../types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
  AppProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../services/api', () => ({
  getProjects: vi.fn(),
}));

vi.mock('../services/EventBus', () => ({
  EventBus: { on: vi.fn(() => vi.fn()), publish: vi.fn() },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import Dashboard from '../components/Dashboard';
import { useAppContext } from '../context/AppContext';
import { getProjects } from '../services/api';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const mockSetSelectedProjectId = vi.fn();
const mockSetActiveTab = vi.fn();

const MOCK_USER = {
  id: 'U-001',
  email: 'test@test.com',
  name: 'Test User',
  role: 'Technician' as const,
  companyId: 'COMP-001',
  permissions: ['view_projects' as const],
};

const MOCK_PROJECTS: LossFile[] = [
  {
    id: 'P-1001',
    companyId: 'COMP-001',
    client: 'Alice Walker',
    address: '123 Main St',
    status: 'Active',
    currentStage: 'Monitor',
    progress: 65,
    riskLevel: 'high',
    rooms: [],
    milestones: [],
    tasks: [],
    lineItems: [],
    totalCost: 0,
    invoiceStatus: 'Draft',
    roomScans: [],
    videos: [],
    insurance: 'State Farm',
  },
  {
    id: 'P-1002',
    companyId: 'COMP-001',
    client: 'Bob Smith',
    address: '456 Oak Ave',
    status: 'Active',
    currentStage: 'Inspection',
    progress: 20,
    riskLevel: 'medium',
    rooms: [],
    milestones: [],
    tasks: [],
    lineItems: [],
    totalCost: 0,
    invoiceStatus: 'Draft',
    roomScans: [],
    videos: [],
  },
];

const baseContext = {
  currentUser: MOCK_USER,
  setSelectedProjectId: mockSetSelectedProjectId,
  setActiveTab: mockSetActiveTab,
  activeTab: 'dashboard' as const,
  selectedProjectId: null,
  isAuthenticated: true as boolean | null,
  isOnline: true,
  isCliOpen: false,
  setIsCliOpen: vi.fn(),
  accessToken: '',
  setCurrentUser: vi.fn(),
  setAuthentication: vi.fn(),
  setAccessToken: vi.fn(),
  addScanToProject: vi.fn(),
  hasPermission: vi.fn(() => true),
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

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({ ...baseContext });
    vi.mocked(getProjects).mockResolvedValue(MOCK_PROJECTS);
    mockSetSelectedProjectId.mockClear();
    mockSetActiveTab.mockClear();
  });

  it('shows all project cards after loading', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Alice Walker')).toBeInTheDocument());
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('shows empty state when no projects exist', async () => {
    vi.mocked(getProjects).mockResolvedValue([]);
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText(/No projects found/i)).toBeInTheDocument(),
    );
  });

  it('filters project cards by client name search term', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByText('Alice Walker'));

    const searchInput = screen.getByPlaceholderText(/Search projects/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
  });

  it('navigates to loss-detail when a project card is clicked', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByText('Alice Walker'));

    fireEvent.click(screen.getByText('Alice Walker'));

    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('P-1001');
    expect(mockSetActiveTab).toHaveBeenCalledWith('loss-detail');
  });
});
