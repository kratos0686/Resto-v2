import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Project } from '../types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(),
  Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING' },
}));

vi.mock('../services/IntelligenceRouter', () => ({
  IntelligenceRouter: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({ text: '{}' }),
  })),
}));

vi.mock('../services/EventBus', () => ({
  EventBus: { on: vi.fn(() => vi.fn()), publish: vi.fn() },
}));

vi.mock('../utils/photoutils', () => ({
  blobToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
}));

vi.mock('../services/api', () => ({
  uploadMedia: vi.fn().mockResolvedValue(null),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import PhotoDocumentation from '../components/PhotoDocumentation';
import { useAppContext } from '../context/AppContext';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: 'p-1',
  companyId: 'c-1',
  client: 'Test Client',
  address: '1 Photo Ave',
  status: 'Active',
  currentStage: 'Monitor',
  progress: 60,
  riskLevel: 'low',
  rooms: [
    {
      id: 'r-1',
      name: 'Kitchen',
      dimensions: { length: 10, width: 10, height: 8 },
      readings: [],
      photos: [
        { id: 'ph-1', url: 'https://example.com/photo1.jpg', timestamp: Date.now(), tags: ['Water Loss'], notes: 'Main damage' },
        { id: 'ph-2', url: 'https://example.com/photo2.jpg', timestamp: Date.now(), tags: ['Carpet'], notes: '' },
      ],
      status: 'wet',
    },
  ],
  milestones: [],
  tasks: [],
  lineItems: [],
  totalCost: 0,
  invoiceStatus: 'Draft',
  roomScans: [],
  videos: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PhotoDocumentation', () => {
  const mockOnStartScan = vi.fn();
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({
      isOnline: true,
      accessToken: 'tok-123',
    } as ReturnType<typeof useAppContext>);
    mockOnStartScan.mockClear();
    mockOnUpdate.mockClear();
  });

  it('renders the Gallery tab as the default active view', () => {
    render(<PhotoDocumentation project={mockProject} onStartScan={mockOnStartScan} onUpdate={mockOnUpdate} />);
    // The "gallery" tab button should be visible
    expect(screen.getByRole('button', { name: /Gallery/i })).toBeInTheDocument();
  });

  it('shows the correct photo count from project rooms', () => {
    render(<PhotoDocumentation project={mockProject} onStartScan={mockOnStartScan} onUpdate={mockOnUpdate} />);
    // Both photos from the room should appear in the gallery (filter "All" by default)
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it('renders tag filter chips including "All"', () => {
    render(<PhotoDocumentation project={mockProject} onStartScan={mockOnStartScan} onUpdate={mockOnUpdate} />);
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
  });

  it('filters photos when a tag chip is clicked', () => {
    render(<PhotoDocumentation project={mockProject} onStartScan={mockOnStartScan} onUpdate={mockOnUpdate} />);
    // Tag "Carpet" exists from ph-2; clicking it should filter to 1 photo
    fireEvent.click(screen.getByRole('button', { name: /^Carpet$/i }));
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(1);
  });

  it('navigates to the AI Gen tab when its button is clicked', () => {
    render(<PhotoDocumentation project={mockProject} onStartScan={mockOnStartScan} onUpdate={mockOnUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /AI Gen/i }));
    // After clicking the AI Gen tab the gallery images are no longer shown
    expect(screen.queryAllByRole('img').length).toBe(0);
  });
});
