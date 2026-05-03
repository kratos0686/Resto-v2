import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WalkthroughViewer from '../components/WalkthroughViewer';
import { RoomScan } from '../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../services/EventBus', () => ({
  EventBus: { publish: vi.fn(), on: vi.fn(() => vi.fn()) },
}));

// ─── Fixture ──────────────────────────────────────────────────────────────────

const scan: RoomScan = {
  id: 'scan-1',
  roomName: 'Living Room',
  dimensions: { sqft: 200, length: 16, width: 12.5, height: 9 },
  floorPlanSvg: '<svg><rect width="100" height="100"/></svg>',
  placedPhotos: [],
};

const scanNoFloorplan: RoomScan = {
  id: 'scan-2',
  roomName: 'Kitchen',
  dimensions: { sqft: 150, length: 12, width: 12.5, height: 8 },
  floorPlanSvg: '',
  placedPhotos: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WalkthroughViewer', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('renders the room name in the header', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    expect(screen.getByText(/Living Room Floorplan/i)).toBeInTheDocument();
  });

  it('displays the square footage', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    expect(screen.getByText(/200\.0 SQ FT/i)).toBeInTheDocument();
  });

  it('calls onClose when the X button is clicked', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    // Find the close button as the last button in the header
    const header = document.querySelector('header')!;
    const headerBtns = header.querySelectorAll('button');
    fireEvent.click(headerBtns[headerBtns.length - 1]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders the SVG floor plan when floorPlanSvg is set', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('shows the "No floorplan available" fallback when floorPlanSvg is empty', () => {
    render(<WalkthroughViewer scan={scanNoFloorplan} onClose={onClose} />);
    expect(screen.getByText(/No floorplan available/i)).toBeInTheDocument();
  });

  it('shows the export menu when the Download button is clicked', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    const downloadBtn = screen.getAllByRole('button').find(
      b => b.getAttribute('title') === 'Export Floorplan',
    )!;
    fireEvent.click(downloadBtn);
    expect(screen.getByText(/PDF Document/i)).toBeInTheDocument();
    expect(screen.getByText(/AutoCAD \(DXF\)/i)).toBeInTheDocument();
  });

  it('hides the export menu when clicking again', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    const downloadBtn = screen.getAllByRole('button').find(
      b => b.getAttribute('title') === 'Export Floorplan',
    )!;
    fireEvent.click(downloadBtn); // open
    fireEvent.click(downloadBtn); // close
    expect(screen.queryByText(/PDF Document/i)).not.toBeInTheDocument();
  });

  it('zoom-in button increases zoom (does not throw)', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    // The zoom controls contain ZoomIn/ZoomOut/RotateCcw icons
    const zoomInBtn = screen.getAllByRole('button').at(-1)!;
    expect(() => fireEvent.click(zoomInBtn)).not.toThrow();
  });

  it('reset button resets zoom without throwing', () => {
    render(<WalkthroughViewer scan={scan} onClose={onClose} />);
    const resetBtn = screen.getAllByRole('button').at(-2)!;
    expect(() => fireEvent.click(resetBtn)).not.toThrow();
  });

  it('renders placed-photo thumbnails when the scan has placedPhotos', () => {
    const scanWithPhotos: RoomScan = {
      ...scan,
      placedPhotos: [
        { id: 'p1', url: 'https://example.com/photo1.jpg', thumbnailUrl: undefined, position: { wall: 'north', x: 0.5, y: 0.5 }, notes: '' },
      ],
    };
    render(<WalkthroughViewer scan={scanWithPhotos} onClose={onClose} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
