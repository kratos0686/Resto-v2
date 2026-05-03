import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: 'IICRC research result',
        candidates: [{ groundingMetadata: { groundingChunks: [] } }],
      }),
    },
  })),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import ReferenceGuide from '../components/ReferenceGuide';
import { useAppContext } from '../context/AppContext';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReferenceGuide', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({
      isOnline: true,
    } as ReturnType<typeof useAppContext>);
    mockOnBack.mockClear();
  });

  it('renders the SR-500 Field Guide heading', () => {
    render(<ReferenceGuide onBack={mockOnBack} />);
    expect(screen.getByText(/SR-500 Field Guide/i)).toBeInTheDocument();
  });

  it('shows the search input with the correct online placeholder', () => {
    render(<ReferenceGuide onBack={mockOnBack} />);
    expect(screen.getByPlaceholderText(/Research IICRC standards/i)).toBeInTheDocument();
  });

  it('disables the search input when offline', () => {
    vi.mocked(useAppContext).mockReturnValue({
      isOnline: false,
    } as ReturnType<typeof useAppContext>);
    render(<ReferenceGuide onBack={mockOnBack} />);
    const input = screen.getByPlaceholderText(/Offline/i);
    expect(input).toBeDisabled();
  });

  it('calls onBack when the back arrow button is clicked', () => {
    render(<ReferenceGuide onBack={mockOnBack} />);
    const backBtn = screen.getAllByRole('button')[0];
    fireEvent.click(backBtn);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('renders IICRC equipment sizing content', () => {
    render(<ReferenceGuide onBack={mockOnBack} />);
    expect(screen.getByText(/Equipment Sizing/i)).toBeInTheDocument();
  });
});
