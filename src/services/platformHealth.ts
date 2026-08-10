import { authenticatedFetch, getAuthToken } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/* ── Types ─────────────────────────────────────────────────── */

export type HealthData = {
  status:    "healthy" | "degraded" | "down";
  checkedAt: string;
  server: {
    uptime:      string;
    nodeVersion: string;
    platform:    string;
    environment: string;
    memory: {
      pct:     number;
      usedMB:  number;
      totalMB: number;
      rssMB:   number;
    };
  };
  database: {
    connected: boolean;
    latencyMs: number;
    host:      string;
    counts: {
      organizations: number;
      activeOrgs:    number;
      users:         number;
      activeUsers:   number;
      subscriptions: number;
      activeSubs:    number;
      sessions:      number;
      auditLogs:     number;
      auditToday:    number;
    };
  };
};

/* ── API ────────────────────────────────────────────────────── */

export async function getSystemHealth(): Promise<{ health: HealthData }> {
  const token = getAuthToken();
  const res   = await authenticatedFetch(`${API_BASE}/api/platform/health`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message ?? "Failed to load health");
  return data as { health: HealthData };
}