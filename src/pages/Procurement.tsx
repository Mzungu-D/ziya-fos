import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { authenticatedFetch, getAuthToken } from "../lib/auth";

interface ProcurementRequest {
  id: string;
  requestCode: string;
  item: string;
  department: string;
  quantity: number;
  estimatedAmount: number;
  status: "PENDING" | "APPROVED" | "ORDERED" | "DELIVERED" | "REJECTED";
  notes?: string | null;
  createdAt: string;
}

interface RequestForm {
  requestCode: string;
  item: string;
  department: string;
  quantity: string;
  estimatedAmount: string;
  notes: string;
}

const DEPARTMENTS = [
  "Technology",
  "Operations",
  "Finance",
  "Human Resources",
  "Marketing",
  "Legal & Compliance",
  "Administration",
  "Other",
];

const INITIAL_FORM: RequestForm = {
  requestCode: "",
  item: "",
  department: "",
  quantity: "1",
  estimatedAmount: "",
  notes: "",
};

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

const statusConfig: Record<
  string,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    classes: "border-amber-500/20 bg-amber-500/10 text-amber-600",
    icon: <Clock3 size={13} />,
  },
  APPROVED: {
    label: "Approved",
    classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    icon: <CheckCircle2 size={13} />,
  },
  ORDERED: {
    label: "Ordered",
    classes: "border-sky-500/20 bg-sky-500/10 text-sky-700",
    icon: <ShoppingCart size={13} />,
  },
  DELIVERED: {
    label: "Delivered",
    classes: "border-slate-300/40 bg-slate-100 text-slate-600",
    icon: <Truck size={13} />,
  },
  REJECTED: {
    label: "Rejected",
    classes: "border-red-500/20 bg-red-500/10 text-red-600",
    icon: <X size={13} />,
  },
};

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#666B84]">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-[#20243A]">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-[#666B84]">{subtitle}</p>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#20243A]">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function Procurement() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RequestForm>(INITIAL_FORM);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = getAuthToken();
      const res = await authenticatedFetch("/api/procurement", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.status === 404) { setRequests([]); return; }
      if (!res.ok) throw new Error(`Failed to load requests (${res.status})`);
      const data = await res.json();
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((r) => {
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      const searchable = [r.requestCode, r.item, r.department, r.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchStatus && (!term || searchable.includes(term));
    });
  }, [requests, search, statusFilter]);

  const summary = useMemo(() => ({
    total: requests.reduce((s, r) => s + (Number(r.estimatedAmount) || 0), 0),
    pending: requests.filter((r) => r.status === "PENDING").length,
    approved: requests.filter((r) => r.status === "APPROVED").length,
    ordered: requests.filter((r) => r.status === "ORDERED").length,
  }), [requests]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSuccessMessage("");
    const quantity = Number(form.quantity);
    const amount = Number(form.estimatedAmount);
    if (!form.requestCode.trim()) { setError("Request code is required."); return; }
    if (!form.item.trim()) { setError("Item / description is required."); return; }
    if (!form.department) { setError("Please select a department."); return; }
    if (!Number.isInteger(quantity) || quantity < 1) { setError("Quantity must be at least 1."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError("Estimated amount must be greater than zero."); return; }
    try {
      setSaving(true);
      const token = getAuthToken();
      const res = await authenticatedFetch("/api/procurement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestCode: form.requestCode.trim(),
          item: form.item.trim(),
          department: form.department,
          quantity,
          estimatedAmount: amount,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? `Failed to create request (${res.status})`);
      if (data?.request) setRequests((current) => [data.request, ...current]);
      setForm(INITIAL_FORM);
      setShowForm(false);
      setSuccessMessage("Procurement request submitted successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit procurement request."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#666B84]">Business Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">Procurement</h1>
          <p className="mt-2 text-[#666B84]">Manage purchase requests, approvals, and procurement workflows.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadRequests()} disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button type="button" onClick={() => { setError(""); setSuccessMessage(""); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d3349]">
            <Plus size={18} /> New Request
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}><X size={17} /></button>
        </div>
      )}
      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage("")}><X size={17} /></button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Value" value={formatCurrency(summary.total)} subtitle="Estimated procurement value" icon={<Package size={20} />} />
        <SummaryCard title="Pending" value={summary.pending} subtitle="Awaiting approval" icon={<Clock3 size={20} />} />
        <SummaryCard title="Approved" value={summary.approved} subtitle="Ready to order" icon={<CheckCircle2 size={20} />} />
        <SummaryCard title="Ordered" value={summary.ordered} subtitle="Orders in progress" icon={<Truck size={20} />} />
      </div>

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-[#ECECF3] px-4 focus-within:border-[#20243A]">
            <Search size={18} className="shrink-0 text-[#666B84]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, item or department..."
              className="w-full bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-400" />
            {search && <button type="button" onClick={() => setSearch("")} className="text-[#666B84] hover:text-[#20243A]"><X size={17} /></button>}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-[#666B84]" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#ECECF3] bg-white px-3 py-3 text-sm text-[#666B84] outline-none">
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="ORDERED">Ordered</option>
              <option value="DELIVERED">Delivered</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ECECF3] bg-white overflow-hidden">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <div className="text-center">
              <Loader2 size={28} className="mx-auto animate-spin text-[#20243A]" />
              <p className="mt-3 text-sm text-[#666B84]">Loading requests...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC]">
              <ShoppingCart size={26} className="text-[#20243A]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
              {requests.length === 0 ? "No procurement requests" : "No matching requests"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-[#666B84]">
              {requests.length === 0 ? "Submit your first procurement request to start tracking purchases." : "Try a different search term or filter."}
            </p>
            {requests.length === 0 && (
              <button type="button" onClick={() => setShowForm(true)}
                className="mt-5 flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2d3349]">
                <Plus size={18} /> Submit First Request
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECECF3] bg-[#F8F9FC]">
                  <th className="p-4 text-left font-semibold text-[#20243A]">Request Code</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Item</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Department</th>
                  <th className="p-4 text-center font-semibold text-[#20243A]">Qty</th>
                  <th className="p-4 text-right font-semibold text-[#20243A]">Est. Amount</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Date</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cfg = statusConfig[r.status] ?? statusConfig.PENDING;
                  return (
                    <tr key={r.id} className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]">
                      <td className="p-4 font-mono text-sm font-semibold text-[#20243A]">{r.requestCode}</td>
                      <td className="p-4 text-[#20243A]">{r.item}</td>
                      <td className="p-4 text-[#666B84]">{r.department}</td>
                      <td className="p-4 text-center text-[#20243A]">{r.quantity}</td>
                      <td className="p-4 text-right font-semibold text-[#20243A]">{formatCurrency(Number(r.estimatedAmount))}</td>
                      <td className="p-4 text-[#666B84]">{formatDate(r.createdAt)}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.classes}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">New Procurement Request</h2>
                <p className="mt-1 text-sm text-[#666B84]">Submit a purchase request for departmental approval.</p>
              </div>
              <button type="button" onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setError(""); }} disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:opacity-50">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Request Code <span className="text-red-500">*</span></label>
                  <input value={form.requestCode} onChange={(e) => setForm((f) => ({ ...f, requestCode: e.target.value }))}
                    disabled={saving} placeholder="e.g. PR-2026-001"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Department <span className="text-red-500">*</span></label>
                  <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60">
                    <option value="">Select department...</option>
                    {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Item / Description <span className="text-red-500">*</span></label>
                  <input value={form.item} onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
                    disabled={saving} placeholder="e.g. Office Laptops — Dell XPS 15"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min="1" step="1" value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Estimated Amount (KES) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.01" value={form.estimatedAmount}
                    onChange={(e) => setForm((f) => ({ ...f, estimatedAmount: e.target.value }))} disabled={saving} placeholder="0.00"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Notes <span className="text-[#666B84] font-normal">(optional)</span></label>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    disabled={saving} placeholder="Justification, specifications or any other details..."
                    className="w-full resize-none rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
              </div>
              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={17} className="shrink-0" />{error}
                </div>
              )}
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#ECECF3] pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setError(""); }} disabled={saving}
                  className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2d3349] disabled:opacity-60">
                  {saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
                  {saving ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}