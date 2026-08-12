import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";

import {
  createExpense,
  fetchExpenses,
} from "../services/expenses";
import type { Expense } from "../services/expenses";

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
}

interface ExpenseForm {
  expenseCode: string;
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  vendorId: string;
}

const CATEGORIES = [
  "Office Rent",
  "Internet & Utilities",
  "Fuel & Transport",
  "Office Supplies",
  "Salaries & Wages",
  "Professional Services",
  "Marketing & Advertising",
  "Equipment & Maintenance",
  "Travel & Accommodation",
  "Other",
];

const INITIAL_FORM: ExpenseForm = {
  expenseCode: "",
  category: "",
  description: "",
  amount: "",
  expenseDate: "",
  vendorId: "",
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

const statusClasses = (status: string) => {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
    case "PENDING":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600";
    case "REJECTED":
      return "border-red-500/20 bg-red-500/10 text-red-600";
    default:
      return "border-[#ECECF3] bg-[#F8F9FC] text-[#666B84]";
  }
};

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#666B84]">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-[#20243A]">{value}</p>
          <p className="mt-1 text-xs text-[#666B84]">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#20243A]">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(INITIAL_FORM);

  const loadExpenses = useCallback(async () => {
    try {
      setError("");
      const response = await fetchExpenses();
      setExpenses(Array.isArray(response.expenses) ? response.expenses : []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load expenses."));
    }
  }, []);

  const loadVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/vendors", {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const list: Vendor[] = (data?.vendors ?? []).filter(
          (v: Vendor & { status?: string }) =>
            !v.status || v.status.toUpperCase() === "ACTIVE"
        );
        setVendors(list);
      }
    } catch {
      // vendors optional
    }
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadExpenses(), loadVendors()]);
    setLoading(false);
  }, [loadExpenses, loadVendors]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const categories = useMemo(
    () => [...new Set(expenses.map((e) => e.category).filter(Boolean))],
    [expenses]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchStatus =
        statusFilter === "ALL" ||
        expense.status.toUpperCase() === statusFilter;
      const matchCategory =
        categoryFilter === "ALL" || expense.category === categoryFilter;
      const searchable = [
        expense.expenseCode,
        expense.category,
        expense.description,
        expense.vendor?.name,
        expense.vendor?.vendorCode,
        expense.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchStatus && matchCategory && (!term || searchable.includes(term));
    });
  }, [expenses, search, statusFilter, categoryFilter]);

  const summary = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      total,
      approved: expenses.filter((e) => e.status.toUpperCase() === "APPROVED").length,
      pending: expenses.filter((e) => e.status.toUpperCase() === "PENDING").length,
    };
  }, [expenses]);

  const handleExport = () => {
    const headers = ["Expense Code", "Category", "Description", "Vendor", "Amount (KES)", "Date", "Status"];
    const rows = filtered.map((e) => [
      e.expenseCode, e.category, e.description ?? "",
      e.vendor?.name ?? "", Number(e.amount).toFixed(2),
      formatDate(e.expenseDate), e.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSuccessMessage("");
    const amount = Number(form.amount);
    if (!form.expenseCode.trim()) { setError("Expense code is required."); return; }
    if (!form.category) { setError("Please select a category."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError("Amount must be greater than zero."); return; }
    if (!form.expenseDate) { setError("Expense date is required."); return; }
    try {
      setSaving(true);
      const response = await createExpense({
        expenseCode: form.expenseCode.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        amount,
        expenseDate: form.expenseDate,
        vendorId: form.vendorId || undefined,
      });
      setExpenses((current) => [response.expense, ...current]);
      setForm(INITIAL_FORM);
      setShowForm(false);
      setSuccessMessage("Expense recorded successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to record expense."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#666B84]">Business Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">Expenses</h1>
          <p className="mt-2 text-[#666B84]">Track and manage operational expenses across the organization.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleExport} disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
            <Download size={17} /> Export CSV
          </button>
          <button type="button" disabled={loading} onClick={() => void loadPage()}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button type="button" onClick={() => { setError(""); setSuccessMessage(""); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d3349]">
            <Plus size={18} /> New Expense
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
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage("")}><X size={17} /></button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Total Expenses" value={formatCurrency(summary.total)} subtitle={`${expenses.length} expense records`} icon={<FileText size={20} />} />
        <SummaryCard title="Approved" value={String(summary.approved)} subtitle="Approved expense records" icon={<CheckCircle2 size={20} />} />
        <SummaryCard title="Pending Review" value={String(summary.pending)} subtitle="Awaiting approval" icon={<Wallet size={20} />} />
      </div>

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-[#ECECF3] px-4 focus-within:border-[#20243A]">
            <Search size={18} className="shrink-0 text-[#666B84]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, category, vendor or description..."
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
              <option value="REJECTED">Rejected</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[#ECECF3] bg-white px-3 py-3 text-sm text-[#666B84] outline-none">
              <option value="ALL">All Categories</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ECECF3] bg-white overflow-hidden">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <div className="text-center">
              <Loader2 size={28} className="mx-auto animate-spin text-[#20243A]" />
              <p className="mt-3 text-sm text-[#666B84]">Loading expenses...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC]">
              <FileText size={26} className="text-[#20243A]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
              {expenses.length === 0 ? "No expenses recorded" : "No matching expenses"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-[#666B84]">
              {expenses.length === 0 ? "Record your first expense to start tracking operational costs." : "Try a different search term or filter."}
            </p>
            {expenses.length === 0 && (
              <button type="button" onClick={() => setShowForm(true)}
                className="mt-5 flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2d3349]">
                <Plus size={18} /> Record First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECECF3] bg-[#F8F9FC]">
                  <th className="p-4 text-left font-semibold text-[#20243A]">Expense Code</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Category</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Vendor</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Description</th>
                  <th className="p-4 text-right font-semibold text-[#20243A]">Amount</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Date</th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id} className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]">
                    <td className="p-4 font-mono text-sm font-semibold text-[#20243A]">{expense.expenseCode}</td>
                    <td className="p-4 text-[#20243A]">{expense.category}</td>
                    <td className="p-4 text-[#666B84]">{expense.vendor?.name ?? "—"}</td>
                    <td className="p-4 text-[#666B84]">{expense.description || "—"}</td>
                    <td className="p-4 text-right font-semibold text-[#20243A]">{formatCurrency(Number(expense.amount))}</td>
                    <td className="p-4 text-[#666B84]">{formatDate(expense.expenseDate)}</td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(expense.status)}`}>
                        {expense.status.charAt(0).toUpperCase() + expense.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
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
                <h2 className="text-xl font-bold text-[#20243A]">Record New Expense</h2>
                <p className="mt-1 text-sm text-[#666B84]">Add an operational expense to the organization records.</p>
              </div>
              <button type="button" onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setError(""); }} disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:opacity-50">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Expense Code <span className="text-red-500">*</span></label>
                  <input value={form.expenseCode} onChange={(e) => setForm((f) => ({ ...f, expenseCode: e.target.value }))}
                    disabled={saving} placeholder="e.g. EXP-2026-001"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Category <span className="text-red-500">*</span></label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60">
                    <option value="">Select category...</option>
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Amount (KES) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.01" value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} disabled={saving} placeholder="0.00"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Expense Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Vendor <span className="text-[#666B84] font-normal">(optional)</span></label>
                  <select value={form.vendorId} onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))} disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60">
                    <option value="">No vendor</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.vendorCode})</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Description <span className="text-[#666B84] font-normal">(optional)</span></label>
                  <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    disabled={saving} placeholder="Brief description of this expense..."
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
                  {saving ? "Saving..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}