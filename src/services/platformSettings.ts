import { getAuthToken } from "../lib/auth";

const BASE = "/api/platform/settings";

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

export interface PlatformOverview {
  organizations: { total: number; active: number; pending: number };
  users:         { total: number; active: number };
  subscriptions: { total: number; active: number };
  auditLogs:     number;
  latestOrg:     { name: string; createdAt: string } | null;
  latestUser:    { name: string; createdAt: string } | null;
  dbConnected:   boolean;
  environment:   string;
  serverTime:    string;
}

export interface OverviewResponse {
  success: boolean;
  overview: PlatformOverview;
}

export const getPlatformOverview = () =>
  request<OverviewResponse>(`${BASE}/overview`);

/* ─── localStorage helpers ───────────────────────────────── */

const STORAGE_KEY = "ziya_platform_settings";

export interface LocalSettings {
  platformName:      string;
  platformUrl:       string;
  timezone:          string;
  defaultCurrency:   string;
  maintenanceMode:   boolean;
  maxLoginAttempts:  number;
  sessionTimeoutMin: number;
  lockoutMin:        number;
  emailNotifications: boolean;
  auditRetentionDays: number;
  newOrgAlerts:      boolean;
  subscriptionAlerts: boolean;
}

export const DEFAULT_SETTINGS: LocalSettings = {
  platformName:       "Ziya Financial Operating System",
  platformUrl:        "https://fos.ziya.co.ke",
  timezone:           "Africa/Nairobi",
  defaultCurrency:    "KES",
  maintenanceMode:    false,
  maxLoginAttempts:   5,
  sessionTimeoutMin:  60,
  lockoutMin:         15,
  emailNotifications: true,
  auditRetentionDays: 365,
  newOrgAlerts:       true,
  subscriptionAlerts: true,
};

export function loadLocalSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLocalSettings(settings: LocalSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}