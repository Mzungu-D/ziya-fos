import { getAuthToken } from "../lib/auth";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

/* ── types ─────────────────────────────────────────── */

export interface SupportTicket {
  id:             string;
  ticketNumber:   string;
  organizationId: string;
  subject:        string;
  description:    string;
  priority:       "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status:         "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  category:       "BILLING" | "TECHNICAL" | "ACCOUNT" | "GENERAL";
  adminNotes:     string | null;
  resolvedAt:     string | null;
  closedAt:       string | null;
  createdAt:      string;
  updatedAt:      string;
  organization:   { id: string; name: string; slug: string };
}

export interface SupportStats {
  openCount:         number;
  inProgressCount:   number;
  resolvedToday:     number;
  totalClosed:       number;
  criticalCount:     number;
  avgResolutionHrs:  number;
  priorityBreakdown: { priority: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
}

export interface TicketListResponse {
  success:    boolean;
  tickets:    SupportTicket[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface TicketFilters {
  page?:     number;
  pageSize?: number;
  search?:   string;
  status?:   string;
  priority?: string;
  category?: string;
}

/* ── API calls ─────────────────────────────────────── */

export const getSupportStats = () =>
  request<{ success: boolean; stats: SupportStats }>("/api/platform/support/stats");

export const getTickets = (f: TicketFilters = {}) => {
  const p = new URLSearchParams();
  if (f.page)     p.set("page",     String(f.page));
  if (f.pageSize) p.set("pageSize", String(f.pageSize));
  if (f.search)   p.set("search",   f.search);
  if (f.status)   p.set("status",   f.status);
  if (f.priority) p.set("priority", f.priority);
  if (f.category) p.set("category", f.category);
  return request<TicketListResponse>(`/api/platform/support/tickets?${p}`);
};

export const getTicket = (id: string) =>
  request<{ success: boolean; ticket: SupportTicket }>(`/api/platform/support/tickets/${id}`);

export interface CreateTicketPayload {
  organizationId: string;
  subject:        string;
  description:    string;
  priority:       string;
  category:       string;
}

export const createTicket = (payload: CreateTicketPayload) =>
  request<{ success: boolean; ticket: SupportTicket }>("/api/platform/support/tickets", {
    method: "POST",
    body:   JSON.stringify(payload),
  });

export interface UpdateTicketPayload {
  status?:     string;
  priority?:   string;
  category?:   string;
  adminNotes?: string;
}

export const updateTicket = (id: string, payload: UpdateTicketPayload) =>
  request<{ success: boolean; ticket: SupportTicket }>(`/api/platform/support/tickets/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
  });