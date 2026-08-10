import { authenticatedFetch, getAuthToken } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/* ─── types ──────────────────────────────────────────────── */

export interface RecentOrg {
  id:       string;
  name:     string;
  location: string;
  plan:     string;
  users:    number;
  status:   string;
}

export interface PendingOrg {
  id:        string;
  name:      string;
  email:     string | null;
  country:   string;
  createdAt: string;
}

export interface PlanStat {
  plan:  string;
  count: number;
}

export interface DashboardData {
  stats: {
    organizations: { total: number; pending: number; active: number; suspended: number; change: string };
    users:         { total: number; change: string };
    subscriptions: { total: number; active: number; trial: number; change: string };
    revenue:       { total: number; change: string };
  };
  subscriptionsByPlan:  PlanStat[];
  recentOrganizations:  RecentOrg[];
  pendingApprovals:     PendingOrg[];
}

/* ─── api ────────────────────────────────────────────────── */

export async function getDashboardData(): Promise<DashboardData> {
  const token = getAuthToken();
  const res   = await authenticatedFetch(`${API_BASE}/api/platform/dashboard/stats`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message ?? "Failed to load dashboard");
  return data as DashboardData;
}