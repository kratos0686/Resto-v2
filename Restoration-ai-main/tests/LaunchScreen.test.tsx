import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LaunchScreen from '../components/LaunchScreen';

describe('LaunchScreen', () => {
  it('renders the RestorationAI brand name', () => {
    render(<LaunchScreen />);
    // The <h1> contains "Restoration" + "AI" in child spans; query the heading role
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByRole('heading').textContent).toMatch(/RestorationAI/i);
  });

  it('shows the "Initializing AI Core" loading message', () => {
    render(<LaunchScreen />);
    expect(screen.getByText(/Initializing AI Core/i)).toBeInTheDocument();
  });

  it('renders the "R" logo character', () => {
    render(<LaunchScreen />);
    expect(screen.getByText('R')).toBeInTheDocument();
  });
});
