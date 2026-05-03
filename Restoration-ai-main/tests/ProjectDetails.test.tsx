import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Project } from '../types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getProjectById: vi.fn(),
  updateProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/EventBus', () => ({
  EventBus: { on: vi.fn(() => vi.fn()), publish: vi.fn() },
}));

vi.mock('../services/IntelligenceRouter', () => ({
  IntelligenceRouter: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({ text: '{}' }),
    generateNarrative: vi.fn().mockResolvedValue({ text: '' }),
    generateScope: vi.fn().mockResolvedValue({ text: '{"lineItems":[]}' }),
  })),
}));

// Stub all sub-components to avoid deep dependency chains in unit tests
vi.mock('../components/PhotoDocumentation', () => ({ default: () => <div>PhotoDocumentation</div> }));
vi.mock('../components/DryingLogs', () => ({ default: () => <div>DryingLogs</div> }));
vi.mock('../components/ComplianceChecklist', () => ({ default: () => <div>ComplianceChecklist</div> }));
vi.mock('../components/WalkthroughViewer', () => ({ default: () => <div>WalkthroughViewer</div> }));
vi.mock('../components/SmartDocumentation', () => ({ default: () => <div>SmartDocumentation</div> }));
vi.mock('../components/PredictiveAnalysis', () => ({ default: () => <div>PredictiveAnalysis</div> }));
vi.mock('../components/Forms', () => ({ default: () => <div>Forms</div> }));
vi.mock('../components/ReferenceGuide', () => ({ default: () => <div>ReferenceGuide</div> }));
vi.mock('../components/TicSheet', () => ({ default: () => <div>TicSheet</div> }));
vi.mock('../components/TaskManager', () => ({ default: () => <div>TaskManager</div> }));
vi.mock('../components/PsychrometricCalculator', () => ({ default: () => <div>PsychrometricCalculator</div> }));
vi.mock('../components/ARMapping', () => ({ default: () => <div>ARMapping</div> }));

// ─── Imports ──────────────────────────────────────────────────────────────────

import ProjectDetails from '../components/ProjectDetails';
import { useAppContext } from '../context/AppContext';
import { getProjectById } from '../services/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: 'p-1',
  companyId: 'c-1',
  client: 'Smith Residence',
  address: '42 Oak Street',
  status: 'Active',
  currentStage: 'Monitor',
  progress: 55,
  riskLevel: 'medium',
  rooms: [],
  milestones: [],
  tasks: [],
  lineItems: [],
  totalCost: 1500,
  invoiceStatus: 'Draft',
  roomScans: [],
  videos: [],
  equipment: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectDetails', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({
      selectedProjectId: undefined,
      setActiveTab: vi.fn(),
    } as unknown as ReturnType<typeof useAppContext>);
    vi.mocked(getProjectById).mockReset();
  });

  it('shows a loading spinner when no project has loaded yet', () => {
    vi.mocked(useAppContext).mockReturnValue({
      selectedProjectId: undefined,
      setActiveTab: vi.fn(),
    } as unknown as ReturnType<typeof useAppContext>);

    render(<ProjectDetails />);
    expect(screen.getByText(/Loading Project/i)).toBeInTheDocument();
  });

  it('renders the project client name after fetching the project', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      selectedProjectId: 'p-1',
      setActiveTab: vi.fn(),
    } as unknown as ReturnType<typeof useAppContext>);

    vi.mocked(getProjectById).mockResolvedValue(mockProject);

    render(<ProjectDetails />);

    await waitFor(() =>
      expect(screen.getByText('Smith Residence')).toBeInTheDocument(),
    );
  });

  it('renders the project address in the sidebar after fetching the project', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      selectedProjectId: 'p-1',
      setActiveTab: vi.fn(),
    } as unknown as ReturnType<typeof useAppContext>);

    vi.mocked(getProjectById).mockResolvedValue(mockProject);

    render(<ProjectDetails />);

    await waitFor(() =>
      expect(screen.getByText('42 Oak Street')).toBeInTheDocument(),
    );
  });
});
