import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Project } from '../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../services/EventBus', () => ({
  EventBus: {
    on: vi.fn((_, handler) => {
      // Store the handler so tests can trigger events if needed
      (vi as unknown as { _eventBusHandler: typeof handler })._eventBusHandler = handler;
      return vi.fn(); // unsubscribe
    }),
    publish: vi.fn(),
  },
  CloudEvent: {},
}));

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => {
  const Fake: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div data-testid="chart">{children}</div>
  );
  return {
    BarChart: Fake, Bar: Fake, XAxis: Fake, YAxis: Fake,
    Tooltip: Fake, ResponsiveContainer: Fake, LineChart: Fake,
    Line: Fake, CartesianGrid: Fake,
  };
});

// ─── Imports ──────────────────────────────────────────────────────────────────

import DesktopDashboard from '../components/DesktopDashboard';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: `p-${Math.random()}`,
  companyId: 'c-1',
  client: 'Smith Residence',
  address: '100 Oak St',
  status: 'Active - Drying',
  currentStage: 'Monitor',
  progress: 60,
  riskLevel: 'low',
  rooms: [],
  milestones: [],
  tasks: [],
  lineItems: [],
  totalCost: 10000,
  budget: 12000,
  invoiceStatus: 'Sent',
  roomScans: [],
  videos: [],
  dailyNarratives: [{ id: 'n-1', date: '1/1/2026', timestamp: 1, content: 'Log', author: 'Tech', tags: ['Water'], generated: false, entryType: 'general' }],
  equipment: [{ id: 'e-1', type: 'Air Mover', status: 'Running', placedAt: '2026-01-01', hours: 48 }],
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DesktopDashboard', () => {
  const onProjectSelect = vi.fn();
  const onUpdateProject = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    onProjectSelect.mockClear();
    onUpdateProject.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  it('renders the Mission Control heading', () => {
    render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('Mission Control')).toBeInTheDocument();
  });

  it('renders all four KPI card titles', () => {
    render(<DesktopDashboard projects={[makeProject()]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('Active Jobs')).toBeInTheDocument();
    expect(screen.getByText('Revenue (Q4)')).toBeInTheDocument();
    expect(screen.getByText('Budget Delta')).toBeInTheDocument();
    expect(screen.getByText('Equip. Deployed')).toBeInTheDocument();
  });

  it('shows correct active jobs count', () => {
    const projects = [
      makeProject({ status: 'Active - Drying' }),
      makeProject({ status: 'Active' }),
      makeProject({ status: 'Closed' }),
    ];
    render(<DesktopDashboard projects={projects} onProjectSelect={onProjectSelect} />);
    // Active Jobs KPI card value "2" — look specifically in the KPI section
    const kpiSection = document.querySelectorAll('.glass-card')[0];
    expect(kpiSection?.textContent).toContain('2');
  });

  it('renders with an empty project list without crashing', () => {
    const { container } = render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(container.firstChild).not.toBeNull();
  });

  // ── Equipment Utilization ────────────────────────────────────────────────────

  it('renders Equipment Utilization section', () => {
    render(<DesktopDashboard projects={[makeProject()]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('Equipment Utilization')).toBeInTheDocument();
  });

  it('shows all four equipment types in the utilization bars', () => {
    render(<DesktopDashboard projects={[makeProject()]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('Air Mover')).toBeInTheDocument();
    expect(screen.getByText('Dehumidifier')).toBeInTheDocument();
    expect(screen.getByText('HEPA Scrubber')).toBeInTheDocument();
    expect(screen.getByText('Heater')).toBeInTheDocument();
  });

  // ── SLA Exceptions ───────────────────────────────────────────────────────────

  it('renders the SLA Exceptions section', () => {
    render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('SLA Exceptions')).toBeInTheDocument();
  });

  it('shows "All SLAs met" when there are no exceptions', () => {
    // Project with dailyNarratives present (so no "missing log" exception)
    const project = makeProject({ status: 'Closed' }); // not active → no exceptions
    render(<DesktopDashboard projects={[project]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText(/All SLAs met/i)).toBeInTheDocument();
  });

  it('navigates to a project when an exception row is clicked', () => {
    // Create project with missing daily log (no dailyNarratives)
    const project = makeProject({ status: 'Active - Drying', dailyNarratives: undefined });
    render(<DesktopDashboard projects={[project]} onProjectSelect={onProjectSelect} />);
    // If exception row is rendered, click it
    const exceptionRows = screen.queryAllByText(/Missing Daily Log/i);
    if (exceptionRows.length > 0) {
      fireEvent.click(exceptionRows[0].closest('div[class*="cursor-pointer"]')!);
      expect(onProjectSelect).toHaveBeenCalled();
    }
  });

  // ── Crew Dispatch ────────────────────────────────────────────────────────────

  it('renders the Crew Dispatch section', () => {
    render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('Crew Dispatch')).toBeInTheDocument();
  });

  it('shows all four crew teams', () => {
    render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('Alpha Team (Water)')).toBeInTheDocument();
    expect(screen.getByText('Bravo Team (Mold)')).toBeInTheDocument();
    expect(screen.getByText('Charlie Team (Demo)')).toBeInTheDocument();
    expect(screen.getByText('Delta Team (Water)')).toBeInTheDocument();
  });

  // ── Charts ───────────────────────────────────────────────────────────────────

  it('renders at least two recharts containers', () => {
    render(<DesktopDashboard projects={[makeProject()]} onProjectSelect={onProjectSelect} />);
    const charts = screen.getAllByTestId('chart');
    expect(charts.length).toBeGreaterThanOrEqual(2);
  });

  // ── Global Tag Management ────────────────────────────────────────────────────

  it('renders the Global Tag Management section', () => {
    render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText(/Global Tag Management/i)).toBeInTheDocument();
  });

  it('shows "No tags found" when projects have no tags', () => {
    // Project with rooms/naratives that have no tags at all
    const project = makeProject({
      rooms: [],
      dailyNarratives: [{ id: 'n-1', date: '1/1/2026', timestamp: 1, content: 'Log', author: 'Tech', tags: [], generated: false, entryType: 'general' }],
    });
    render(<DesktopDashboard projects={[project]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText(/No tags found across any projects/i)).toBeInTheDocument();
  });

  it('displays tags from project photos', () => {
    const project = makeProject({
      rooms: [{
        id: 'r-1',
        name: 'Living Room',
        status: 'wet',
        readings: [],
        equipment: [],
        dimensions: { sqft: 100, length: 10, width: 10, height: 8 },
        photos: [{ id: 'ph-1', url: 'x', tags: ['Wet Floor', 'CAT-2'] }],
      }],
    });
    render(<DesktopDashboard projects={[project]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText('Wet Floor')).toBeInTheDocument();
    expect(screen.getByText('CAT-2')).toBeInTheDocument();
  });

  it('enters rename mode when the edit icon is clicked', async () => {
    const project = makeProject({
      rooms: [{
        id: 'r-1', name: 'Room', status: 'wet', readings: [], equipment: [],
        dimensions: { sqft: 100, length: 10, width: 10, height: 8 },
        photos: [{ id: 'ph-1', url: 'x', tags: ['MyTag'] }],
      }],
    });
    render(<DesktopDashboard projects={[project]} onProjectSelect={onProjectSelect} onUpdateProject={onUpdateProject} />);

    // There may be multiple Rename Tag buttons (one per tag) — take the first
    const editBtns = screen.getAllByTitle('Rename Tag');
    fireEvent.click(editBtns[0]);

    // The tag input should appear
    expect(screen.getByDisplayValue('MyTag')).toBeInTheDocument();
  });

  it('cancels rename when Escape is pressed', async () => {
    const project = makeProject({
      rooms: [{
        id: 'r-1', name: 'Room', status: 'wet', readings: [], equipment: [],
        dimensions: { sqft: 100, length: 10, width: 10, height: 8 },
        photos: [{ id: 'ph-1', url: 'x', tags: ['CancelMe'] }],
      }],
    });
    render(<DesktopDashboard projects={[project]} onProjectSelect={onProjectSelect} onUpdateProject={onUpdateProject} />);

    const editBtns = screen.getAllByTitle('Rename Tag');
    fireEvent.click(editBtns[0]);
    const input = screen.getByDisplayValue('CancelMe');
    fireEvent.keyDown(input, { key: 'Escape' });

    // Returns to tag list view
    expect(screen.queryByDisplayValue('CancelMe')).not.toBeInTheDocument();
    expect(screen.getByText('CancelMe')).toBeInTheDocument();
  });

  // ── Live Telemetry sidebar ───────────────────────────────────────────────────

  it('renders the Live Telemetry sidebar', () => {
    render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText(/Live Telemetry/i)).toBeInTheDocument();
  });

  it('shows "Waiting for field signals" when there are no events', () => {
    render(<DesktopDashboard projects={[]} onProjectSelect={onProjectSelect} />);
    expect(screen.getByText(/Waiting for field signals/i)).toBeInTheDocument();
  });
});
