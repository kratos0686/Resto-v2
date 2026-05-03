import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getProjects,
  getProjectById,
  addProject,
  updateProject,
  uploadMedia,
  getCompanyUsers,
  getAllCompanies,
  createUser,
  createCompany,
  updateUserPermissions,
  deleteProject,
  getMyProfile,
} from '../services/api';
import { Project, User, Company } from '../types';

// ─── Mock firebase auth ───────────────────────────────────────────────────────
// api.ts imports auth from ../firebase — stub getIdToken so tests don't hit Firebase
vi.mock('../firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mockFetch = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

const mockFetchError = () =>
  vi.fn().mockRejectedValue(new Error('Network error'));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const project: Project = {
  id: 'p-1',
  companyId: 'c-1',
  client: 'Test Client',
  address: '1 Main St',
  status: 'Active',
  currentStage: 'Monitor',
  progress: 50,
  riskLevel: 'medium',
  rooms: [],
  milestones: [],
  tasks: [],
  lineItems: [],
  totalCost: 0,
  invoiceStatus: 'Draft',
  roomScans: [],
  videos: [],
};

const user: User = {
  id: 'u-1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'Technician',
  companyId: 'c-1',
  permissions: ['view_projects'],
};

const company: Company = {
  id: 'c-1',
  name: 'Acme Restoration',
  subscriptionPlan: 'Pro',
  maxUsers: 10,
  isActive: true,
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('api service', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  // ── getProjects ─────────────────────────────────────────────────────────
  describe('getProjects', () => {
    it('returns parsed projects on success', async () => {
      vi.stubGlobal('fetch', mockFetch([project]));
      expect(await getProjects()).toEqual([project]);
    });
    it('returns an empty array on network error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await getProjects()).toEqual([]);
    });
    it('returns an empty array on non-OK response', async () => {
      vi.stubGlobal('fetch', mockFetch(null, 500));
      expect(await getProjects()).toEqual([]);
    });
  });

  // ── getProjectById ──────────────────────────────────────────────────────
  describe('getProjectById', () => {
    it('returns the project on success', async () => {
      vi.stubGlobal('fetch', mockFetch(project));
      expect(await getProjectById('p-1')).toEqual(project);
    });
    it('returns null on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await getProjectById('p-1')).toBeNull();
    });
    it('calls the correct endpoint with auth headers', async () => {
      const spy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(project) });
      vi.stubGlobal('fetch', spy);
      await getProjectById('p-42');
      expect(spy).toHaveBeenCalledWith(
        '/api/projects/p-42',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });
  });

  // ── addProject ──────────────────────────────────────────────────────────
  describe('addProject', () => {
    it('returns the created project on success', async () => {
      vi.stubGlobal('fetch', mockFetch({ ...project, id: 'new-id' }));
      const { id: _unused, ...payload } = project; // eslint-disable-line @typescript-eslint/no-unused-vars
      const result = await addProject(payload);
      expect(result?.id).toBe('new-id');
    });
    it('sends POST with JSON body', async () => {
      const spy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(project) });
      vi.stubGlobal('fetch', spy);
      const { id: _unused, ...payload } = project; // eslint-disable-line @typescript-eslint/no-unused-vars
      await addProject(payload);
      expect(spy).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST' }));
    });
    it('forwards optional companyId in body', async () => {
      const spy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(project) });
      vi.stubGlobal('fetch', spy);
      const { id: _unused, ...payload } = project; // eslint-disable-line @typescript-eslint/no-unused-vars
      await addProject(payload, 'company-xyz');
      const calledBody = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
      expect(calledBody.companyId).toBe('company-xyz');
    });
    it('throws on non-OK response', async () => {
      vi.stubGlobal('fetch', mockFetch({ error: 'Forbidden' }, 403));
      const { id: _unused, ...payload } = project; // eslint-disable-line @typescript-eslint/no-unused-vars
      await expect(addProject(payload)).rejects.toThrow('Forbidden');
    });
  });

  // ── updateProject ───────────────────────────────────────────────────────
  describe('updateProject', () => {
    it('returns updated project on success', async () => {
      vi.stubGlobal('fetch', mockFetch({ ...project, progress: 75 }));
      expect((await updateProject('p-1', { progress: 75 }))?.progress).toBe(75);
    });
    it('sends PATCH to the correct endpoint', async () => {
      const spy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(project) });
      vi.stubGlobal('fetch', spy);
      await updateProject('p-1', { progress: 75 });
      expect(spy).toHaveBeenCalledWith('/api/projects/p-1', expect.objectContaining({ method: 'PATCH' }));
    });
    it('returns null on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await updateProject('p-1', {})).toBeNull();
    });
  });

  // ── deleteProject ───────────────────────────────────────────────────────
  describe('deleteProject', () => {
    it('returns true on success', async () => {
      vi.stubGlobal('fetch', mockFetch({ success: true }));
      expect(await deleteProject('p-1')).toBe(true);
    });
    it('sends DELETE to correct endpoint', async () => {
      const spy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
      vi.stubGlobal('fetch', spy);
      await deleteProject('p-1');
      expect(spy).toHaveBeenCalledWith('/api/projects/p-1', expect.objectContaining({ method: 'DELETE' }));
    });
    it('returns false on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await deleteProject('p-1')).toBe(false);
    });
  });

  // ── uploadMedia ─────────────────────────────────────────────────────────
  describe('uploadMedia', () => {
    it('returns the url on success', async () => {
      vi.stubGlobal('fetch', mockFetch({ url: 'https://cdn.example.com/img.jpg' }));
      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      expect(await uploadMedia('p-1', file)).toBe('https://cdn.example.com/img.jpg');
    });
    it('returns null on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await uploadMedia('p-1', new File(['d'], 'f.jpg', { type: 'image/jpeg' }))).toBeNull();
    });
  });

  // ── getMyProfile ────────────────────────────────────────────────────────
  describe('getMyProfile', () => {
    it('returns user on success', async () => {
      vi.stubGlobal('fetch', mockFetch(user));
      expect(await getMyProfile()).toEqual(user);
    });
    it('returns null on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await getMyProfile()).toBeNull();
    });
  });

  // ── getCompanyUsers ─────────────────────────────────────────────────────
  describe('getCompanyUsers', () => {
    it('returns users on success', async () => {
      vi.stubGlobal('fetch', mockFetch([user]));
      expect(await getCompanyUsers('c-1')).toEqual([user]);
    });
    it('returns empty array on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await getCompanyUsers('c-1')).toEqual([]);
    });
  });

  // ── getAllCompanies ──────────────────────────────────────────────────────
  describe('getAllCompanies', () => {
    it('returns companies on success', async () => {
      vi.stubGlobal('fetch', mockFetch([company]));
      expect(await getAllCompanies()).toEqual([company]);
    });
    it('returns empty array on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await getAllCompanies()).toEqual([]);
    });
  });

  // ── createUser ──────────────────────────────────────────────────────────
  describe('createUser', () => {
    it('returns created user on success', async () => {
      vi.stubGlobal('fetch', mockFetch(user));
      const { id: _unused, ...payload } = user; // eslint-disable-line @typescript-eslint/no-unused-vars
      expect(await createUser(payload)).toEqual(user);
    });
    it('returns null on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      const { id: _unused, ...payload } = user; // eslint-disable-line @typescript-eslint/no-unused-vars
      expect(await createUser(payload)).toBeNull();
    });
  });

  // ── createCompany ────────────────────────────────────────────────────────
  describe('createCompany', () => {
    it('returns created company on success', async () => {
      vi.stubGlobal('fetch', mockFetch(company));
      const { id: _unused, ...payload } = company; // eslint-disable-line @typescript-eslint/no-unused-vars
      expect(await createCompany(payload)).toEqual(company);
    });
    it('returns null on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      const { id: _unused, ...payload } = company; // eslint-disable-line @typescript-eslint/no-unused-vars
      expect(await createCompany(payload)).toBeNull();
    });
  });

  // ── updateUserPermissions ────────────────────────────────────────────────
  describe('updateUserPermissions', () => {
    it('returns updated user on success', async () => {
      const updated = { ...user, permissions: ['view_projects', 'edit_projects'] } as User;
      vi.stubGlobal('fetch', mockFetch(updated));
      expect((await updateUserPermissions('u-1', ['view_projects', 'edit_projects']))?.permissions).toContain('edit_projects');
    });
    it('sends PATCH to correct endpoint', async () => {
      const spy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(user) });
      vi.stubGlobal('fetch', spy);
      await updateUserPermissions('u-1', ['view_projects']);
      expect(spy).toHaveBeenCalledWith('/api/users/u-1/permissions', expect.objectContaining({ method: 'PATCH' }));
    });
    it('returns null on error', async () => {
      vi.stubGlobal('fetch', mockFetchError());
      expect(await updateUserPermissions('u-1', [])).toBeNull();
    });
  });
});
