import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Project } from '../types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: vi.fn().mockResolvedValue({ text: 'Load Check Complete' }) },
  })),
}));

vi.mock('../services/EventBus', () => ({
  EventBus: { on: vi.fn(() => vi.fn()), publish: vi.fn() },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import EquipmentManager from '../components/EquipmentManager';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: 'p-1',
  companyId: 'c-1',
  client: 'Test Client',
  address: '1 Test Ln',
  status: 'Active',
  currentStage: 'Stabilize',
  progress: 40,
  riskLevel: 'low',
  rooms: [],
  milestones: [],
  tasks: [],
  lineItems: [],
  totalCost: 0,
  invoiceStatus: 'Draft',
  roomScans: [],
  videos: [],
  equipment: [
    { id: 'EQ-001', type: 'Air Mover', model: 'Dri-Eaz Velo', status: 'Running', hours: 24, room: 'Living Room' },
    { id: 'EQ-002', type: 'Dehumidifier', model: 'LGR 3500i', status: 'Off', hours: 12, room: 'Basement' },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EquipmentManager', () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
  });

  it('renders the Equipment heading', () => {
    render(<EquipmentManager project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByRole('heading', { name: /Equipment/i })).toBeInTheDocument();
  });

  it('renders the Daily Burn Rate card', () => {
    render(<EquipmentManager project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/Daily Burn Rate/i)).toBeInTheDocument();
  });

  it('lists all deployed equipment models', () => {
    render(<EquipmentManager project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Dri-Eaz Velo')).toBeInTheDocument();
    expect(screen.getByText('LGR 3500i')).toBeInTheDocument();
  });

  it('shows a Stop button for running equipment', () => {
    render(<EquipmentManager project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
  });

  it('calls onUpdate when equipment status is toggled', () => {
    render(<EquipmentManager project={mockProject} onUpdate={mockOnUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Stop/i }));
    expect(mockOnUpdate).toHaveBeenCalledOnce();
    const updatedEquipment = mockOnUpdate.mock.calls[0][0].equipment;
    expect(updatedEquipment.find((e: { id: string }) => e.id === 'EQ-001').status).toBe('Off');
  });

  it('shows the Add Device button', () => {
    render(<EquipmentManager project={mockProject} onUpdate={mockOnUpdate} />);
    expect(screen.getByRole('button', { name: /Add Device/i })).toBeInTheDocument();
  });

  it('opens the equipment model menu when Add Device is clicked', () => {
    render(<EquipmentManager project={mockProject} onUpdate={mockOnUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Add Device/i }));
    expect(screen.getByText(/Select Model/i)).toBeInTheDocument();
  });
});
