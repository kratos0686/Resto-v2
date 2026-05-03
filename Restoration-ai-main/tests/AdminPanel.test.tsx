import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { User, Company } from '../types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getCompanyUsers: vi.fn(),
  getAllCompanies: vi.fn(),
  createUser: vi.fn().mockResolvedValue(undefined),
  createCompany: vi.fn().mockResolvedValue(undefined),
  updateUserPermissions: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import AdminPanel from '../components/AdminPanel';
import { useAppContext } from '../context/AppContext';
import { getCompanyUsers, getAllCompanies } from '../services/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const adminUser: User = {
  id: 'u-admin',
  name: 'Alice Admin',
  email: 'alice@example.com',
  role: 'CompanyAdmin',
  companyId: 'c-1',
  permissions: ['view_admin', 'manage_users', 'view_projects'],
};

const techUser: User = {
  id: 'u-tech',
  name: 'Bob Technician',
  email: 'bob@example.com',
  role: 'Technician',
  companyId: 'c-1',
  permissions: ['view_projects', 'edit_projects', 'use_ai_tools'],
};

const company: Company = {
  id: 'c-1',
  name: 'Rapid Response Restoration',
  plan: 'Pro',
  userCount: 2,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.mocked(getCompanyUsers).mockResolvedValue([adminUser, techUser]);
    vi.mocked(getAllCompanies).mockResolvedValue([company]);
  });

  it('shows an "Access Denied" message for users without view_admin permission', () => {
    vi.mocked(useAppContext).mockReturnValue({
      currentUser: { ...techUser, permissions: [] },
      hasPermission: () => false,
    } as ReturnType<typeof useAppContext>);

    render(<AdminPanel />);
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
  });

  it('renders the "Administrator Panel" heading for authorized users', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      currentUser: adminUser,
      hasPermission: () => true,
    } as ReturnType<typeof useAppContext>);

    render(<AdminPanel />);
    expect(await screen.findByText(/Administrator Panel/i)).toBeInTheDocument();
  });

  it('lists company users after load', async () => {
    vi.mocked(useAppContext).mockReturnValue({
      currentUser: adminUser,
      hasPermission: () => true,
    } as ReturnType<typeof useAppContext>);

    render(<AdminPanel />);

    await waitFor(() =>
      expect(screen.getByText('Alice Admin')).toBeInTheDocument(),
    );
    expect(screen.getByText('Bob Technician')).toBeInTheDocument();
  });

  it('shows the organization name for a SuperAdmin user', async () => {
    const superAdmin: User = {
      id: 'u-super',
      name: 'Super Admin',
      email: 'super@example.com',
      role: 'SuperAdmin',
      companyId: 'c-1',
      permissions: [],
    };

    vi.mocked(useAppContext).mockReturnValue({
      currentUser: superAdmin,
      hasPermission: () => true,
    } as ReturnType<typeof useAppContext>);

    render(<AdminPanel />);

    // SuperAdmin path loads companies → company name should appear in the header
    await waitFor(() =>
      expect(screen.getByText('Rapid Response Restoration')).toBeInTheDocument(),
    );
  });
});
