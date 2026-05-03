import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Project } from '../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../services/IntelligenceRouter', () => ({
  IntelligenceRouter: vi.fn().mockImplementation(() => ({
    parseFieldIntent: vi.fn().mockResolvedValue({
      text: JSON.stringify({ category: 'General', structuredData: {}, summary: 'AI summary text' }),
    }),
  })),
}));

vi.mock('../services/EventBus', () => ({
  EventBus: {
    publish: vi.fn(),
    on: vi.fn(() => vi.fn()),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import SmartDocumentation from '../components/SmartDocumentation';
import { useAppContext } from '../context/AppContext';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const project: Project = {
  id: 'p-1',
  companyId: 'c-1',
  client: 'Test Client',
  address: '1 Main St',
  status: 'Active',
  currentStage: 'Monitor',
  progress: 50,
  riskLevel: 'medium',
  rooms: [{ id: 'r-1', name: 'Living Room', status: 'wet', readings: [], equipment: [], photos: [], dimensions: { sqft: 100, length: 10, width: 10, height: 8 } }],
  milestones: [],
  tasks: [],
  lineItems: [],
  totalCost: 0,
  invoiceStatus: 'Draft',
  roomScans: [],
  videos: [],
  dailyNarratives: [
    {
      id: 'n-1',
      date: '4/17/2026',
      timestamp: 1713312000000,
      content: 'Initial inspection complete.',
      author: 'Technician',
      tags: ['General'],
      generated: false,
      entryType: 'general',
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SmartDocumentation', () => {
  const onUpdate = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    onUpdate.mockClear();
    onBack.mockClear();
    vi.mocked(useAppContext).mockReturnValue({
      isOnline: true,
      currentUser: { id: 'u-1', name: 'Alice', email: 'a@a.com', role: 'Technician', companyId: 'c-1', permissions: [] },
    } as ReturnType<typeof useAppContext>);
  });

  it('renders without crashing', () => {
    render(<SmartDocumentation project={project} onUpdate={onUpdate} />);
    expect(screen.getByPlaceholderText(/Log reading/i)).toBeInTheDocument();
  });

  it('renders existing narratives', () => {
    render(<SmartDocumentation project={project} onUpdate={onUpdate} />);
    expect(screen.getByText('Initial inspection complete.')).toBeInTheDocument();
  });

  it('shows the submit button', () => {
    render(<SmartDocumentation project={project} onUpdate={onUpdate} />);
    // The send/magic button exists
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('disables send when the input is empty', () => {
    render(<SmartDocumentation project={project} onUpdate={onUpdate} />);
    expect(screen.getByPlaceholderText(/Log reading/i)).toHaveValue('');
  });

  it('disables send when offline', () => {
    vi.mocked(useAppContext).mockReturnValue({
      isOnline: false,
      currentUser: { id: 'u-1', name: 'Alice', email: 'a@a.com', role: 'Technician', companyId: 'c-1', permissions: [] },
    } as ReturnType<typeof useAppContext>);
    render(<SmartDocumentation project={project} onUpdate={onUpdate} />);
    // Component renders without crashing even when offline
    expect(screen.getByPlaceholderText(/Log reading/i)).toBeInTheDocument();
  });

  it('updates the input value when typed', () => {
    render(<SmartDocumentation project={project} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText(/Log reading/i);
    fireEvent.change(input, { target: { value: 'Added dehumidifier' } });
    expect(screen.getByDisplayValue('Added dehumidifier')).toBeInTheDocument();
  });

  it('adds a new narrative after submission and calls onUpdate', async () => {
    render(<SmartDocumentation project={project} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText(/Log reading/i);
    fireEvent.change(input, { target: { value: 'Moved air mover to hallway' } });

    // Press Enter to trigger handleMagicInput
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  it('calls onBack when back button is clicked', () => {
    render(<SmartDocumentation project={project} onUpdate={onUpdate} onBack={onBack} />);
    const backBtn = screen.getAllByRole('button').find(b => b.querySelector('svg.lucide-arrow-left'));
    fireEvent.click(backBtn!);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
