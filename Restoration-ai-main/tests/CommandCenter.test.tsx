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
      generateContent: vi.fn().mockResolvedValue({ text: 'AI response', functionCalls: [] }),
    },
  })),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
  FunctionDeclaration: {},
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import CommandCenter from '../components/CommandCenter';
import { useAppContext } from '../context/AppContext';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const mockOnClose = vi.fn();

const baseContext = {
  setActiveTab: vi.fn(),
  isOnline: true,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommandCenter', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue(baseContext as ReturnType<typeof useAppContext>);
    mockOnClose.mockClear();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<CommandCenter isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the terminal overlay when isOpen is true', () => {
    render(<CommandCenter isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Field_Kernel_v3\.3/i)).toBeInTheDocument();
  });

  it('shows the help hint in the terminal introduction', () => {
    render(<CommandCenter isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Field OS Terminal ready/i)).toBeInTheDocument();
  });

  it('displays ENCRYPTED_AUTH uplink status when online', () => {
    render(<CommandCenter isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/ENCRYPTED_AUTH/i)).toBeInTheDocument();
  });

  it('displays LOCAL_ONLY uplink status when offline', () => {
    vi.mocked(useAppContext).mockReturnValue({
      ...baseContext,
      isOnline: false,
    } as ReturnType<typeof useAppContext>);
    render(<CommandCenter isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/LOCAL_ONLY/i)).toBeInTheDocument();
  });

  it('calls onClose when the X button is clicked', () => {
    render(<CommandCenter isOpen={true} onClose={mockOnClose} />);
    // Find the button that calls onClose (top-right X — the only rounded-full button)
    const buttons = screen.getAllByRole('button');
    const xBtn = buttons.find(b => b.querySelector('svg'));
    expect(xBtn).toBeDefined();
    fireEvent.click(xBtn!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('appends an offline error to history when a command is sent while offline', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      ...baseContext,
      isOnline: false,
    } as ReturnType<typeof useAppContext>);
    render(<CommandCenter isOpen={true} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText(/Query system kernel/i);
    fireEvent.change(input, { target: { value: 'go to scanner' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText(/COMMAND REQUIRES FIELD_CLOUD UPLINK/i)).toBeInTheDocument();
  });
});
