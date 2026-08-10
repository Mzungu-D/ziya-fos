import { useCallback, useEffect, useState } from "react";
import {
  Activity, FileClock, Loader2,
  Search, ShieldCheck, XCircle,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import { getAuditStats, getAuditLogs } from "../../services/platformAuditLogs";
import type { AuditLog } from "../../services/platformAuditLogs";

/* ─── helpers ────────────────────────────────────────────── */

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtAction(action: string) {
  return action.replace(/_/g, " ");
}

/* ─── resource badge ─────────────────────────────────────── */

const RES_CFG: Record<string, string> = {
  ORGANIZATION: "bg-blue-100 text-blue-700",
  USER:         "bg-purple-100 text-purple-700",
  SUBSCRIPTION: "bg-yellow-100 text-yellow-700",
  PLATFORM:     "bg-slate-100 text-slate-600",
};
function ResourceBadge({ resource }: { resource: string }) {
  const cls = RES_CFG[resource] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {resource.charAt(0) + resource.slice(1).toLowerCase()}
    </span>
  );
}

/* ─── action colour dot ──────────────────────────────────── */

function ActionDot({ action }: { action: string }) {
  const a = action.toUpperCase();
  const color =
    a.includes("DELETE") || a.includes("SUSPEND") || a.includes("DEACTIVATE")
      ? "bg-red-500"
      : a.includes("CREATE") || a.includes("APPROVE") || a.includes("ACTIVATE")
      ? "bg-green-500"
      : a.includes("UPDATE") || a.includes("UNLOCK")
      ? "bg-yellow-500"
      : "bg-slate-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

/* ─── constants ──────────────────────────────────────────── */

const RESOURCES = ["ORGANIZATION", "USER", "SUBSCRIPTION", "PLATFORM"];
const LIMIT     = 30;

/* ─── main page ─────────────────────────────────────────── */

export default function AuditLogs() {
  /* stats */
  const [statsData, setStatsData] = useState<{
    total: number; today: number; thisWeek: number;
    topActions: { action: string; count: number }[];
  } | null>(null);

  /* logs */
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  /* filters */
  const [q,        setQ]        = useState("");
  const [resource, setResource] = useState("");
  const [page,     setPage]     = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [statsRes, logsRes] = await Promise.all([
        getAuditStats(),
        getAuditLogs({ q, resource, page, limit: LIMIT }),
      ]);
      setStatsData({ ...statsRes.stats, topActions: statsRes.topActions });
      setLogs(logsRes.logs);
      setTotal(logsRes.pagination.total);
    } catch {
      setError("Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [q, resource, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, resource]);

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Logs"
        subtitle="Every platform action — who did what, when, and from where."
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <FileClock size={26} className="text-[#D4AF37]" />
          <p className="mt-4 text-sm text-[#666B84]">Total Events</p>
          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">
            {statsData ? statsData.total.toLocaleString() : "—"}
          </h2>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <Activity size={26} className="text-blue-600" />
          <p className="mt-4 text-sm text-[#666B84]">Events Today</p>
          <h2 className="mt-2 text-4xl font-bold text-blue-600">
            {statsData ? statsData.today.toLocaleString() : "—"}
          </h2>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <ShieldCheck size={26} className="text-green-600" />
          <p className="mt-4 text-sm text-[#666B84]">This Week</p>
          <h2 className="mt-2 text-4xl font-bold text-green-600">
            {statsData ? statsData.thisWeek.toLocaleString() : "—"}
          </h2>
        </div>
      </div>

      {/* ── Top actions ── */}
      {statsData && statsData.topActions.length > 0 && (
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-base font-bold text-[#20243A]">Most Frequent Actions</h3>
          <div className="flex flex-wrap gap-3">
            {statsData.topActions.map((a) => (
              <div key={a.action}
                className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-2">
                <ActionDot action={a.action} />
                <span className="text-sm font-medium text-[#20243A]">{fmtAction(a.action)}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#666B84] shadow-sm">
                  {a.count}
                </span>
              </div>
            ))}
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
            placeholder="Search by actor, action or details…"
            className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-9 pr-3 text-sm outline-none focus:border-[#D4AF37]"
          />
        </div>
        <select
          value={resource}
          onChange={(e) => setResource(e.target.value)}
          className="h-11 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#475569] outline-none focus:border-[#D4AF37]"
        >
          <option value="">All Resources</option>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="border-b border-[#ECECF3] bg-[#F8F9FC] px-6 py-5">
          <h2 className="text-xl font-bold text-[#20243A]">Activity Log</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">{total.toLocaleString()} total events</p>
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
        ) : logs.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <FileClock size={36} className="text-[#C7CCD9]" />
            <p className="text-sm text-[#666B84]">No audit events found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F8F9FC] text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              <tr>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4">IP</th>
                <th className="px-6 py-4">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-[#20243A]">{log.actorEmail}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ActionDot action={log.action} />
                      <span className="text-sm text-[#20243A]">{fmtAction(log.action)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4"><ResourceBadge resource={log.resource} /></td>
                  <td className="max-w-[220px] px-6 py-4">
                    <p className="truncate text-sm text-[#666B84]">{log.details ?? "—"}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">
                    {log.ipAddress ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#666B84]">
                    {fmtDateTime(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && pages > 1 && (
          <div className="flex items-center justify-between border-t border-[#ECECF3] px-6 py-4">
            <p className="text-xs text-[#94A3B8]">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
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