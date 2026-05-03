import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Forms from '../components/Forms';

describe('Forms', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    onComplete.mockClear();
  });

  // ── Template list ──────────────────────────────────────────────────────────

  it('renders the Form Center heading', () => {
    render(<Forms onComplete={onComplete} />);
    expect(screen.getByText('Form Center')).toBeInTheDocument();
  });

  it('shows all 8 template cards', () => {
    render(<Forms onComplete={onComplete} />);
    expect(screen.getByText('Repair Authorization')).toBeInTheDocument();
    expect(screen.getByText('Insurance Direction to Pay')).toBeInTheDocument();
    expect(screen.getByText('AFICS Authorization')).toBeInTheDocument();
    expect(screen.getByText('ASI Worker Authorization')).toBeInTheDocument();
    expect(screen.getByText('Certificate of Satisfaction')).toBeInTheDocument();
    expect(screen.getByText('Contractor Connect')).toBeInTheDocument();
    expect(screen.getByText('12-Hour Service Endorsement')).toBeInTheDocument();
    expect(screen.getByText('Vendor Call Template')).toBeInTheDocument();
  });

  // ── Select a template ──────────────────────────────────────────────────────

  it('shows the form view when a template is clicked', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Repair Authorization'));
    // Header shows the form name
    expect(screen.getByText('Repair Authorization')).toBeInTheDocument();
    // "Back to Templates" link appears
    expect(screen.getByText(/Back to Templates/i)).toBeInTheDocument();
  });

  it('navigates back to the template list when "Back to Templates" is clicked', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Repair Authorization'));
    fireEvent.click(screen.getByText(/Back to Templates/i));
    expect(screen.getByText('Form Center')).toBeInTheDocument();
  });

  // ── Vendor Call template ───────────────────────────────────────────────────

  it('renders the Vendor Call checklist when that template is selected', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Vendor Call Template'));
    expect(screen.getByText(/Vendor Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Call Notes/i)).toBeInTheDocument();
    // Vendor Call has no signature canvas
    expect(screen.queryByText(/Sign with finger/i)).not.toBeInTheDocument();
  });

  // ── Name validation ────────────────────────────────────────────────────────

  it('shows an error when name is empty and submit is attempted', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Vendor Call Template'));
    // Type empty name then blur
    const nameInput = screen.getByPlaceholderText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: ' ' } });
    // Empty after trim
    expect(screen.getByText(/Name cannot be empty/i)).toBeInTheDocument();
  });

  it('clears the error when a valid name is typed', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Vendor Call Template'));
    const nameInput = screen.getByPlaceholderText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: ' ' } }); // trigger error
    fireEvent.change(nameInput, { target: { value: 'Alice Smith' } }); // clear error
    expect(screen.queryByText(/Name cannot be empty/i)).not.toBeInTheDocument();
  });

  // ── Submit (Vendor Call, no signature required) ────────────────────────────

  it('submits successfully for Vendor Call when name is filled', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Vendor Call Template'));
    const nameInput = screen.getByPlaceholderText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Bob Jones' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Call Log/i }));
    // After submit, the success screen is shown
    expect(screen.getByText(/Form Submitted/i)).toBeInTheDocument();
  });

  it('calls onComplete when "Return to Project" is clicked after submit', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Vendor Call Template'));
    const nameInput = screen.getByPlaceholderText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Bob Jones' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Call Log/i }));
    fireEvent.click(screen.getByText(/Return to Project/i));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  // ── Authorize & Submit disabled without signature ──────────────────────────

  it('keeps the submit button disabled when no name is entered (repair_auth)', () => {
    render(<Forms onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Repair Authorization'));
    const submitBtn = screen.getByRole('button', { name: /Authorize & Submit/i });
    expect(submitBtn).toBeDisabled();
  });
});
