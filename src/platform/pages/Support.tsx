import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle, ChevronLeft, ChevronRight,
  Clock, Copy, Loader2, MessageSquare, Plus, RefreshCw,
  Search, Ticket, X, XCircle,
} from "lucide-react";

import PageHeader    from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

import {
  getSupportStats, getTickets, createTicket, updateTicket,
} from "../../services/platformSupport";
import type { SupportStats, SupportTicket, TicketFilters } from "../../services/platformSupport";
import { getOrganizations } from "../../services/platformOrganizations";

/* ─── constants ──────────────────────────────────────────── */

const STATUSES   = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]          as const;
const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT"] as const;

type Status   = typeof STATUSES[number];
type Priority = typeof PRIORITIES[number];

/* ─── helpers ────────────────────────────────────────────── */

function statusCfg(s: string) {
  return s === "OPEN"        ? { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300", label: "Open"        }
       : s === "IN_PROGRESS" ? { bg: "bg-blue-100",   text: "text-blue-700",   ring: "ring-blue-300",   label: "In Progress" }
       : s === "RESOLVED"    ? { bg: "bg-green-100",  text: "text-green-700",  ring: "ring-green-300",  label: "Resolved"    }
       :                       { bg: "bg-slate-100",  text: "text-slate-600",  ring: "ring-slate-300",  label: "Closed"      };
}

function priorityCfg(p: string) {
  return p === "CRITICAL" ? { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "Critical" }
       : p === "HIGH"     ? { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500", label: "High"     }
       : p === "MEDIUM"   ? { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500", label: "Medium"   }
       :                    { bg: "bg-slate-100",  text: "text-slate-500",  dot: "bg-slate-400",  label: "Low"      };
}

function Pill({ s, type = "status" }: { s: string; type?: "status" | "priority" }) {
  const cfg = type === "status" ? statusCfg(s) : priorityCfg(s);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {type === "priority" && (
        <span className={`h-1.5 w-1.5 rounded-full ${(cfg as ReturnType<typeof priorityCfg>).dot}`} />
      )}
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
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

function isOverdue(t: SupportTicket) {
  if (t.status === "RESOLVED" || t.status === "CLOSED") return false;
  const ageHrs = (Date.now() - new Date(t.createdAt).getTime()) / 3_600_000;
  if (t.priority === "CRITICAL") return ageHrs > 4;
  if (t.priority === "HIGH")     return ageHrs > 24;
  return false;
}

function nextStatuses(current: string): Status[] {
  if (current === "OPEN")        return ["IN_PROGRESS"];
  if (current === "IN_PROGRESS") return ["RESOLVED", "CLOSED"];
  if (current === "RESOLVED")    return ["CLOSED"];
  return [];
}

/* ─── error banner ───────────────────────────────────────── */

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <XCircle size={16} className="shrink-0" />
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss}><X size={14} /></button>
    </div>
  );
}

/* ─── create modal ───────────────────────────────────────── */

interface Org { id: string; name: string }

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [orgs,    setOrgs]    = useState<Org[]>([]);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const submitting             = useRef(false);
  const [form, setForm] = useState({
    organizationId: "",
    subject:        "",
    description:    "",
    priority:       "MEDIUM" as Priority,
    category:       "GENERAL",
  });

  useEffect(() => {
    getOrganizations()
      .then((r) => setOrgs(r.organizations ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!form.organizationId || !form.subject || !form.description) return;
    submitting.current = true;
    setLoading(true);
    setError("");
    try {
      await createTicket(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[560px] rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#20243A]">New Support Ticket</h2>
            <p className="mt-0.5 text-sm text-[#94A3B8]">Log an issue on behalf of an organisation.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F8F9FC] hover:text-[#475569]">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4"><ErrorBanner msg={error} onDismiss={() => setError("")} /></div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Organisation *</label>
            <select
              required
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#20243A] outline-none focus:border-[#D4AF37]"
            >
              <option value="">Select organisation…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Subject *</label>
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief description of the issue"
              className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Description *</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Full details of the request or issue…"
              className="w-full resize-none rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none focus:border-[#D4AF37]"
              >
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#475569]">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none focus:border-[#D4AF37]"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8F9FC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5A4BE8] disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── status stepper ─────────────────────────────────────── */

const STATUS_STEPS: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function StatusStepper({ current }: { current: string }) {
  const currentIdx = STATUS_STEPS.indexOf(current as Status);
  return (
    <div className="flex items-center">
      {STATUS_STEPS.map((step, idx) => {
        const done   = idx < currentIdx;
        const active = idx === currentIdx;
        const cfg    = statusCfg(step);
        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold
                ${active ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}` : ""}
                ${done   ? "bg-green-50 text-green-700" : ""}
                ${!active && !done ? "text-[#CBD5E1]" : ""}`}
            >
              {done && <CheckCircle size={11} />}
              {cfg.label}
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <ArrowRight size={12} className="mx-1 text-[#E2E8F0]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── ticket drawer ──────────────────────────────────────── */

function TicketDrawer({
  ticket, onClose, onUpdated,
}: {
  ticket:    SupportTicket;
  onClose:   () => void;
  onUpdated: (updated: SupportTicket) => void;
}) {
  const [priority,   setPriority]   = useState(ticket.priority);
  const [adminNotes, setAdminNotes] = useState(ticket.adminNotes ?? "");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [copied,     setCopied]     = useState(false);
  const notesTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nexts                       = nextStatuses(ticket.status);
  const overdue                     = isOverdue(ticket);

  async function transition(newStatus: Status) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await updateTicket(ticket.id, { status: newStatus });
      onUpdated(r.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally { setSaving(false); }
  }

  async function savePriority(p: string) {
    setSaving(true);
    setError("");
    try {
      const r = await updateTicket(ticket.id, { priority: p });
      onUpdated(r.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update priority.");
    } finally { setSaving(false); }
  }

  async function saveNotes() {
    if (adminNotes === (ticket.adminNotes ?? "")) return;
    setSaving(true);
    setError("");
    try {
      const r = await updateTicket(ticket.id, { adminNotes });
      onUpdated(r.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes.");
    } finally { setSaving(false); }
  }

  function queueNoteSave() {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => void saveNotes(), 1200);
  }

  function copyNumber() {
    navigator.clipboard.writeText(ticket.ticketNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const actionConfig: Record<Status, { label: string; style: string }> = {
    OPEN:        { label: "Re-open",         style: "border-orange-200 text-orange-700 hover:bg-orange-50"           },
    IN_PROGRESS: { label: "Start Working →", style: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"     },
    RESOLVED:    { label: "Mark Resolved ✓", style: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100" },
    CLOSED:      { label: "Close Ticket",    style: "border-slate-200 text-slate-600 hover:bg-slate-50"              },
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative flex h-full w-full max-w-[600px] flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-[#F1F5F9] px-7 py-5">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copyNumber}
                className="flex items-center gap-1.5 rounded-lg bg-[#F8F9FC] px-2.5 py-1 font-mono text-xs font-semibold text-[#475569] hover:bg-[#ECECF3]"
              >
                {ticket.ticketNumber}
                {copied ? <CheckCircle size={11} className="text-green-600" /> : <Copy size={11} />}
              </button>
              <span className="text-xs capitalize text-[#94A3B8]">{ticket.category.toLowerCase()}</span>
              {overdue && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  <AlertTriangle size={10} /> Overdue
                </span>
              )}
            </div>
            <h2 className="mt-2 text-base font-bold leading-snug text-[#20243A]">{ticket.subject}</h2>
            <p className="mt-0.5 text-sm text-[#666B84]">{ticket.organization.name}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F8F9FC] hover:text-[#475569]"
          >
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-7 py-6">
          {error && <ErrorBanner msg={error} onDismiss={() => setError("")} />}

          {/* status stepper */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Status</p>
            <StatusStepper current={ticket.status} />
          </div>

          {/* action buttons */}
          {nexts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nexts.map((next) => (
                <button
                  key={next}
                  disabled={saving}
                  onClick={() => void transition(next)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${actionConfig[next].style}`}
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {actionConfig[next].label}
                </button>
              ))}
            </div>
          )}

          {ticket.status === "CLOSED" && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <CheckCircle size={14} className="text-slate-400" />
              This ticket is closed. No further actions available.
            </div>
          )}

          {/* description */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Description</p>
            <div className="rounded-xl bg-[#F8F9FC] px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#20243A]">{ticket.description}</p>
            </div>
          </div>

          {/* priority */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Priority</p>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => {
                const c   = priorityCfg(p);
                const sel = p === priority;
                return (
                  <button
                    key={p}
                    disabled={saving || ticket.status === "CLOSED"}
                    onClick={() => { setPriority(p); void savePriority(p); }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed
                      ${sel ? `${c.bg} ${c.text} ring-1 ring-offset-0 ring-current` : "border border-[#ECECF3] text-[#94A3B8] hover:border-[#D4AF37]"}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* internal notes */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              Internal Notes
              <span className="ml-1.5 font-normal normal-case text-[#94A3B8]">
                — auto-saved · not visible to organisation
              </span>
            </p>
            <textarea
              rows={4}
              value={adminNotes}
              disabled={ticket.status === "CLOSED"}
              onChange={(e) => { setAdminNotes(e.target.value); queueNoteSave(); }}
              placeholder="Add internal notes, investigation steps, workarounds…"
              className="w-full resize-none rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3 text-sm leading-relaxed text-[#20243A] outline-none focus:border-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-60"
            />
            {saving && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-[#94A3B8]">
                <Loader2 size={11} className="animate-spin" /> Saving…
              </p>
            )}
          </div>

          {/* timestamps */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Created",  value: fmtDateTime(ticket.createdAt)                         },
              { label: "Updated",  value: fmtDateTime(ticket.updatedAt)                         },
              { label: "Resolved", value: ticket.resolvedAt ? fmtDate(ticket.resolvedAt) : "—" },
              { label: "Closed",   value: ticket.closedAt   ? fmtDate(ticket.closedAt)   : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-[#ECECF3] px-4 py-3">
                <p className="text-xs text-[#94A3B8]">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-[#20243A]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────── */

export default function Support() {
  const [stats,       setStats]       = useState<SupportStats | null>(null);
  const [tickets,     setTickets]     = useState<SupportTicket[]>([]);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [selected,    setSelected]    = useState<SupportTicket | null>(null);
  const [quickSaving, setQuickSaving] = useState<string | null>(null);

  const [filters, setFilters] = useState<TicketFilters>({
    page: 1, pageSize: 15, search: "", status: "", priority: "", category: "",
  });

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(f: TicketFilters = filters) {
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.all([getSupportStats(), getTickets(f)]);
      setStats(sRes.stats);
      setTickets(tRes.tickets);
      setTotal(tRes.pagination.total);
      setTotalPages(tRes.pagination.totalPages);
    } catch { /* keep existing data */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function updateFilter(patch: Partial<TicketFilters>) {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void load(next), 280);
  }

  function goPage(p: number) {
    const next = { ...filters, page: p };
    setFilters(next);
    void load(next);
  }

  async function quickTransition(t: SupportTicket, newStatus: Status) {
    setQuickSaving(t.id);
    try {
      const r = await updateTicket(t.id, { status: newStatus });
      setTickets((prev) => prev.map((x) => x.id === t.id ? r.ticket : x));
      if (selected?.id === t.id) setSelected(r.ticket);
      void getSupportStats().then((s) => setStats(s.stats)).catch(() => {});
    } catch { /* user can retry */ }
    finally { setQuickSaving(null); }
  }

  function handleDrawerUpdated(updated: SupportTicket) {
    setSelected(updated);
    setTickets((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    void getSupportStats().then((s) => setStats(s.stats)).catch(() => {});
  }

  const activeFilters = [filters.status, filters.priority, filters.category].filter(Boolean).length;

  const kpis = stats ? [
    { icon: <Ticket        size={24} className="text-[#D4AF37]"   />, label: "Open Tickets",   value: stats.openCount,             sub: stats.criticalCount > 0 ? `${stats.criticalCount} critical` : "no critical issues", color: "text-[#20243A]"  },
    { icon: <Clock         size={24} className="text-blue-600"    />, label: "In Progress",     value: stats.inProgressCount,       sub: "actively being worked",                                                             color: "text-blue-600"   },
    { icon: <CheckCircle   size={24} className="text-green-600"   />, label: "Resolved Today",  value: stats.resolvedToday,         sub: `${stats.totalClosed} total closed`,                                                 color: "text-green-600"  },
    { icon: <MessageSquare size={24} className="text-purple-600"  />, label: "Avg Resolution",  value: `${stats.avgResolutionHrs}h`, sub: "mean time to resolve",                                                            color: "text-purple-600" },
  ] : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Support Center"
        subtitle="Manage customer support requests, incidents, and platform assistance."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-5">
        {loading && !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#F1F5F9]" />
            ))
          : kpis.map((k, i) => (
              <div key={i} className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
                {k.icon}
                <p className="mt-4 text-sm text-[#666B84]">{k.label}</p>
                <p className={`mt-1 text-3xl font-bold ${k.color}`}>{k.value}</p>
                <p className="mt-1 text-xs text-[#94A3B8]">{k.sub}</p>
              </div>
            ))}
      </div>

      {/* breakdown chips */}
      {stats && (stats.priorityBreakdown.length > 0 || stats.categoryBreakdown.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.priorityBreakdown.map((p) => {
            const cfg    = priorityCfg(p.priority);
            const active = filters.priority === p.priority;
            return (
              <button
                key={p.priority}
                onClick={() => updateFilter({ priority: active ? "" : p.priority })}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors
                  ${active ? `${cfg.bg} ${cfg.text} border-transparent` : "border-[#ECECF3] bg-white text-[#475569] hover:border-[#D4AF37]"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {p.priority.charAt(0) + p.priority.slice(1).toLowerCase()} · {p.count}
              </button>
            );
          })}
          {stats.priorityBreakdown.length > 0 && stats.categoryBreakdown.length > 0 && (
            <span className="self-center text-[#E2E8F0]">|</span>
          )}
          {stats.categoryBreakdown.map((c) => {
            const active = filters.category === c.category;
            return (
              <button
                key={c.category}
                onClick={() => updateFilter({ category: active ? "" : c.category })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors
                  ${active ? "border-[#20243A] bg-[#0D9488]/10 text-[#20243A]" : "border-[#ECECF3] bg-white text-[#475569] hover:border-[#20243A]"}`}
              >
                {c.category.charAt(0) + c.category.slice(1).toLowerCase()} · {c.count}
              </button>
            );
          })}
        </div>
      )}

      {/* toolbar */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-sm">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            defaultValue={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
            placeholder="Search tickets or organisations…"
            className="h-10 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-10 pr-4 text-sm outline-none focus:border-[#D4AF37]"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => updateFilter({ status: e.target.value })}
          className="h-10 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#475569] outline-none focus:border-[#D4AF37]"
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

        <button
          onClick={() => void load(filters)}
          className="ml-auto rounded-xl border border-[#ECECF3] p-2.5 text-[#94A3B8] hover:bg-[#F8F9FC] hover:text-[#475569]"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>

        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={15} />
          <span className="ml-1.5">New Ticket</span>
        </PrimaryButton>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
          <p className="text-sm font-semibold text-[#20243A]">
            {loading ? "Loading…" : `${total.toLocaleString()} ticket${total !== 1 ? "s" : ""}`}
          </p>
          <p className="text-xs text-[#94A3B8]">Click a row to open · use buttons for quick actions</p>
        </div>

        {loading ? (
          <div className="flex h-52 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[#D4AF37]" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3">
            <Ticket size={36} className="text-[#ECECF3]" />
            <p className="text-sm font-medium text-[#94A3B8]">No tickets match your filters</p>
            {activeFilters > 0 && (
              <button
                onClick={() => updateFilter({ status: "", priority: "", category: "", search: "" })}
                className="text-xs font-semibold text-[#20243A] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#FAFAFA] text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                <th className="w-28 px-6 py-3">Ticket #</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Subject</th>
                <th className="w-24 px-4 py-3">Category</th>
                <th className="w-24 px-4 py-3">Priority</th>
                <th className="w-28 px-4 py-3">Status</th>
                <th className="w-20 px-4 py-3">Age</th>
                <th className="w-36 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const nexts       = nextStatuses(t.status);
                const primaryNext = nexts[0];
                const secondNext  = nexts[1];
                const isSaving    = quickSaving === t.id;
                const over        = isOverdue(t);
                const actionLabels: Partial<Record<Status, string>> = {
                  IN_PROGRESS: "Start",
                  RESOLVED:    "Resolve",
                  CLOSED:      "Close",
                };
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="cursor-pointer border-b border-[#F8F9FC] transition-colors hover:bg-[#FAFAFE] last:border-0"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-[#475569]">{t.ticketNumber}</span>
                        {over && <AlertTriangle size={11} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="max-w-[140px] px-4 py-4">
                      <span className="block truncate text-sm font-medium text-[#20243A]">{t.organization.name}</span>
                    </td>
                    <td className="max-w-[200px] px-4 py-4">
                      <span className="block truncate text-sm text-[#475569]">{t.subject}</span>
                    </td>
                    <td className="px-4 py-4 text-xs capitalize text-[#475569]">{t.category.toLowerCase()}</td>
                    <td className="px-4 py-4"><Pill s={t.priority} type="priority" /></td>
                    <td className="px-4 py-4"><Pill s={t.status}   type="status"   /></td>
                    <td className="px-4 py-4 text-sm text-[#94A3B8]">{fmtAgo(t.createdAt)}</td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {nexts.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {primaryNext && (
                            <button
                              disabled={isSaving}
                              onClick={() => void quickTransition(t, primaryNext)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50
                                ${primaryNext === "IN_PROGRESS" ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : primaryNext === "RESOLVED"    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                :                                 "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                            >
                              {isSaving ? <Loader2 size={11} className="animate-spin" /> : (actionLabels[primaryNext] ?? primaryNext)}
                            </button>
                          )}
                          {secondNext && (
                            <button
                              disabled={isSaving}
                              onClick={() => void quickTransition(t, secondNext)}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {actionLabels[secondNext] ?? secondNext}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#F1F5F9] px-6 py-4">
            <p className="text-xs text-[#94A3B8]">Page {filters.page} of {totalPages} · {total} results</p>
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
        <TicketDrawer
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleDrawerUpdated}
        />
      )}
    </div>
  );
}

