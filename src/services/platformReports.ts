import { getAuthToken } from "../lib/auth";

const BASE = "/api/platform/reports";

async function request<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res   = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

/* ─── types ─────────────────────────────────────────────── */

export interface AnalyticsSummary {
  totalOrgs:   number;
  activeOrgs:  number;
  totalUsers:  number;
  activeUsers: number;
  totalSubs:   number;
  activeSubs:  number;
  mrr:         number;
}

export interface AuditEntry {
  id:          string;
  actorUserId: string;
  actorEmail:  string;
  action:      string;
  resource:    string;
  resourceId:  string | null;
  details:     string | null;
  ipAddress:   string | null;
  createdAt:   string;
}

export interface TopOrg {
  id:     string;
  plan:   string;
  amount: number;
  organization: {
    name:    string;
    country: string;
  };
}

export interface CountryCount {
  country: string;
  count:   number;
}

export interface GrowthPoint {
  month: string;
  orgs:  number;
  users: number;
}

export interface SummaryResponse {
  success:          boolean;
  summary:          AnalyticsSummary;
  recentAudit:      AuditEntry[];
  topOrgs:          TopOrg[];
  countryBreakdown: CountryCount[];
}

export interface GrowthResponse {
  success:         boolean;
  growth:          GrowthPoint[];
  statusBreakdown: {
    active:    number;
    trial:     number;
    expired:   number;
    suspended: number;
    cancelled: number;
  };
  planBreakdown: {
    starter:      number;
    professional: number;
    enterprise:   number;
  };
}

/* ─── API calls ──────────────────────────────────────────── */

export const getAnalyticsSummary = () =>
  request<SummaryResponse>(`${BASE}/summary`);

export const getGrowthData = () =>
  request<GrowthResponse>(`${BASE}/growth`);