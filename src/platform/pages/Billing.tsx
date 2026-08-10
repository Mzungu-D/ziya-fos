import { useEffect, useState } from "react";
import {
  AlertTriangle, BarChart3, Calendar, CheckCircle,
  Clock, CreditCard, Loader2, TrendingUp, XCircle,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import { getBillingStats, getRevenueBreakdown } from "../../services/platformBilling";
import type { BillingStats, ExpiringSub, RecentSub, RevenuePoint } from "../../services/platformBilling";

function fmtKES(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(0)}K`;
  return `KES ${n.toLocaleString("en-KE")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
function titleCase(s: string) { return s.charAt(0) + s.slice(1).toLowerCase(); }

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg: "bg-green-100",  text: "text-green-700"  },
  TRIAL:     { bg: "bg-yellow-100", text: "text-yellow-700" },
  SUSPENDED: { bg: "bg-red-100",    text: "text-red-700"    },
  EXPIRED:   { bg: "bg-slate-100",  text: "text-slate-500"  },
  CANCELLED: { bg: "bg-red-100",    text: "text-red-700"    },
};
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { bg: "bg-slate-100", text: "text-slate-500" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>{titleCase(status)}</span>;
}

const PLAN_CFG: Record<string, string> = {
  STARTER:      "bg-slate-100 text-slate-600",
  PROFESSIONAL: "bg-blue-100 text-blue-700",
  ENTERPRISE:   "bg-purple-100 text-purple-700",
};
function PlanBadge({ plan }: { plan: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_CFG[plan] ?? "bg-slate-100 text-slate-600"}`}>{titleCase(plan)}</span>;
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-[#94A3B8]">{fmtKES(d.revenue)}</span>
          <div className="w-full rounded-t-lg bg-[#D4AF37] transition-all duration-500"
            style={{ height: `${Math.max(4, (d.revenue / max) * 120)}px` }} />
          <span className="text-[10px] font-medium text-[#666B84]">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function PlanDonut({ starter, professional, enterprise }: { starter: number; professional: number; enterprise: number }) {
  const total = starter + professional + enterprise || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <div className="space-y-3">
      {[
        { label: "Starter",      count: starter,      color: "bg-slate-400", pct: pct(starter) },
        { label: "Professional", count: professional, color: "bg-blue-500",  pct: pct(professional) },
        { label: "Enterprise",   count: enterprise,   color: "bg-purple-500", pct: pct(enterprise) },
      ].map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-[#666B84]">
            <span>{r.label}</span>
            <span className="font-semibold text-[#20243A]">{r.count} ({r.pct}%)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#F1F5F9]">
            <div className={`h-2 rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Billing() {
  const [stats,    setStats]    = useState<BillingStats | null>(null);
  const [expiring, setExpiring] = useState<ExpiringSub[]>([]);
  const [recent,   setRecent]   = useState<RecentSub[]>([]);
  const [revenue,  setRevenue]  = useState<RevenuePoint[]>([]);
  const [planRev,  setPlanRev]  = useState<{ STARTER: number; PROFESSIONAL: number; ENTERPRISE: number } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const [statsRes, revRes] = await Promise.all([getBillingStats(), getRevenueBreakdown()]);
        setStats(statsRes.stats);
        setExpiring(statsRes.expiringSoon);
        setRecent(statsRes.recentSubscriptions);
        setRevenue(revRes.revenue);
        setPlanRev(revRes.planRevenue);
      } catch { setError("Unable to load billing data."); }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 size={32} className="animate-spin text-[#D4AF37]" /></div>;
  if (error || !stats) return (
    <div className="flex h-96 flex-col items-center justify-center gap-3">
      <XCircle size={36} className="text-red-400" />
      <p className="text-sm text-[#666B84]">{error ?? "No data."}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Billing & Revenue" subtitle="Recurring revenue, subscription performance and commercial health across all organizations." />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <TrendingUp size={26} className="text-[#D4AF37]" />
          <p className="mt-4 text-sm text-[#666B84]">Monthly Recurring Revenue</p>
          <h2 className="mt-2 text-3xl font-bold text-[#D4AF37]">{fmtKES(stats.mrr)}</h2>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <BarChart3 size={26} className="text-purple-600" />
          <p className="mt-4 text-sm text-[#666B84]">Annual Recurring Revenue</p>
          <h2 className="mt-2 text-3xl font-bold text-purple-600">{fmtKES(stats.arr)}</h2>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <CheckCircle size={26} className="text-green-600" />
          <p className="mt-4 text-sm text-[#666B84]">Active Subscriptions</p>
          <h2 className="mt-2 text-3xl font-bold text-green-600">{stats.counts.active}</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">{stats.counts.trial} on trial</p>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <CreditCard size={26} className="text-blue-600" />
          <p className="mt-4 text-sm text-[#666B84]">Total Subscriptions</p>
          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">{stats.counts.total}</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">{stats.counts.expired} expired · {stats.counts.cancelled} cancelled</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-base font-bold text-[#20243A]">Revenue — Last 6 Months</h3>
          {revenue.length > 0 ? <RevenueChart data={revenue} /> : (
            <div className="flex h-40 items-center justify-center text-sm text-[#94A3B8]">No revenue data yet.</div>
          )}
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-base font-bold text-[#20243A]">Plan Breakdown</h3>
          <PlanDonut starter={stats.planBreakdown.starter} professional={stats.planBreakdown.professional} enterprise={stats.planBreakdown.enterprise} />
          {planRev && (
            <div className="mt-6 space-y-2 border-t border-[#F1F5F9] pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Monthly Revenue / Plan</p>
              {[{ label: "Starter", val: planRev.STARTER }, { label: "Professional", val: planRev.PROFESSIONAL }, { label: "Enterprise", val: planRev.ENTERPRISE }].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <span className="text-[#666B84]">{r.label}</span>
                  <span className="font-semibold text-[#20243A]">{fmtKES(Math.round(r.val))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-6 py-5">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-base font-bold text-[#20243A]">Expiring Within 30 Days</h3>
          </div>
          {expiring.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#94A3B8]">No subscriptions expiring soon.</div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {expiring.map((s) => {
                const days = daysUntil(s.endDate);
                return (
                  <div key={s.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">{s.organization.name}</p>
                      <p className="text-xs text-[#94A3B8]">{fmtDate(s.endDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <PlanBadge plan={s.plan} />
                      <span className={`text-xs font-semibold ${days <= 7 ? "text-red-600" : "text-amber-600"}`}>{days}d left</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-6 py-5">
            <Clock size={16} className="text-[#94A3B8]" />
            <h3 className="text-base font-bold text-[#20243A]">Recent Subscriptions</h3>
          </div>
          {recent.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#94A3B8]">No subscriptions yet.</div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold text-[#20243A]">{s.organization.name}</p>
                    <p className="text-xs text-[#94A3B8]">{fmtDate(s.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <PlanBadge plan={s.plan} />
                    <StatusBadge status={s.status} />
                    <span className="text-xs font-semibold text-green-600">{fmtKES(s.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status summary */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-base font-bold text-[#20243A]">Subscription Status Summary</h3>
        <div className="flex items-center gap-6">
          {[
            { label: "Active",    count: stats.counts.active,    color: "text-green-600",  bg: "bg-green-100"  },
            { label: "Trial",     count: stats.counts.trial,     color: "text-yellow-600", bg: "bg-yellow-100" },
            { label: "Suspended", count: stats.counts.suspended, color: "text-red-600",    bg: "bg-red-100"    },
            { label: "Expired",   count: stats.counts.expired,   color: "text-slate-500",  bg: "bg-slate-100"  },
            { label: "Cancelled", count: stats.counts.cancelled, color: "text-red-500",    bg: "bg-red-50"     },
          ].map((s) => (
            <div key={s.label} className={`flex flex-1 flex-col items-center rounded-xl py-4 ${s.bg}`}>
              <Calendar size={18} className={s.color} />
              <p className={`mt-2 text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="mt-1 text-xs text-[#666B84]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}