import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  Plus,
  Search,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
} from "../../services/platformSubscriptions";
import type {
  Subscription,
  CreateSubscriptionPayload,
} from "../../services/platformSubscriptions";

/* ─── constants ─────────────────────────────────────────── */

const PLANS    = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];
const CYCLES   = ["MONTHLY", "ANNUAL"];
const STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"];
const PLAN_DEFAULTS: Record<string, number> = {
  STARTER:      15000,
  PROFESSIONAL: 45000,
  ENTERPRISE:   120000,
};

/* ─── helpers ───────────────────────────────────────────── */

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtKES(n: number) {
  return `KES ${n.toLocaleString("en-KE")}`;
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/* ─── status badge ──────────────────────────────────────── */

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:    { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
  TRIAL:     { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  SUSPENDED: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
  EXPIRED:   { bg: "bg-slate-100",  text: "text-slate-500",  dot: "bg-slate-400"  },
  CANCELLED: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
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

/* ─── plan badge ─────────────────────────────────────────── */

const PLAN_CFG: Record<string, string> = {
  STARTER:      "bg-slate-100 text-slate-600",
  PROFESSIONAL: "bg-blue-100 text-blue-700",
  ENTERPRISE:   "bg-purple-100 text-purple-700",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_CFG[plan] ?? "bg-slate-100 text-slate-600"}`}>
      {titleCase(plan)}
    </span>
  );
}

/* ─── form field ─────────────────────────────────────────── */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#475569]">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const SEL = "h-10 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none focus:border-[#D4AF37]";
const INP = "h-10 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none focus:border-[#D4AF37]";

/* ─── create modal ──────────────────────────────────────── */

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateSubscriptionPayload>({
    organizationId: "",
    plan:           "STARTER",
    status:         "TRIAL",
    billingCycle:   "MONTHLY",
    amount:         15000,
    currency:       "KES",
    startDate:      new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function set<K extends keyof CreateSubscriptionPayload>(k: K, v: CreateSubscriptionPayload[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "plan" && typeof v === "string") next.amount = PLAN_DEFAULTS[v] ?? f.amount;
      return next;
    });
  }

  async function save() {
    if (!form.organizationId.trim()) return setError("Organization ID is required.");
    setSaving(true); setError(null);
    try {
      await createSubscription(form);
      onSaved(); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create subscription.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
          <h2 className="text-base font-bold text-[#20243A]">New Subscription</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F8F9FC]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertTriangle size={14} />{error}
            </div>
          )}

          <Field label="Organization ID" required>
            <input
              placeholder="Paste the organization ID"
              value={form.organizationId}
              onChange={(e) => set("organizationId", e.target.value)}
              className={INP}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Plan">
              <select value={form.plan} onChange={(e) => set("plan", e.target.value)} className={SEL}>
                {PLANS.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={SEL}>
                {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </Field>
            <Field label="Billing Cycle">
              <select value={form.billingCycle} onChange={(e) => set("billingCycle", e.target.value)} className={SEL}>
                {CYCLES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </select>
            </Field>
            <Field label="Amount (KES)">
              <input
                type="number"
                value={form.amount}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                className={INP}
              />
            </Field>
            <Field label="Start Date">
              <input
                type="date"
                value={form.startDate ?? ""}
                onChange={(e) => set("startDate", e.target.value)}
                className={INP}
              />
            </Field>
            <Field label="End Date">
              <input
                type="date"
                value={form.endDate ?? ""}
                onChange={(e) => set("endDate", e.target.value)}
                className={INP}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 py-2 text-sm outline-none focus:border-[#D4AF37]"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#F1F5F9] px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#B8962E] disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create Subscription
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── edit modal ─────────────────────────────────────────── */

function EditModal({ sub, onClose, onSaved }: { sub: Subscription; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    plan:         sub.plan,
    status:       sub.status,
    billingCycle: sub.billingCycle,
    amount:       sub.amount,
    endDate:      sub.endDate     ? sub.endDate.slice(0, 10)     : "",
    trialEndsAt:  sub.trialEndsAt ? sub.trialEndsAt.slice(0, 10) : "",
    notes:        sub.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      await updateSubscription(sub.id, {
        plan:         form.plan,
        status:       form.status,
        billingCycle: form.billingCycle,
        amount:       form.amount,
        endDate:      form.endDate     || null,
        trialEndsAt:  form.trialEndsAt || null,
        notes:        form.notes       || null,
      });
      onSaved(); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update subscription.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#20243A]">Edit Subscription</h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">{sub.organization.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F8F9FC]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertTriangle size={14} />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plan">
              <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} className={SEL}>
                {PLANS.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={SEL}>
                {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </Field>
            <Field label="Billing Cycle">
              <select value={form.billingCycle} onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))} className={SEL}>
                {CYCLES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </select>
            </Field>
            <Field label="Amount (KES)">
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                className={INP}
              />
            </Field>
            <Field label="End Date">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className={INP}
              />
            </Field>
            <Field label="Trial Ends">
              <input
                type="date"
                value={form.trialEndsAt}
                onChange={(e) => setForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
                className={INP}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 py-2 text-sm outline-none focus:border-[#D4AF37]"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#F1F5F9] px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#B8962E] disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */

export default function Subscriptions() {
  const [subs,    setSubs]    = useState<Subscription[]>([]);
  const [stats,   setStats]   = useState({ active: 0, trial: 0, expired: 0, monthlyRevenue: 0 });
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [q,      setQ]      = useState("");
  const [status, setStatus] = useState("");
  const [plan,   setPlan]   = useState("");
  const [page,   setPage]   = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState<Subscription | null>(null);
  const [toast,      setToast]      = useState<{ ok: boolean; text: string } | null>(null);

  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getSubscriptions({ q, status, plan, page, limit: LIMIT });
      setSubs(res.subscriptions);
      setStats(res.stats);
      setTotal(res.pagination.total);
    } catch {
      setError("Unable to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [q, status, plan, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, status, plan]);

  function showToast(ok: boolean, text: string) {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Subscription Management"
        subtitle="Manage plans, renewals and recurring revenue across all organizations."
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <CheckCircle size={28} className="text-green-600" />
          <p className="mt-4 text-sm text-[#666B84]">Active</p>
          <h2 className="mt-2 text-4xl font-bold text-green-600">{stats.active}</h2>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <Clock size={28} className="text-yellow-500" />
          <p className="mt-4 text-sm text-[#666B84]">Trial</p>
          <h2 className="mt-2 text-4xl font-bold text-yellow-500">{stats.trial}</h2>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <AlertTriangle size={28} className={stats.expired > 0 ? "text-red-500" : "text-slate-400"} />
          <p className="mt-4 text-sm text-[#666B84]">Expired</p>
          <h2 className={`mt-2 text-4xl font-bold ${stats.expired > 0 ? "text-red-500" : "text-slate-400"}`}>
            {stats.expired}
          </h2>
        </div>
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <TrendingUp size={28} className="text-[#D4AF37]" />
          <p className="mt-4 text-sm text-[#666B84]">Monthly Revenue</p>
          <h2 className="mt-2 text-2xl font-bold text-[#D4AF37]">{fmtKES(stats.monthlyRevenue)}</h2>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by organization..."
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
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B8962E]">
          <Plus size={16} /> New Subscription
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${toast.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {toast.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {toast.text}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="border-b border-[#ECECF3] bg-[#F8F9FC] px-6 py-5">
          <h2 className="text-xl font-bold text-[#20243A]">All Subscriptions</h2>
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
        ) : subs.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <CreditCard size={36} className="text-[#C7CCD9]" />
            <p className="text-sm text-[#666B84]">No subscriptions found.</p>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#D4AF37] hover:underline">
              <Plus size={14} /> Create first subscription
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F8F9FC] text-left text-sm text-[#666B84]">
              <tr>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Billing</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Start</th>
                <th className="px-6 py-4">End</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr key={sub.id} className="group border-t border-[#ECECF3] hover:bg-[#F8F9FC]">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF9C3] text-xs font-bold text-[#B8962E]">
                        {initials(sub.organization.name)}
                      </div>
                      <div>
                        <p className="font-semibold text-[#20243A]">{sub.organization.name}</p>
                        <p className="text-xs text-[#94A3B8]">{sub.organization.country}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5"><PlanBadge plan={sub.plan} /></td>
                  <td className="px-6 py-5 text-sm text-[#666B84]">{titleCase(sub.billingCycle)}</td>
                  <td className="px-6 py-5 text-sm font-semibold text-green-600">{fmtKES(sub.amount)}</td>
                  <td className="px-6 py-5"><StatusBadge status={sub.status} /></td>
                  <td className="px-6 py-5 text-sm text-[#666B84]">{fmtDate(sub.startDate)}</td>
                  <td className="px-6 py-5 text-sm text-[#666B84]">
                    {sub.endDate ? fmtDate(sub.endDate) : <span className="text-[#C7CCD9]">—</span>}
                  </td>
                  <td className="px-6 py-5">
                    <button
                      onClick={() => setEditing(sub)}
                      className="rounded-lg border border-[#ECECF3] px-3 py-1.5 text-xs font-medium text-[#475569] opacity-0 hover:bg-[#F1F5F9] group-hover:opacity-100">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
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

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { showToast(true, "Subscription created."); void load(); }}
        />
      )}
      {editing && (
        <EditModal
          sub={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { showToast(true, "Subscription updated."); void load(); }}
        />
      )}
    </div>
  );
}