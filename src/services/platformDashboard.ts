import { authenticatedFetch } from "../lib/auth";

export interface DashboardStat {
  total:  number | string;
  change: string;
}

export interface RecentOrg {
  id:       string;
  name:     string;
  location: string;
  plan:     string;
  users:    number;
  status:   string;
}

export interface PlanBreakdown {
  plan:  string;
  count: number;
}

export interface DashboardData {
  stats: {
    organizations: DashboardStat;
    users:         DashboardStat;
    subscriptions: DashboardStat;
    revenue: {
      total:  number;
      change: string;
    };
  };
  recentOrganizations: RecentOrg[];
  subscriptionsByPlan: PlanBreakdown[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const res = await authenticatedFetch("/api/platform/dashboard/stats");
  if (!res.ok) throw new Error("Failed to load dashboard stats");
  const json = await res.json() as { success: boolean } & DashboardData;
  return json;
}