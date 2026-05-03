import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: 'Mocked AI response' }),
    },
    live: { connect: vi.fn() },
  })),
  LiveServerMessage: {},
  Modality: { AUDIO: 'AUDIO' },
}));

vi.mock('../utils/audio', () => ({
  encode: vi.fn((data: Uint8Array) => btoa(String.fromCharCode(...Array.from(data)))),
  decode: vi.fn(() => new Uint8Array()),
  decodeAudioData: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import GeminiAssistant from '../components/GeminiAssistant';
import { useAppContext } from '../context/AppContext';

// ─── Shared mock helpers ──────────────────────────────────────────────────────

const mockOnClose = vi.fn();

const baseContext = {
  isOnline: true,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GeminiAssistant', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue(baseContext as ReturnType<typeof useAppContext>);
    mockOnClose.mockClear();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <GeminiAssistant context="test project" isOpen={false} onClose={mockOnClose} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the initial AI greeting message when opened', () => {
    render(
      <GeminiAssistant context="test project" isOpen={true} onClose={mockOnClose} />,
    );
    expect(screen.getByText('AI Assistant ready for test project.')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const { container } = render(
      <GeminiAssistant context="test project" isOpen={true} onClose={mockOnClose} />,
    );
    // The close button is the only button with `rounded-full` class in the header
    const closeBtn = container.querySelector('button.rounded-full') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('disables the text input when offline', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      ...baseContext,
      isOnline: false,
    } as ReturnType<typeof useAppContext>);

    render(
      <GeminiAssistant context="test project" isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Ask Gemini/i);
      expect(input).toBeDisabled();
    });
  });

  it('displays offline message when isOnline becomes false', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      ...baseContext,
      isOnline: false,
    } as ReturnType<typeof useAppContext>);

    render(
      <GeminiAssistant context="test project" isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/currently offline/i),
      ).toBeInTheDocument(),
    );
  });
});
