const BASE = "/api/platform/users";

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
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  platformRole: string | null;
  isActive:     boolean;
  phoneNumber:  string | null;
  lastLoginAt:  string | null;
  createdAt:    string;
  loginAttempts: number;
  lockedUntil:  string | null;
  memberships:  {
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

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

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
  return api<UsersResponse>(`${BASE}${query ? `?${query}` : ""}`);
}

export function getUser(id: string): Promise<{ success: boolean; user: PlatformUser }> {
  return api(`${BASE}/${id}`);
}

export function deactivateUser(id: string): Promise<{ success: boolean; message: string }> {
  return api(`${BASE}/${id}/deactivate`, { method: "PATCH" });
}

export function activateUser(id: string): Promise<{ success: boolean; message: string }> {
  return api(`${BASE}/${id}/activate`, { method: "PATCH" });
}

export function unlockUser(id: string): Promise<{ success: boolean; message: string }> {
  return api(`${BASE}/${id}/unlock`, { method: "PATCH" });
}