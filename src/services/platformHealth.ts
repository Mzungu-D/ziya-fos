import { getAuthToken } from "../lib/auth";

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

export interface ServerHealth {
  uptime:      string;
  uptimeSec:   number;
  nodeVersion: string;
  environment: string;
  platform:    string;
  memory: {
    usedMB: number; totalMB: number; rssMB: number; pct: number;
  };
}

export interface DBHealth {
  connected:  boolean;
  provider:   string;
  host:       string;
  latencyMs:  number;
  counts: {
    organizations: number; activeOrgs: number;
    users: number; activeUsers: number;
    subscriptions: number; activeSubs: number;
    sessions: number; auditLogs: number; auditToday: number;
  };
}

export interface HealthData {
  status:     "healthy" | "degraded" | "down";
  checkedAt:  string;
  server:     ServerHealth;
  database:   DBHealth;
}

export interface HealthResponse {
  success: boolean;
  health:  HealthData;
}

export const getSystemHealth = () =>
  request<HealthResponse>("/api/platform/health");