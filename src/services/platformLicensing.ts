import { getAuthToken } from "../lib/auth";

const BASE = "/api/platform/licensing";

async function request<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

/* ─── types ──────────────────────────────────────────────── */

export interface LicensingStats {
  active: number;
  trial: number;
  expired: number;
  suspended: number;
  cancelled: number;
  total: number;
  expiringIn30Days: number;
  complianceRate: number;
}

export interface License {
  id: string;
  plan: string;
  status: string;
  billingCycle: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    email: string;
    country: string;
    status: string;
    logoUrl: string | null;
  };
}

export interface LicensingStatsResponse {
  success: boolean;
  stats: LicensingStats;
}

export interface LicensesResponse {
  success: boolean;
  licenses: License[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

/* ─── API calls ──────────────────────────────────────────── */

export function getLicensingStats() {
  return request<LicensingStatsResponse>(`${BASE}/stats`);
}

export function getLicenses(params: {
  q?: string; status?: string; plan?: string; page?: number; limit?: number;
}) {
  const q = new URLSearchParams();
  if (params.q)      q.set("q",      params.q);
  if (params.status) q.set("status", params.status);
  if (params.plan)   q.set("plan",   params.plan);
  if (params.page)   q.set("page",   String(params.page));
  if (params.limit)  q.set("limit",  String(params.limit));
  return request<LicensesResponse>(`${BASE}/licenses?${q.toString()}`);
}