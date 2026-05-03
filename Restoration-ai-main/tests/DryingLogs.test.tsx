import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Project } from '../types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../services/EventBus', () => ({
  EventBus: { on: vi.fn(() => vi.fn()), publish: vi.fn() },
}));

vi.mock('../utils/psychrometrics', () => ({
  calculatePsychrometricsFromDryBulb: vi.fn().mockReturnValue({ gpp: '45.0', dewPoint: '52' }),
}));

vi.mock('../data/materials', () => ({
  BUILDING_MATERIALS: [
    { category: 'Wood', items: [{ name: 'Hardwood Floor' }] },
  ],
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import DryingLogs from '../components/DryingLogs';
import { useAppContext } from '../context/AppContext';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: 'p-1',
  companyId: 'c-1',
  client: 'Jane Homeowner',
  address: '123 Main St',
  status: 'Active',
  currentStage: 'Monitor',
  progress: 50,
  riskLevel: 'medium',
  rooms: [{ id: 'r-1', name: 'Living Room', dimensions: { length: 15, width: 12, height: 8 }, readings: [], photos: [], status: 'drying' }],
  milestones: [],
  tasks: [],
  lineItems: [],
  totalCost: 0,
  invoiceStatus: 'Draft',
  roomScans: [],
  videos: [],
  equipment: [],
  dryingMonitor: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DryingLogs', () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({
      currentUser: { id: 'u-1', name: 'Tech User', email: 't@test.com', role: 'Technician', companyId: 'c-1', permissions: [] },
    } as ReturnType<typeof useAppContext>);
    mockOnUpdate.mockClear();
  });

  it('renders the dashboard view with the project client name', () => {
    render(<DryingLogs project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Jane Homeowner')).toBeInTheDocument();
  });

  it('shows the "Start Today\'s Log" call-to-action button', () => {
    render(<DryingLogs project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByRole('button', { name: /Start Today's Log/i })).toBeInTheDocument();
  });

  it('shows the Drying Progress section', () => {
    render(<DryingLogs project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/Drying Progress/i)).toBeInTheDocument();
  });

  it('shows materials count in the progress summary', () => {
    render(<DryingLogs project={mockProject} onUpdate={mockOnUpdate} />);
    // 0 materials tracked: "0 / 0"
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
  });

  it('opens the wizard on "Start Today\'s Log" click', () => {
    render(<DryingLogs project={mockProject} onUpdate={mockOnUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Start Today's Log/i }));
    expect(screen.getByText(/Atmospheric Data/i)).toBeInTheDocument();
  });
});
