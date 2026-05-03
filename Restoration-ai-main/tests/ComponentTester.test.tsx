import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComponentTester from '../components/ComponentTester';

describe('ComponentTester', () => {
  it('renders the placeholder text', () => {
    render(<ComponentTester />);
    expect(screen.getByText(/Component Tester Placeholder/i)).toBeInTheDocument();
  });
});
