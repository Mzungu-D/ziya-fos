import { authenticatedFetch } from "../lib/auth";

export interface NotificationItem {
  type:     string;
  label:    string;
  link:     string;
  severity: "high" | "medium" | "low";
}

export interface NotificationSummary {
  total:           number;
  openTickets:     number;
  criticalTickets: number;
  expiringSoon:    number;
  suspendedOrgs:   number;
  items:           NotificationItem[];
}

export async function getNotificationSummary(): Promise<{
  success:       boolean;
  notifications: NotificationSummary;
}> {
  const res = await authenticatedFetch("/api/platform/notifications/summary");
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json() as Promise<{ success: boolean; notifications: NotificationSummary }>;
}