import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle, ChevronLeft, ChevronRight,
  Clock, Loader2, Plus, RefreshCw, Search, Ticket, X,
} from "lucide-react";

import PageHeader    from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

import {
  getSupportStats, getTickets, createTicket, updateTicket,
} from "../../services/platformSupport";
import type { SupportStats, SupportTicket, TicketFilters } from "../../services/platformSupport";
import { getOrganizations } from "../../services/platformOrganizations";

/* ─── constants ──────────────────────────────────────────── */

const STATUSES   = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT"];

/* ─── helpers ────────────────────────────────────────────── */

function statusCfg(s: string) {
  return s === "OPEN"        ? { bg: "bg-orange-100", text: "text-orange-700", label: "Open" }
       : s === "IN_PROGRESS" ? { bg: "bg-blue-100",   text: "text-blue-700",   label: "In Progress" }
       : s === "RESOLVED"    ? { bg: "bg-green-100",  text: "text-green-700",  label: "Resolved" }
       :                       { bg: "bg-slate-100",  text: "text-slate-600",  label: "Closed" };
}

function priorityCfg(p: string) {
  return p === "CRITICAL" ? { bg: "bg-red-100",    text: "text-red-700",    label: "Critical" }
       : p === "HIGH"     ? { bg: "bg-red-50",     text: "text-red-600",    label: "High" }
       : p === "MEDIUM"   ? { bg: "bg-yellow-100", text: "text-yellow-700", label: "Medium" }
       :                    { bg: "bg-green-100",  text: "text-green-700",  label: "Low" };
}

function Pill({ cfg }: { cfg: { bg: string; text: string; label: string } }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── shared button style ────────────────────────────────── */

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5A4BE8] disabled:opacity-50";

/* ─── modal: create ticket ───────────────────────────────── */

