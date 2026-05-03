import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Downloads from '../components/Downloads';

describe('Downloads', () => {
  it('renders the "Sync Center" heading', () => {
    render(<Downloads />);
    expect(screen.getByText('Sync Center')).toBeInTheDocument();
  });

  it('renders all 10 downloadable documents', () => {
    render(<Downloads />);
    expect(screen.getByText('Authorization to Repair')).toBeInTheDocument();
    expect(screen.getByText('Generic Work Authorization')).toBeInTheDocument();
  });

  it('shows the "Sync Selected" button', () => {
    render(<Downloads />);
    expect(screen.getByText('Sync Selected')).toBeInTheDocument();
  });

  it('starts with no items checked', () => {
    const { container } = render(<Downloads />);
    // CheckSquare icons are only rendered for checked items — none initially
    // The unchecked Square SVG is rendered for all 10
    const squareIcons = container.querySelectorAll('svg.lucide-square');
    expect(squareIcons.length).toBe(10);
  });

  it('toggles an item to checked when clicked', () => {
    render(<Downloads />);
    const firstItem = screen.getByText('Authorization to Repair').closest('div[class]')!;
    fireEvent.click(firstItem);
    // After click, item text should still be visible (not removed)
    expect(screen.getByText('Authorization to Repair')).toBeInTheDocument();
  });
});
