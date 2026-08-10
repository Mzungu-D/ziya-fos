import { useEffect, useState } from "react";
import {
  BarChart3, Building2, CheckCircle, Clock,
  CreditCard, Globe, Loader2, TrendingUp,
  Users, XCircle,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import { getAnalyticsSummary, getGrowthData } from "../../services/platformReports";
import type {
  AnalyticsSummary, AuditEntry, TopOrg,
  CountryCount, GrowthPoint,
} from "../../services/platformReports";

/* ─── helpers ────────────────────────────────────────────── */

function fmtKES(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(0)}K`;
  return `KES ${n.toLocaleString("en-KE")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
function titleCase(s: string) { return s.charAt(0) + s.slice(1).toLowerCase(); }

const PLAN_CFG: Record<string, string> = {
  STARTER:      "bg-slate-100 text-slate-600",
  PROFESSIONAL: "bg-blue-100 text-blue-700",
  ENTERPRISE:   "bg-purple-100 text-purple-700",
};
function PlanBadge({ plan }: { plan: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_CFG[plan] ?? "bg-slate-100 text-slate-600"}`}>{titleCase(plan)}</span>;
}

/* ─── bar chart ──────────────────────────────────────────── */

function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const maxOrgs  = Math.max(...data.map((d) => d.orgs),  1);
  const maxUsers = Math.max(...data.map((d) => d.users), 1);
  const max      = Math.max(maxOrgs, maxUsers, 1);

  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full items-end gap-1" style={{ height: "140px" }}>
            <div
              className="flex-1 rounded-t-md bg-[#D4AF37]"
              style={{ height: `${Math.max(3, (d.orgs / max) * 130)}px` }}
              title={`Orgs: ${d.orgs}`}
            />
            <div
              className="flex-1 rounded-t-md bg-blue-400"
              style={{ height: `${Math.max(3, (d.users / max) * 130)}px` }}
              title={`Users: ${d.users}`}
            />
          </div>
          <span className="text-[10px] font-medium text-[#666B84]">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── stacked bar (plan/status breakdown) ────────────────── */

function BreakdownBar({ items }: { items: { label: string; count: number; color: string }[] }) {
  const total = items.reduce((a, i) => a + i.count, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {items.map((i) => (
          <div
            key={i.label}
            className={i.color}
            style={{ width: `${(i.count / total) * 100}%` }}
            title={`${i.label}: ${i.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((i) => (
          <div key={i.label} className="flex items-center gap-1.5 text-xs text-[#666B84]">
            <span className={`h-2.5 w-2.5 rounded-sm ${i.color}`} />
            {i.label} <span className="font-semibold text-[#20243A]">({i.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */

export default function Reports() {
  const [summary,  setSummary]  = useState<AnalyticsSummary | null>(null);
  const [audit,    setAudit]    = useState<AuditEntry[]>([]);
  const [topOrgs,  setTopOrgs]  = useState<TopOrg[]>([]);
  const [countries, setCountries] = useState<CountryCount[]>([]);
  const [growth,   setGrowth]   = useState<GrowthPoint[]>([]);
  const [statusBd, setStatusBd] = useState<{ active: number; trial: number; expired: number; suspended: number; cancelled: number } | null>(null);
  const [planBd,   setPlanBd]   = useState<{ starter: number; professional: number; enterprise: number } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const [sumRes, growRes] = await Promise.all([getAnalyticsSummary(), getGrowthData()]);
        setSummary(sumRes.summary);
        setAudit(sumRes.recentAudit);
        setTopOrgs(sumRes.topOrgs);
        setCountries(sumRes.countryBreakdown);
        setGrowth(growRes.growth);
        setStatusBd(growRes.statusBreakdown);
        setPlanBd(growRes.planBreakdown);
      } catch { setError("Unable to load analytics data."); }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#D4AF37]" />
    </div>
  );

  if (error || !summary) return (
    <div className="flex h-96 flex-col items-center justify-center gap-3">
      <XCircle size={36} className="text-red-400" />
      <p className="text-sm text-[#666B84]">{error ?? "No data."}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Platform-wide business intelligence — organizations, users, revenue and growth."
      />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 gap-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <Building2 size={26} className="text-[#D4AF37]" />
          <p className="mt-4 text-sm text-[#666B84]">Organizations</p>
          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">{summary.totalOrgs}</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">{summary.activeOrgs} active</p>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <Users size={26} className="text-blue-600" />
          <p className="mt-4 text-sm text-[#666B84]">Users</p>
          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">{summary.totalUsers}</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">{summary.activeUsers} active</p>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <CreditCard size={26} className="text-green-600" />
          <p className="mt-4 text-sm text-[#666B84]">Subscriptions</p>
          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">{summary.totalSubs}</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">{summary.activeSubs} active</p>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <TrendingUp size={26} className="text-purple-600" />
          <p className="mt-4 text-sm text-[#666B84]">Monthly Revenue</p>
          <h2 className="mt-2 text-3xl font-bold text-purple-600">{fmtKES(summary.mrr)}</h2>
        </div>
      </div>

      {/* ── Growth chart + country breakdown ── */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-bold text-[#20243A]">Platform Growth — Last 6 Months</h3>
            <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#D4AF37]" />Orgs</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />Users</span>
            </div>
          </div>
          {growth.length > 0
            ? <GrowthChart data={growth} />
            : <div className="flex h-44 items-center justify-center text-sm text-[#94A3B8]">No growth data yet.</div>
          }
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Globe size={16} className="text-[#94A3B8]" />
            <h3 className="text-base font-bold text-[#20243A]">Organizations by Country</h3>
          </div>
          {countries.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No data.</p>
          ) : (
            <div className="space-y-3">
              {countries.map((c) => {
                const total = countries.reduce((a, x) => a + x.count, 0) || 1;
                const pct   = Math.round((c.count / total) * 100);
                return (
                  <div key={c.country}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[#666B84]">{c.country}</span>
                      <span className="font-semibold text-[#20243A]">{c.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#F1F5F9]">
                      <div className="h-2 rounded-full bg-[#D4AF37]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Breakdowns ── */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#94A3B8]" />
            <h3 className="text-base font-bold text-[#20243A]">Subscription Status</h3>
          </div>
          {statusBd && (
            <BreakdownBar items={[
              { label: "Active",    count: statusBd.active,    color: "bg-green-500"  },
              { label: "Trial",     count: statusBd.trial,     color: "bg-yellow-400" },
              { label: "Suspended", count: statusBd.suspended, color: "bg-red-400"    },
              { label: "Expired",   count: statusBd.expired,   color: "bg-slate-300"  },
              { label: "Cancelled", count: statusBd.cancelled, color: "bg-red-200"    },
            ]} />
          )}
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <CreditCard size={16} className="text-[#94A3B8]" />
            <h3 className="text-base font-bold text-[#20243A]">Plan Distribution</h3>
          </div>
          {planBd && (
            <BreakdownBar items={[
              { label: "Starter",      count: planBd.starter,      color: "bg-slate-400"  },
              { label: "Professional", count: planBd.professional, color: "bg-blue-500"   },
              { label: "Enterprise",   count: planBd.enterprise,   color: "bg-purple-500" },
            ]} />
          )}
        </div>
      </div>

      {/* ── Top orgs + Recent audit ── */}
      <div className="grid grid-cols-2 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
          <div className="border-b border-[#F1F5F9] px-6 py-5">
            <h3 className="text-base font-bold text-[#20243A]">Top Organizations by Revenue</h3>
          </div>
          {topOrgs.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#94A3B8]">No data yet.</div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {topOrgs.map((o, idx) => (
                <div key={o.id} className="flex items-center gap-4 px-6 py-4">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#FEF9C3] text-xs font-bold text-[#B8962E]">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-[#20243A]">{o.organization.name}</p>
                    <p className="text-xs text-[#94A3B8]">{o.organization.country}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PlanBadge plan={o.plan} />
                    <span className="text-sm font-semibold text-green-600">{fmtKES(o.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-6 py-5">
            <Clock size={16} className="text-[#94A3B8]" />
            <h3 className="text-base font-bold text-[#20243A]">Recent Platform Activity</h3>
          </div>
          {audit.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#94A3B8]">No recent activity.</div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {audit.map((a) => (
                <div key={a.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#20243A]">
                        {a.action.replace(/_/g, " ")}
                      </p>
                      <p className="truncate text-xs text-[#94A3B8]">
                        {a.actorEmail} · {a.details ?? a.resource}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[#94A3B8]">
                      <CheckCircle size={11} className="text-green-400" />
                      {fmtDate(a.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}