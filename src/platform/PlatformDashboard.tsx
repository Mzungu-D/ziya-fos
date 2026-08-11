import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Check,
  Clock,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import PageHeader        from "./components/PageHeader";
import StatCard          from "./components/StatCard";
import SubscriptionChart from "./components/SubscriptionChart";

import { getDashboardData }                        from "../services/platformDashboard";
import { approveOrganization, rejectOrganization } from "../services/platformOrganizations";
import type { DashboardData, RecentOrg, PendingOrg } from "../services/platformDashboard";

/* ─── helpers ────────────────────────────────────────────── */

function fmtCurrency(amount: number): string {
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `KES ${(amount / 1_000).toFixed(0)}K`;
  return `KES ${amount.toFixed(0)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE")    return "bg-green-100 text-green-700";
  if (s === "TRIAL")     return "bg-blue-100 text-blue-700";
  if (s === "SUSPENDED") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-500";
}

function planBadge(plan: string) {
  const p = plan.toUpperCase();
  if (p === "ENTERPRISE")   return "bg-purple-100 text-purple-700";
  if (p === "PROFESSIONAL") return "bg-blue-100 text-blue-700";
  if (p === "STARTER")      return "bg-yellow-100 text-yellow-700";
  return "bg-slate-100 text-slate-500";
}

/* ─── pending approvals panel ────────────────────────────── */

function PendingApprovalsPanel({
  rows,
  loading,
  onApproved,
  onRejected,
}: {
  rows: PendingOrg[];
  loading: boolean;
  onApproved: (id: string) => void;
  onRejected: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Record<string, "approving" | "rejecting" | null>>({});

  async function handleApprove(id: string) {
    setBusy((b) => ({ ...b, [id]: "approving" }));
    try {
      await approveOrganization(id);
      onApproved(id);
    } catch { /* reload will reflect reality */ }
    finally { setBusy((b) => ({ ...b, [id]: null })); }
  }

  async function handleReject(id: string) {
    setBusy((b) => ({ ...b, [id]: "rejecting" }));
    try {
      await rejectOrganization(id);
      onRejected(id);
    } catch { /* swallow */ }
    finally { setBusy((b) => ({ ...b, [id]: null })); }
  }

  if (!loading && rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
            <Clock size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#20243A]">
              Pending Applications
              {rows.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {rows.length}
                </span>
              )}
            </p>
            <p className="text-xs text-amber-700">
              These organizations are waiting for your review
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/platform/organizations")}
          className="text-xs font-semibold text-[#6D5DF6] hover:underline"
        >
          View all →
        </button>
      </div>

      {loading && rows.length === 0 && (
        <div className="flex h-24 items-center justify-center gap-2 text-sm text-[#94A3B8]">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      )}

      {rows.length > 0 && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#FAFAFA] text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              <th className="px-6 py-3">Organisation</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state  = busy[row.id];
              const isBusy = state === "approving" || state === "rejecting";
              return (
                <tr
                  key={row.id}
                  className="border-b border-[#F8F9FC] transition-colors hover:bg-[#FAFAFE] last:border-0"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-[#20243A]">{row.name}</p>
                    {row.email && (
                      <p className="mt-0.5 text-xs text-[#94A3B8]">{row.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#666B84]">{row.country}</td>
                  <td className="px-4 py-4 text-sm text-[#666B84]">{fmtDate(row.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => void handleApprove(row.id)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        {state === "approving"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Check size={12} />}
                        Approve
                      </button>
                      <button
                        onClick={() => void handleReject(row.id)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {state === "rejecting"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <X size={12} />}
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── recent orgs table ──────────────────────────────────── */

function RecentOrgsTable({ rows, loading }: { rows: RecentOrg[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-5">
        <div>
          <p className="text-base font-bold text-[#20243A]">Recent Organisations</p>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            Latest organisations onboarded onto Ziya FOS
          </p>
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-[#94A3B8]" />}
      </div>

      {rows.length === 0 && !loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-[#94A3B8]">
          No organisations yet
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#FAFAFA] text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              <th className="px-6 py-3">Organisation</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[#F8F9FC] transition-colors hover:bg-[#FAFAFE] last:border-0"
              >
                <td className="px-6 py-4 text-sm font-semibold text-[#20243A]">{row.name}</td>
                <td className="px-4 py-4 text-sm text-[#666B84]">{row.location}</td>
                <td className="px-4 py-4">
                  {row.plan !== "—" ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${planBadge(row.plan)}`}>
                      {row.plan.charAt(0) + row.plan.slice(1).toLowerCase()}
                    </span>
                  ) : (
                    <span className="text-sm text-[#94A3B8]">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-[#475569]">{row.users.toLocaleString()}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadge(row.status)}`}>
                    {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── main dashboard ─────────────────────────────────────── */

export default function PlatformDashboard() {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const d = await getDashboardData();
      setData(d);
    } catch {
      setError("Failed to load dashboard data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function removePending(id: string) {
    setData((prev: DashboardData | null) =>
      prev
        ? {
            ...prev,
            pendingApprovals: prev.pendingApprovals.filter((o: PendingOrg) => o.id !== id),
            stats: {
              ...prev.stats,
              organizations: {
                ...prev.stats.organizations,
                pending: Math.max(0, prev.stats.organizations.pending - 1),
              },
            },
          }
        : prev
    );
    void load();
  }

  const stats           = data?.stats;
  const pendingApprovals = data?.pendingApprovals ?? [];

  const kpis = [
    {
      title: "Organisations",
      value: loading ? "—" : (stats?.organizations.total ?? 0).toLocaleString(),
      change: stats?.organizations.change ?? "+0%",
      icon: Building2, iconBg: "#EEF4FF", iconColor: "#2563EB",
    },
    {
      title: "Platform Users",
      value: loading ? "—" : (stats?.users.total ?? 0).toLocaleString(),
      change: stats?.users.change ?? "+0%",
      icon: Users, iconBg: "#F3F0FF", iconColor: "#6D5DF6",
    },
    {
      title: "Active Subscriptions",
      value: loading ? "—" : (stats?.subscriptions.total ?? 0).toLocaleString(),
      change: stats?.subscriptions.change ?? "+0%",
      icon: CreditCard, iconBg: "#FFF8E1", iconColor: "#D97706",
    },
    {
      title: "Monthly Revenue",
      value: loading ? "—" : fmtCurrency(stats?.revenue.total ?? 0),
      change: stats?.revenue.change ?? "+0%",
      icon: DollarSign, iconBg: "#ECFDF3", iconColor: "#16A34A",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Platform Dashboard"
          subtitle="Live view of organisations, subscriptions, and platform operations."
        />
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] shadow-sm hover:bg-[#F8F9FC] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {(loading || pendingApprovals.length > 0) && (
        <PendingApprovalsPanel
          rows={pendingApprovals}
          loading={loading}
          onApproved={removePending}
          onRejected={removePending}
        />
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-[#F1F5F9]" />
            ))
          : kpis.map((kpi) => (
              <StatCard
                key={kpi.title}
                title={kpi.title}
                value={kpi.value}
                change={kpi.change}
                icon={kpi.icon}
                iconBg={kpi.iconBg}
                iconColor={kpi.iconColor}
              />
            ))}
      </section>

      {data && (
        <div className="flex items-center gap-4 rounded-2xl border border-[#ECECF3] bg-white px-6 py-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F0FF]">
            <TrendingUp size={20} className="text-[#6D5DF6]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#20243A]">Revenue & Licensing Summary</p>
            <p className="mt-0.5 text-sm text-[#666B84]">
              Monitor platform revenue, subscription performance, licensing and commercial
              health across all organisations.
            </p>
          </div>
          {data.subscriptionsByPlan.length > 0 && (
            <div className="flex items-center gap-3">
              {data.subscriptionsByPlan.map((s) => (
                <div key={s.plan} className={`rounded-full px-3 py-1 text-xs font-semibold ${planBadge(s.plan)}`}>
                  {s.plan.charAt(0) + s.plan.slice(1).toLowerCase()} · {s.count}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <RecentOrgsTable rows={data?.recentOrganizations ?? []} loading={loading} />
        </div>
        <div className="xl:col-span-4">
          <SubscriptionChart />
        </div>
      </section>
    </div>
  );
}