import { useEffect, useState } from "react";
import {
  Activity, CheckCircle2, Cpu, Database,
  HardDrive, Loader2, RefreshCw, Server,
  Users, XCircle, Zap,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import { getSystemHealth } from "../../services/platformHealth";
import type { HealthData } from "../../services/platformHealth";

/* ─── helpers ────────────────────────────────────────────── */

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

/* ─── status pill ────────────────────────────────────────── */

function StatusPill({ status }: { status: string }) {
  const cfg =
    status === "healthy"  ? { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  label: "Healthy"  } :
    status === "degraded" ? { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500", label: "Degraded" } :
                            { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "Down"     };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-2 w-2 rounded-full animate-pulse ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ─── memory bar ─────────────────────────────────────────── */

function MemBar({ pct }: { pct: number }) {
  const color = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
      <div className={`h-2.5 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ─── info row ───────────────────────────────────────────── */

function InfoRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3">
      <span className="text-sm text-[#666B84]">{label}</span>
      <div className="text-right">
        <p className="text-sm font-semibold text-[#20243A]">{value}</p>
        {sub && <p className="text-xs text-[#94A3B8]">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── service row ────────────────────────────────────────── */

function ServiceRow({ icon, label, value, ok }: {
  icon: React.ReactNode; label: string; value: string; ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[#F1F5F9] py-4 first:border-0 first:pt-0">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8F9FC]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#20243A]">{label}</p>
          <p className="text-xs text-[#94A3B8]">{value}</p>
        </div>
      </div>
      {ok
        ? <CheckCircle2 size={18} className="text-green-500" />
        : <XCircle     size={18} className="text-red-500"   />
      }
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */

export default function SystemHealth() {
  const [health,   setHealth]   = useState<HealthData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string>("");

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await getSystemHealth();
      setHealth(res.health);
      setLastCheck(fmtTime(res.health.checkedAt));
    } catch {
      setError("Unable to reach health endpoint.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  /* auto-refresh every 30s */
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="System Health"
        subtitle="Live infrastructure metrics — server, database and platform status."
      />

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between rounded-2xl border border-[#ECECF3] bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          {health && <StatusPill status={health.status} />}
          {lastCheck && <p className="text-xs text-[#94A3B8]">Last checked at {lastCheck} · auto-refreshes every 30s</p>}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#ECECF3] px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#F8F9FC] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && !health ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#D4AF37]" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <XCircle size={36} className="text-red-400" />
          <p className="text-sm text-[#666B84]">{error}</p>
          <button onClick={load} className="text-sm font-medium text-[#D4AF37] hover:underline">Retry</button>
        </div>
      ) : health ? (
        <>
          {/* ── Top KPIs ── */}
          <div className="grid grid-cols-4 gap-5">
            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <Server size={26} className="text-green-600" />
              <p className="mt-4 text-sm text-[#666B84]">API Server</p>
              <h2 className="mt-2 text-2xl font-bold text-green-600">Online</h2>
              <p className="mt-1 text-xs text-[#94A3B8]">Uptime {health.server.uptime}</p>
            </div>
            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <Database size={26} className={health.database.connected ? "text-blue-600" : "text-red-500"} />
              <p className="mt-4 text-sm text-[#666B84]">PostgreSQL</p>
              <h2 className={`mt-2 text-2xl font-bold ${health.database.connected ? "text-blue-600" : "text-red-500"}`}>
                {health.database.connected ? "Connected" : "Down"}
              </h2>
              <p className="mt-1 text-xs text-[#94A3B8]">{health.database.latencyMs}ms latency</p>
            </div>
            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <Users size={26} className="text-purple-600" />
              <p className="mt-4 text-sm text-[#666B84]">Active Users</p>
              <h2 className="mt-2 text-2xl font-bold text-[#20243A]">{health.database.counts.activeUsers}</h2>
              <p className="mt-1 text-xs text-[#94A3B8]">{health.database.counts.sessions} sessions</p>
            </div>
            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <Activity size={26} className="text-[#D4AF37]" />
              <p className="mt-4 text-sm text-[#666B84]">Today's Events</p>
              <h2 className="mt-2 text-2xl font-bold text-[#D4AF37]">{health.database.counts.auditToday}</h2>
              <p className="mt-1 text-xs text-[#94A3B8]">{health.database.counts.auditLogs.toLocaleString()} total</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">

            {/* ── Services ── */}
            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-base font-bold text-[#20243A]">Service Status</h3>
              <ServiceRow icon={<Server   size={16} className="text-[#D4AF37]"  />} label="Railway Server" value="Express · Node.js"    ok={true} />
              <ServiceRow icon={<Database size={16} className="text-blue-600"   />} label="PostgreSQL"     value={health.database.host} ok={health.database.connected} />
              <ServiceRow icon={<Zap      size={16} className="text-purple-600" />} label="Prisma ORM"     value={`v6 · ${health.database.latencyMs}ms ping`} ok={health.database.connected} />
              <ServiceRow icon={<Activity size={16} className="text-green-600"  />} label="Audit Logger"   value="Platform event tracking" ok={true} />
            </div>

            {/* ── Server metrics ── */}
            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-base font-bold text-[#20243A]">Server Metrics</h3>
              <div className="space-y-3">
                <InfoRow label="Node.js Version" value={health.server.nodeVersion} />
                <InfoRow label="Platform"         value={health.server.platform} />
                <InfoRow label="Environment"      value={health.server.environment.toUpperCase()} />
                <InfoRow label="Uptime"           value={health.server.uptime} />
                <InfoRow label="DB Latency"       value={`${health.database.latencyMs}ms`} />
              </div>
            </div>

          </div>

          {/* ── Memory + DB counts ── */}
          <div className="grid grid-cols-2 gap-6">

            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Cpu size={16} className="text-[#94A3B8]" />
                <h3 className="text-base font-bold text-[#20243A]">Memory Usage</h3>
                <span className={`ml-auto text-sm font-bold ${health.server.memory.pct > 85 ? "text-red-600" : health.server.memory.pct > 60 ? "text-yellow-600" : "text-green-600"}`}>
                  {health.server.memory.pct}%
                </span>
              </div>
              <MemBar pct={health.server.memory.pct} />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#F8F9FC] p-3 text-center">
                  <p className="text-xs text-[#94A3B8]">Heap Used</p>
                  <p className="mt-1 text-sm font-bold text-[#20243A]">{health.server.memory.usedMB} MB</p>
                </div>
                <div className="rounded-xl bg-[#F8F9FC] p-3 text-center">
                  <p className="text-xs text-[#94A3B8]">Heap Total</p>
                  <p className="mt-1 text-sm font-bold text-[#20243A]">{health.server.memory.totalMB} MB</p>
                </div>
                <div className="rounded-xl bg-[#F8F9FC] p-3 text-center">
                  <p className="text-xs text-[#94A3B8]">RSS</p>
                  <p className="mt-1 text-sm font-bold text-[#20243A]">{health.server.memory.rssMB} MB</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <HardDrive size={16} className="text-[#94A3B8]" />
                <h3 className="text-base font-bold text-[#20243A]">Database Records</h3>
              </div>
              <div className="space-y-3">
                <InfoRow label="Organizations" value={health.database.counts.organizations} sub={`${health.database.counts.activeOrgs} active`} />
                <InfoRow label="Users"         value={health.database.counts.users}         sub={`${health.database.counts.activeUsers} active`} />
                <InfoRow label="Subscriptions" value={health.database.counts.subscriptions} sub={`${health.database.counts.activeSubs} active`} />
                <InfoRow label="Sessions"      value={health.database.counts.sessions} />
                <InfoRow label="Audit Logs"    value={health.database.counts.auditLogs.toLocaleString()} sub={`${health.database.counts.auditToday} today`} />
              </div>
            </div>

          </div>
        </>
      ) : null}
    </div>
  );
}