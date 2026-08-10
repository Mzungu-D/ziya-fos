import { authenticatedFetch, getAuthToken } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/* ── Types ─────────────────────────────────────────────────── */

export type PlatformOverview = {
  organizations: { total: number; active: number; pending: number };
  users:         { total: number; active: number };
  subscriptions: { total: number; active: number };
  auditLogs:     number;
  environment:   string;
  dbConnected:   boolean;
  serverTime:    string;
  latestOrg?:    { name: string; createdAt: string };
};

export type LocalSettings = {
  platformName:       string;
  platformUrl:        string;
  timezone:           string;
  defaultCurrency:    string;
  maintenanceMode:    boolean;
  maxLoginAttempts:   number;
  sessionTimeoutMin:  number;
  lockoutMin:         number;
  emailNotifications: boolean;
  newOrgAlerts:       boolean;
  subscriptionAlerts: boolean;
  auditRetentionDays: number;
};

/* ── Defaults ───────────────────────────────────────────────── */

const DEFAULTS: LocalSettings = {
  platformName:       "Ziya FOS",
  platformUrl:        "",
  timezone:           "Africa/Nairobi",
  defaultCurrency:    "KES",
  maintenanceMode:    false,
  maxLoginAttempts:   5,
  sessionTimeoutMin:  60,
  lockoutMin:         15,
  emailNotifications: true,
  newOrgAlerts:       true,
  subscriptionAlerts: true,
  auditRetentionDays: 365,
};

const LS_KEY = "ziya_platform_settings";

/* ── Local storage ──────────────────────────────────────────── */

export function loadLocalSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) } as LocalSettings;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveLocalSettings(settings: LocalSettings): void {
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

/* ── API ────────────────────────────────────────────────────── */

export async function getPlatformOverview(): Promise<{ overview: PlatformOverview }> {
  const token = getAuthToken();
  const res   = await authenticatedFetch(`${API_BASE}/api/platform/settings/overview`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message ?? "Failed to load overview");
  return data as { overview: PlatformOverview };
}