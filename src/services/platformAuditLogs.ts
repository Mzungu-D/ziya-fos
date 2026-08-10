import { getAuthToken } from "../lib/auth";

const BASE = "/api/platform/audit-logs";

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

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditStatsResponse {
  success: boolean;
  stats: { total: number; today: number; thisWeek: number };
  topActions: { action: string; count: number }[];
}

export interface AuditLogsResponse {
  success: boolean;
  logs: AuditLog[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

/* ─── API calls ──────────────────────────────────────────── */

export const getAuditStats = () =>
  request<AuditStatsResponse>(`${BASE}/stats`);

export const getAuditLogs = (params: {
  q?: string; action?: string; resource?: string; page?: number; limit?: number;
}) => {
  const q = new URLSearchParams();
  if (params.q)        q.set("q",        params.q);
  if (params.action)   q.set("action",   params.action);
  if (params.resource) q.set("resource", params.resource);
  if (params.page)     q.set("page",     String(params.page));
  if (params.limit)    q.set("limit",    String(params.limit));
  return request<AuditLogsResponse>(`${BASE}/list?${q.toString()}`);
};