const API_BASE = import.meta.env.VITE_API_URL ?? "";
import { authenticatedFetch, getAuthToken } from "../lib/auth";

const getToken = getAuthToken;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await authenticatedFetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

/* ─── types ─────────────────────────────────────────────── */

export interface PlatformUserMembership {
  id:           string;
  role:         string;
  isActive:     boolean;
  joinedAt:     string;
  organization: {
    id:      string;
    name:    string;
    slug:    string;
    status:  string;
    country: string;
  };
}

export interface PlatformUser {
  id:              string;
  name:            string;
  email:           string;
  role:            string;
  platformRole:    string | null;
  isActive:        boolean;
  phoneNumber:     string | null;
  lastLoginAt:     string | null;
  lastLoginIp:     string | null;
  createdAt:       string;
  updatedAt:       string;
  loginAttempts:   number;
  lockedUntil:     string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  memberships:     PlatformUserMembership[];
}

export interface PlatformUserSummary {
  id:            string;
  name:          string;
  email:         string;
  role:          string;
  platformRole:  string | null;
  isActive:      boolean;
  phoneNumber:   string | null;
  lastLoginAt:   string | null;
  createdAt:     string;
  loginAttempts: number;
  lockedUntil:   string | null;
  memberships: {
    id:   string;
    role: string;
    organization: { id: string; name: string; slug: string; status: string };
  }[];
}

export interface UsersResponse {
  success:    boolean;
  users:      PlatformUserSummary[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

/* ─── api functions ─────────────────────────────────────── */

export function getUsers(params?: {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<UsersResponse> {
  const qs = new URLSearchParams();
  if (params?.q)      qs.set("q",      params.q);
  if (params?.role)   qs.set("role",   params.role);
  if (params?.status) qs.set("status", params.status);
  if (params?.page)   qs.set("page",   String(params.page));
  if (params?.limit)  qs.set("limit",  String(params.limit));
  const query = qs.toString();
  return request<UsersResponse>(`/api/platform/users${query ? `?${query}` : ""}`);
}

export function getUser(id: string): Promise<{ success: boolean; user: PlatformUser }> {
  return request(`/api/platform/users/${id}`);
}

export function deactivateUser(id: string): Promise<{ success: boolean; message: string }> {
  return request(`/api/platform/users/${id}/deactivate`, { method: "PATCH" });
}

export function activateUser(id: string): Promise<{ success: boolean; message: string }> {
  return request(`/api/platform/users/${id}/activate`, { method: "PATCH" });
}

export function unlockUser(id: string): Promise<{ success: boolean; message: string }> {
  return request(`/api/platform/users/${id}/unlock`, { method: "PATCH" });
}