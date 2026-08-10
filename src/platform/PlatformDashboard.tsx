import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

import PageHeader        from "./components/PageHeader";
import StatCard          from "./components/StatCard";
import SubscriptionChart from "./components/SubscriptionChart";

import { getDashboardData } from "../services/platformDashboard";
import type { DashboardData, PendingOrg, RecentOrg } from "../services/platformDashboard";

/* ─── helpers ────────────────────────────────────────────── */

function fmtCurrency(amount: number): string {
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `KES ${(amount / 1_000).toFixed(0)}K`;
  return `KES ${amount.toFixed(0)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE")    return "bg-green-100 text-green-700";
  if (s === "TRIAL")     return "bg-blue-100 text-blue-700";
  if (s === "SUSPENDED") return "bg-red-100 text-red-700";
  if (s === "INACTIVE")  return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-500";
}

function planBadge(plan: string) {
  const p = plan.toUpperCase();
  if (p === "ENTERPRISE")   return "bg-purple-100 text-purple-700";
  if (p === "PROFESSIONAL") return "bg-blue-100 text-blue-700";
  if (p === "STARTER")      return "bg-yellow-100 text-yellow-700";
  return "bg-slate-100 text-slate-500";
}

/* ─── pending approvals banner ───────────────────────────── */

function PendingBanner({ orgs, loading }: { orgs: PendingOrg[]; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) return null;
  if (orgs.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3.5">
        <CheckCircle size={16} className="text-green-500" />
        <span className="text-sm font-medium text-green-700">
          No pending approvals — all organisations are active.
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">

      {/* Title */}
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-100/60 px-5 py-3">
        <AlertTriangle size={15} className="text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">
          {orgs.length} organisation{orgs.length > 1 ? "s" : ""} awaiting your approval
        </span>
        <button
          onClick={() => navigate("/platform/organizations?status=PENDING")}
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-amber-100">
        {orgs.slice(0, 5).map((org) => (
          <button
            key={org.id}
            onClick={() => navigate(`/platform/organizations/${org.id}`)}
            className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-amber-100/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/20 text-sm font-bold text-[#D4AF37]">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#20243A]">{org.name}</p>
              <p className="truncate text-xs text-[#666B84]">
                {org.email ?? "No email"} · {org.country} · Applied {timeAgo(org.createdAt)}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-semibold text-white">
              Review →
            </span>
          </button>
        ))}
      </div>

      {orgs.length > 5 && (
        <div className="border-t border-amber-200 px-5 py-2.5 text-center">
          <button
            onClick={() => navigate("/platform/organizations?status=PENDING")}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900"
          >
            + {orgs.length - 5} more — view all →
          </button>
        </div>
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

  const stats = data?.stats;

  const kpis = [
    {
      title:     "Organisations",
      value:     loading ? "—" : (stats?.organizations.total ?? 0).toLocaleString(),
      change:    stats?.organizations.change ?? "+0%",
      icon:      Building2,
      iconBg:    "#EEF4FF",
      iconColor: "#2563EB",
    },
    {
      title:     "Platform Users",
      value:     loading ? "—" : (stats?.users.total ?? 0).toLocaleString(),
      change:    stats?.users.change ?? "+0%",
      icon:      Users,
      iconBg:    "#F3F0FF",
      iconColor: "#6D5DF6",
    },
    {
      title:     "Active Subscriptions",
      value:     loading ? "—" : (stats?.subscriptions.total ?? 0).toLocaleString(),
      change:    stats?.subscriptions.change ?? "+0%",
      icon:      CreditCard,
      iconBg:    "#FFF8E1",
      iconColor: "#D97706",
    },
    {
      title:     "Monthly Revenue",
      value:     loading ? "—" : fmtCurrency(stats?.revenue.total ?? 0),
      change:    stats?.revenue.change ?? "+0%",
      icon:      DollarSign,
      iconBg:    "#ECFDF3",
      iconColor: "#16A34A",
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
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

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Pending approvals banner ── */}
      <PendingBanner orgs={data?.pendingApprovals ?? []} loading={loading} />

      {/* ── KPI Cards ── */}
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

      {/* ── Revenue trend banner ── */}
      {data && (
        <div className="flex items-center gap-4 rounded-2xl border border-[#ECECF3] bg-white px-6 py-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F0FF]">
            <TrendingUp size={20} className="text-[#6D5DF6]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#20243A]">Revenue & Licensing Summary</p>
            <p className="mt-0.5 text-sm text-[#666B84]">
              Monitor platform revenue, subscription performance, licensing and commercial health
              across all organisations.
            </p>
          </div>
          {data.subscriptionsByPlan.length > 0 && (
            <div className="flex items-center gap-3">
              {data.subscriptionsByPlan.map((s) => (
                <div
                  key={s.plan}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${planBadge(s.plan)}`}
                >
                  {s.plan.charAt(0) + s.plan.slice(1).toLowerCase()} · {s.count}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main content ── */}
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