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
  const res = await fetch(`${API_BASE}/api/platform/health`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load system health");
  return res.json() as Promise<{ health: HealthData }>;
}