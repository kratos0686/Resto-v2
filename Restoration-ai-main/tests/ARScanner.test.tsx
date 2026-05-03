import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: vi.fn() },
  })),
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    ARRAY: 'ARRAY',
  },
}));

vi.mock('../utils/photoutils', () => ({
  blobToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
}));

vi.mock('../services/EventBus', () => ({
  EventBus: { on: vi.fn(() => vi.fn()), publish: vi.fn() },
}));

// Stub browser sensor and media APIs unavailable in jsdom
Object.defineProperty(global, 'DeviceMotionEvent', {
  value: { requestPermission: undefined },
  writable: true,
});

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  writable: true,
});

// ─── Imports ──────────────────────────────────────────────────────────────────

import ARScanner from '../components/ARScanner';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ARScanner', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    mockOnComplete.mockClear();
  });

  it('renders in init mode by default showing the Spatial Intelligence heading', () => {
    render(<ARScanner onComplete={mockOnComplete} />);
    expect(screen.getByText('Spatial Intelligence')).toBeInTheDocument();
  });

  it('shows the Initialize Scanner button in init mode', () => {
    render(<ARScanner onComplete={mockOnComplete} />);
    expect(
      screen.getByRole('button', { name: /Initialize Scanner/i }),
    ).toBeInTheDocument();
  });
});
