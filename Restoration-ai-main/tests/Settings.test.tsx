import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import Settings from '../components/Settings';
import { useAppContext } from '../context/AppContext';
import { AppSettings } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseSettings: AppSettings = {
  language: 'English (US)',
  dateFormat: 'Month/Day/Year',
  timeFormat: 'Twelve Hours (AM/PM)',
  units: {
    temperature: 'Fahrenheit',
    dimension: 'LF Inch',
    humidity: 'Grains / Pound',
    volume: 'Pint',
  },
  copyPhotosToGallery: true,
  defaultView: 'Timeline',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Settings', () => {
  const mockSetActiveTab = vi.fn();
  const mockUpdateSettings = vi.fn();

  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue({
      setActiveTab: mockSetActiveTab,
      settings: baseSettings,
      updateSettings: mockUpdateSettings,
    } as ReturnType<typeof useAppContext>);
    mockSetActiveTab.mockClear();
    mockUpdateSettings.mockClear();
  });

  it('renders the "System Configuration" heading', () => {
    render(<Settings />);
    expect(screen.getByText(/System Configuration/i)).toBeInTheDocument();
  });

  it('displays the current language setting', () => {
    render(<Settings />);
    expect(screen.getByText('English (US)')).toBeInTheDocument();
  });

  it('displays the current date format', () => {
    render(<Settings />);
    expect(screen.getByText('Month/Day/Year')).toBeInTheDocument();
  });

  it('displays the current temperature unit', () => {
    render(<Settings />);
    expect(screen.getByText(/Fahrenheit/i)).toBeInTheDocument();
  });

  it('calls setActiveTab("losses") when the back button is clicked', () => {
    render(<Settings />);
    // The only ArrowLeft button in the header
    const backBtn = screen.getAllByRole('button')[0];
    fireEvent.click(backBtn);
    expect(mockSetActiveTab).toHaveBeenCalledWith('losses');
  });

  it('calls updateSettings to toggle the copyPhotosToGallery preference', () => {
    render(<Settings />);
    // Click the row that wraps the toggle
    const saveRow = screen.getByText(/Save photos to gallery/i).closest('div[class]');
    fireEvent.click(saveRow!);
    expect(mockUpdateSettings).toHaveBeenCalledWith({ copyPhotosToGallery: false });
  });
});
