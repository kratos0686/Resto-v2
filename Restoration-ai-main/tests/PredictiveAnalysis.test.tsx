import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getProjectById: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: vi.fn() },
  })),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY' },
}));

// recharts uses ResizeObserver / SVG measurement in jsdom; stub it out
vi.mock('recharts', () => ({
  AreaChart: ({ children }: React.PropsWithChildren) => <div data-testid="chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ReferenceLine: () => null,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import PredictiveAnalysis from '../components/PredictiveAnalysis';
import { useAppContext } from '../context/AppContext';
import { getProjectById } from '../services/api';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PredictiveAnalysis', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    mockOnBack.mockClear();
    vi.mocked(getProjectById).mockReset();
  });

  it('shows an analyzing state while the prediction is loading (online)', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      selectedProjectId: 'p-1',
      isOnline: true,
    } as ReturnType<typeof useAppContext>);

    // Keep the promise pending so we stay in the "analyzing" state
    vi.mocked(getProjectById).mockReturnValue(new Promise(() => {}));

    render(<PredictiveAnalysis onBack={mockOnBack} />);
    expect(screen.getByText(/Analyzing/i)).toBeInTheDocument();
  });

  it('shows offline fallback data when the device is offline', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      selectedProjectId: 'p-1',
      isOnline: false,
    } as ReturnType<typeof useAppContext>);

    vi.mocked(getProjectById).mockResolvedValue({
      id: 'p-1',
      companyId: 'c-1',
      client: 'Test',
      address: '1 St',
      status: 'Active',
      currentStage: 'Monitor',
      progress: 0,
      riskLevel: 'low',
      rooms: [],
      milestones: [],
      tasks: [],
      lineItems: [],
      totalCost: 0,
      invoiceStatus: 'Draft',
      roomScans: [],
      videos: [],
    });

    render(<PredictiveAnalysis onBack={mockOnBack} />);

    await waitFor(() =>
      expect(screen.getByText(/Pending Sync/i)).toBeInTheDocument(),
    );
  });

  it('calls onBack when the back button is clicked', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      selectedProjectId: 'p-1',
      isOnline: false,
    } as ReturnType<typeof useAppContext>);

    vi.mocked(getProjectById).mockResolvedValue({
      id: 'p-1',
      companyId: 'c-1',
      client: 'Test',
      address: '1 St',
      status: 'Active',
      currentStage: 'Monitor',
      progress: 0,
      riskLevel: 'low',
      rooms: [],
      milestones: [],
      tasks: [],
      lineItems: [],
      totalCost: 0,
      invoiceStatus: 'Draft',
      roomScans: [],
      videos: [],
    });

    render(<PredictiveAnalysis onBack={mockOnBack} />);

    await waitFor(() => screen.getByText(/Pending Sync/i));

    const backBtn = screen.getAllByRole('button')[0];
    backBtn.click();
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });
});
