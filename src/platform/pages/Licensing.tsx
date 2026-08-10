import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import { getLicensingStats, getLicenses } from "../../services/platformLicensing";
import type { License, LicensingStats } from "../../services/platformLicensing";

/* ─── helpers ────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
function fmtKES(n: number) {
  return `KES ${n.toLocaleString("en-KE")}`;
}
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}
function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/* ─── badges ─────────────────────────────────────────────── */

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:    { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
  TRIAL:     { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  SUSPENDED: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
  EXPIRED:   { bg: "bg-slate-100",  text: "text-slate-500",  dot: "bg-slate-400"  },
  CANCELLED: { bg: "bg-red-100",    text: "text-red-600",    dot: "bg-red-400"    },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {titleCase(status)}
    </span>
  );
}

const PLAN_CFG: Record<string, string> = {
  STARTER:      "bg-slate-100 text-slate-600",
  PROFESSIONAL: "bg-blue-100 text-blue-700",
  ENTERPRISE:   "bg-purple-100 text-purple-700",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_CFG[plan] ?? "bg-slate-100 text-slate-600"}`}>
      {titleCase(plan)}
    </span>
  );
}

/* ─── compliance meter ───────────────────────────────────── */

function ComplianceMeter({ rate }: { rate: number }) {
  const color = rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500";
  const text  = rate >= 80 ? "text-green-600" : rate >= 50 ? "text-yellow-600" : "text-red-600";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-[#666B84]">License Compliance</span>
        <span className={`text-sm font-bold ${text}`}>{rate}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className={`h-2.5 rounded-full transition-all duration-700 ${color}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

/* ─── constants ──────────────────────────────────────────── */

const PLANS    = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];
const STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED", "EXPIRED", "CANCELLED"];
const LIMIT    = 25;

/* ─── main page ─────────────────────────────────────────── */

export default function Licensing() {
  const [stats,    setStats]    = useState<LicensingStats | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [q,      setQ]      = useState("");
  const [status, setStatus] = useState("");
  const [plan,   setPlan]   = useState("");
  const [page,   setPage]   = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([
        getLicensingStats(),
        getLicenses({ q, status, plan, page, limit: LIMIT }),
      ]);
      setStats(statsRes.stats);
      setLicenses(listRes.licenses);
      setTotal(listRes.pagination.total);
    } catch {
      setError("Unable to load licensing data.");
    } finally {
      setLoading(false);
    }
  }, [q, status, plan, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, status, plan]);

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Licensing"
        subtitle="Manage platform licenses, organization entitlements and feature access."
      />

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-4 gap-5">
          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
            <ShieldCheck size={28} className="text-[#D4AF37]" />
            <p className="mt-4 text-sm text-[#666B84]">Active Licenses</p>
            <h2 className="mt-2 text-4xl font-bold text-[#20243A]">{stats.active}</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">{stats.trial} on trial</p>
          </div>

          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
            <Building2 size={28} className="text-blue-600" />
            <p className="mt-4 text-sm text-[#666B84]">Total Issued</p>
            <h2 className="mt-2 text-4xl font-bold text-[#20243A]">{stats.total}</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">{stats.expired} expired · {stats.cancelled} cancelled</p>
          </div>

          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
            <KeyRound size={28} className="text-amber-500" />
            <p className="mt-4 text-sm text-[#666B84]">Expiring in 30 Days</p>
            <h2 className={`mt-2 text-4xl font-bold ${stats.expiringIn30Days > 0 ? "text-amber-500" : "text-[#20243A]"}`}>
              {stats.expiringIn30Days}
            </h2>
          </div>

          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
            <BadgeCheck size={28} className="text-purple-600" />
            <p className="mt-4 text-sm text-[#666B84]">Compliance</p>
            <h2 className={`mt-2 text-4xl font-bold ${stats.complianceRate >= 80 ? "text-green-600" : stats.complianceRate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
              {stats.complianceRate}%
            </h2>
            <div className="mt-3">
              <ComplianceMeter rate={stats.complianceRate} />
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by organization…"
            className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-9 pr-3 text-sm outline-none focus:border-[#D4AF37]"
          />
        </div>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}
          className="h-11 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#475569] outline-none focus:border-[#D4AF37]">
          <option value="">All Plans</option>
          {PLANS.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="h-11 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#475569] outline-none focus:border-[#D4AF37]">
          <option value="">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="border-b border-[#ECECF3] bg-[#F8F9FC] px-6 py-5">
          <h2 className="text-xl font-bold text-[#20243A]">All Licenses</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">{total} total</p>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[#D4AF37]" />
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <XCircle size={32} className="text-red-400" />
            <p className="text-sm text-[#666B84]">{error}</p>
            <button onClick={load} className="text-sm font-medium text-[#D4AF37] hover:underline">Retry</button>
          </div>
        ) : licenses.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <ShieldCheck size={36} className="text-[#C7CCD9]" />
            <p className="text-sm text-[#666B84]">No licenses found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F8F9FC] text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              <tr>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Billing</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Start</th>
                <th className="px-6 py-4">Expires</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic) => {
                const expiring = lic.endDate && lic.status === "ACTIVE" && daysUntil(lic.endDate) <= 30;
                return (
                  <tr key={lic.id} className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF9C3] text-xs font-bold text-[#B8962E]">
                          {initials(lic.organization.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-[#20243A]">{lic.organization.name}</p>
                          <p className="text-xs text-[#94A3B8]">{lic.organization.country}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5"><PlanBadge plan={lic.plan} /></td>
                    <td className="px-6 py-5 text-sm text-[#666B84]">{titleCase(lic.billingCycle)}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-green-600">{fmtKES(lic.amount)}</td>
                    <td className="px-6 py-5"><StatusBadge status={lic.status} /></td>
                    <td className="px-6 py-5 text-sm text-[#666B84]">{fmtDate(lic.startDate)}</td>
                    <td className="px-6 py-5">
                      {lic.endDate ? (
                        <div>
                          <p className="text-sm text-[#666B84]">{fmtDate(lic.endDate)}</p>
                          {expiring && (
                            <p className="text-xs font-semibold text-amber-600">{daysUntil(lic.endDate)}d left</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#C7CCD9]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && pages > 1 && (
          <div className="flex items-center justify-between border-t border-[#ECECF3] px-6 py-4">
            <p className="text-xs text-[#94A3B8]">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-[#ECECF3] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F8F9FC] disabled:opacity-40">
                Previous
              </button>
              <span className="text-xs text-[#94A3B8]">Page {page} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="rounded-lg border border-[#ECECF3] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F8F9FC] disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}