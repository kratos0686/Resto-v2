import { Project, User, Company } from '../types';
import { auth } from '../firebase';

const API_BASE_URL = '/api';

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the Firebase ID token for the signed-in user, or null if unauthenticated.
 * Firebase SDK automatically refreshes the token when it is near expiry.
 */
const getAuthToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try { return await user.getIdToken(); } catch { return null; }
};

/**
 * Builds the common JSON headers, injecting Authorization: Bearer <token>
 * when a user is signed in.
 */
const buildAuthHeaders = async (
  extra: Record<string, string> = {}
): Promise<Record<string, string>> => {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const getProjects = async (): Promise<Project[]> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/projects`, { headers });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return await res.json();
  } catch (err) { console.error(err); return []; }
};

export const getProjectById = async (id: string): Promise<Project | null> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/projects/${id}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch project');
    return await res.json();
  } catch (err) { console.error(err); return null; }
};

/**
 * Create a new project.
 * The server always stamps the authenticated user's companyId, so the
 * `companyId` argument here is included in the body for consistency but
 * the server-side value takes precedence.
 */
export const addProject = async (
  project: Omit<Project, 'id'>,
  companyId?: string
): Promise<Project> => {
  const headers = await buildAuthHeaders();
  const body = companyId ? { ...project, companyId } : project;
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to add project');
  }
  return await res.json();
};

export const updateProject = async (
  id: string,
  updates: Partial<Project>
): Promise<Project | null> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update project');
    return await res.json();
  } catch (err) { console.error(err); return null; }
};

export const deleteProject = async (id: string): Promise<boolean> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE', headers });
    if (!res.ok) throw new Error('Failed to delete project');
    return true;
  } catch (err) { console.error(err); return false; }
};

// ── Media ──────────────────────────────────────────────────────────────────────

export const uploadMedia = async (
  projectId: string,
  file: File
): Promise<string | null> => {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/media`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload media');
    return (await res.json()).url;
  } catch (err) { console.error(err); return null; }
};

// ── Users ──────────────────────────────────────────────────────────────────────

export const getMyProfile = async (): Promise<User | null> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/users/me`, { headers });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return await res.json();
  } catch (err) { console.error(err); return null; }
};

export const createUser = async (user: Omit<User, 'id'>): Promise<User | null> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error('Failed to create user');
    return await res.json();
  } catch (err) { console.error(err); return null; }
};

export const updateUserPermissions = async (
  userId: string,
  permissions: string[]
): Promise<User | null> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/users/${userId}/permissions`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ permissions }),
    });
    if (!res.ok) throw new Error('Failed to update permissions');
    return await res.json();
  } catch (err) { console.error(err); return null; }
};

// ── Companies ──────────────────────────────────────────────────────────────────

export const getAllCompanies = async (): Promise<Company[]> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/companies`, { headers });
    if (!res.ok) throw new Error('Failed to fetch companies');
    return await res.json();
  } catch (err) { console.error(err); return []; }
};

export const createCompany = async (
  company: Omit<Company, 'id'>
): Promise<Company | null> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/companies`, {
      method: 'POST',
      headers,
      body: JSON.stringify(company),
    });
    if (!res.ok) throw new Error('Failed to create company');
    return await res.json();
  } catch (err) { console.error(err); return null; }
};

export const getCompanyUsers = async (companyId: string): Promise<User[]> => {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/companies/${companyId}/users`, { headers });
    if (!res.ok) throw new Error('Failed to fetch users');
    return await res.json();
  } catch (err) { console.error(err); return []; }
};