interface Org { id: string; name: string }

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [orgs,    setOrgs]    = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    organizationId: "",
    subject:        "",
    description:    "",
    priority:       "MEDIUM",
    category:       "GENERAL",
  });

  useEffect(() => {
    getOrganizations()
      .then((r) => setOrgs(r.organizations ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.organizationId || !form.subject || !form.description) return;
    setLoading(true);
    try {
      await createTicket(form);
      onCreated();
      onClose();
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[560px] rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#20243A]">New Support Ticket</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569]"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Organization</label>
            <select
              required
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#20243A] focus:border-[#D4AF37] outline-none"
            >
              <option value="">Select organization…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Subject</label>
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief description of the issue"
              className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm focus:border-[#D4AF37] outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Description</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Full details of the request or issue…"
              className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 py-2.5 text-sm focus:border-[#D4AF37] outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm focus:border-[#D4AF37] outline-none"
              >
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm focus:border-[#D4AF37] outline-none"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8F9FC]">
              Cancel
            </button>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── modal: view / update ticket ───────────────────────── */

function DetailModal({ ticket, onClose, onUpdated }: {
  ticket:    SupportTicket;
  onClose:   () => void;
  onUpdated: () => void;
}) {
  const [status,     setStatus]     = useState(ticket.status);
  const [priority,   setPriority]   = useState(ticket.priority);
  const [adminNotes, setAdminNotes] = useState(ticket.adminNotes ?? "");
  const [saving,     setSaving]     = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateTicket(ticket.id, { status, priority, adminNotes });
      onUpdated();
      onClose();
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[620px] max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-[#94A3B8]">{ticket.ticketNumber}</p>
            <h2 className="mt-1 text-lg font-bold text-[#20243A]">{ticket.subject}</h2>
            <p className="mt-0.5 text-sm text-[#666B84]">{ticket.organization.name}</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569]"><X size={20} /></button>
        </div>

        <div className="mb-6 rounded-xl bg-[#F8F9FC] px-4 py-3">
          <p className="text-xs font-semibold text-[#94A3B8] mb-1">Description</p>
          <p className="text-sm text-[#20243A] whitespace-pre-wrap">{ticket.description}</p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-[#ECECF3] px-3 py-2.5">
            <p className="text-xs text-[#94A3B8]">Category</p>
            <p className="mt-0.5 font-semibold text-[#20243A] capitalize">{ticket.category.toLowerCase()}</p>
          </div>
          <div className="rounded-xl border border-[#ECECF3] px-3 py-2.5">
            <p className="text-xs text-[#94A3B8]">Created</p>
            <p className="mt-0.5 font-semibold text-[#20243A]">{fmtDate(ticket.createdAt)}</p>
          </div>
          <div className="rounded-xl border border-[#ECECF3] px-3 py-2.5">
            <p className="text-xs text-[#94A3B8]">Resolved</p>
            <p className="mt-0.5 font-semibold text-[#20243A]">{ticket.resolvedAt ? fmtDate(ticket.resolvedAt) : "—"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SupportTicket["status"])}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm focus:border-[#D4AF37] outline-none"
              >
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SupportTicket["priority"])}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm focus:border-[#D4AF37] outline-none"
              >
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Admin Notes</label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes (not visible to organization)…"
              className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 py-2.5 text-sm focus:border-[#D4AF37] outline-none resize-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8F9FC]">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */

export default function Support() {
  const [stats,      setStats]      = useState<SupportStats | null>(null);
  const [tickets,    setTickets]    = useState<SupportTicket[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const [filters, setFilters] = useState<TicketFilters>({
    page: 1, pageSize: 15, search: "", status: "", priority: "", category: "",
  });

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(f: TicketFilters = filters) {
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.all([getSupportStats(), getTickets(f)]);
      setStats(sRes.stats);
      setTickets(tRes.tickets);
      setTotal(tRes.pagination.total);
      setTotalPages(tRes.pagination.totalPages);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function updateFilter(patch: Partial<TicketFilters>) {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => void load(next), 300);
  }

  function goPage(p: number) {
    const next = { ...filters, page: p };
    setFilters(next);
    void load(next);
  }

  const activeFilters = [filters.status, filters.priority, filters.category].filter(Boolean).length;

  const kpis = stats ? [
    { icon: <Ticket        size={26} className="text-[#D4AF37]"   />, label: "Open",           value: stats.openCount,              sub: `${stats.criticalCount} critical`,   color: "text-[#20243A]"  },
    { icon: <Clock         size={26} className="text-blue-600"    />, label: "In Progress",     value: stats.inProgressCount,        sub: "being worked on",                   color: "text-blue-600"   },
    { icon: <CheckCircle   size={26} className="text-green-600"   />, label: "Resolved Today",  value: stats.resolvedToday,          sub: `${stats.totalClosed} total closed`, color: "text-green-600"  },
    { icon: <AlertTriangle size={26} className="text-purple-600"  />, label: "Avg Resolution",  value: `${stats.avgResolutionHrs}h`, sub: "average time to resolve",           color: "text-purple-600" },
  ] : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Support Center"
        subtitle="Manage customer support requests, incidents and platform assistance."
      />

      {/* ── KPI stats ── */}
      <div className="grid grid-cols-4 gap-5">
        {loading && !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-[#F1F5F9]" />
            ))
          : kpis.map((k, i) => (
              <div key={i} className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
                {k.icon}
                <p className="mt-4 text-sm text-[#666B84]">{k.label}</p>
                <h2 className={`mt-2 text-3xl font-bold ${k.color}`}>{k.value}</h2>
                <p className="mt-1 text-xs text-[#94A3B8]">{k.sub}</p>
              </div>
            ))}
      </div>

      {/* ── Breakdown chips ── */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          {stats.priorityBreakdown.map((p) => (
            <button
              key={p.priority}
              onClick={() => updateFilter({ priority: filters.priority === p.priority ? "" : p.priority })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors
                ${filters.priority === p.priority
                  ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#B8860B]"
                  : "border-[#ECECF3] bg-white text-[#475569] hover:border-[#D4AF37]"}`}
            >
              {p.priority} · {p.count}
            </button>
          ))}
          <span className="mx-1 self-center text-[#ECECF3]">|</span>
          {stats.categoryBreakdown.map((c) => (
            <button
              key={c.category}
              onClick={() => updateFilter({ category: filters.category === c.category ? "" : c.category })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors
                ${filters.category === c.category
                  ? "border-[#6D5DF6] bg-[#6D5DF6]/10 text-[#6D5DF6]"
                  : "border-[#ECECF3] bg-white text-[#475569] hover:border-[#6D5DF6]"}`}
            >
              {c.category} · {c.count}
            </button>
          ))}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-[340px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              defaultValue={filters.search}
              onChange={(e) => updateFilter({ search: e.target.value })}
              placeholder="Search tickets or organisations…"
              className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-11 pr-4 text-sm outline-none focus:border-[#D4AF37]"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value })}
            className="h-11 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#475569] outline-none focus:border-[#D4AF37]"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusCfg(s).label}</option>)}
          </select>

          {activeFilters > 0 && (
            <button
              onClick={() => updateFilter({ status: "", priority: "", category: "" })}
              className="flex items-center gap-1.5 rounded-xl border border-[#ECECF3] px-3 py-2 text-xs font-medium text-[#475569] hover:bg-[#F8F9FC]"
            >
              <X size={12} /> Clear ({activeFilters})
            </button>
          )}

          <button onClick={() => void load(filters)} className="ml-auto text-[#94A3B8] hover:text-[#475569]">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} />
          <span className="ml-1.5">New Ticket</span>
        </PrimaryButton>
      </div>

      {/* ── Tickets table ── */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="border-b border-[#F1F5F9] px-6 py-4">
          <p className="text-sm font-semibold text-[#20243A]">
            {loading ? "Loading…" : `${total.toLocaleString()} ticket${total !== 1 ? "s" : ""}`}
          </p>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[#D4AF37]" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <Ticket size={32} className="text-[#ECECF3]" />
            <p className="text-sm text-[#94A3B8]">No tickets match your filters.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#FAFAFA] text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                <th className="px-6 py-3">Ticket</th>
                <th className="px-6 py-3">Organization</th>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="cursor-pointer border-b border-[#F8F9FC] transition-colors hover:bg-[#FAFAFA] last:border-0"
                >
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-[#94A3B8]">{t.ticketNumber}</td>
                  <td className="px-6 py-4 text-sm font-medium text-[#20243A]">{t.organization.name}</td>
                  <td className="max-w-[220px] truncate px-6 py-4 text-sm text-[#475569]">{t.subject}</td>
                  <td className="px-6 py-4 text-sm capitalize text-[#475569]">{t.category.toLowerCase()}</td>
                  <td className="px-6 py-4"><Pill cfg={priorityCfg(t.priority)} /></td>
                  <td className="px-6 py-4"><Pill cfg={statusCfg(t.status)}   /></td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{fmtAgo(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#F1F5F9] px-6 py-4">
            <p className="text-xs text-[#94A3B8]">
              Page {filters.page} of {totalPages} · {total} results
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={filters.page === 1}
                onClick={() => goPage((filters.page ?? 1) - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ECECF3] text-[#475569] hover:bg-[#F8F9FC] disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={filters.page === totalPages}
                onClick={() => goPage((filters.page ?? 1) + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ECECF3] text-[#475569] hover:bg-[#F8F9FC] disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => void load(filters)}
        />
      )}
      {selected && (
        <DetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => void load(filters)}
        />
      )}
    </div>
  );
}