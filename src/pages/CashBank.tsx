import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { authenticatedFetch, getAuthToken } from "../lib/auth";

// ─── Types ────────────────────────────────────────────────

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName?: string | null;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  integrationEnabled: boolean;
  connectionStatus: string;
  status: string;
  createdAt: string;
}

interface AccountForm {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  currency: string;
  openingBalance: string;
}

// ─── Constants ─────────────────────────────────────────────

const KENYAN_BANKS = [
  "Equity Bank", "KCB Bank", "Co-operative Bank", "Absa Bank Kenya",
  "Standard Chartered Bank", "NCBA Bank", "Diamond Trust Bank (DTB)",
  "I&M Bank", "Family Bank", "Stanbic Bank", "Prime Bank", "NIC Bank",
  "HFC Bank", "Gulf African Bank", "Victoria Commercial Bank", "Other",
];

const CURRENCIES = ["KES", "USD", "EUR", "GBP", "UGX", "TZS"];

const INITIAL_FORM: AccountForm = {
  bankName: "", accountName: "", accountNumber: "",
  branchName: "", currency: "KES", openingBalance: "0",
};

// ─── Helpers ───────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 2 });
const formatKES = (v: number) => fmt.format(Number.isFinite(v) ? v : 0);
const formatDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-KE", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const apiErr = (e: unknown, fallback: string) =>
  e instanceof Error && e.message.trim() ? e.message : fallback;

function authHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await authenticatedFetch(path, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data;
}

// ─── Sub-components ────────────────────────────────────────

function SummaryCard({ title, value, sub, icon, accent }: { title: string; value: string; sub?: string; icon: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#666B84]">{title}</p>
          <p className={`mt-1.5 text-2xl font-bold ${accent ?? "text-[#20243A]"}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-[#666B84]">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#20243A]">{icon}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls = s === "ACTIVE"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
    : "border-[#ECECF3] bg-[#F8F9FC] text-[#666B84]";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────

export default function CashBank() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<AccountForm>(INITIAL_FORM);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiFetch("/api/bank-accounts");
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : Array.isArray(data) ? data : []);
    } catch (e) {
      setError(apiErr(e, "Failed to load bank accounts."));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((a) =>
      [a.bankName, a.accountName, a.accountNumber, a.branchName, a.currency, a.status]
        .filter(Boolean).join(" ").toLowerCase().includes(term)
    );
  }, [accounts, search]);

  const summary = useMemo(() => {
    const active = accounts.filter((a) => a.status.toUpperCase() === "ACTIVE");
    const totalBalance = active.reduce((s, a) => s + (Number(a.currentBalance) || 0), 0);
    const totalOpening = active.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
    const movement = totalBalance - totalOpening;
    return { totalBalance, movement, active: active.length, total: accounts.length };
  }, [accounts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...INITIAL_FORM });
    setError("");
    setShowForm(true);
  };

  const openEdit = (account: BankAccount) => {
    setEditing(account);
    setForm({
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      branchName: account.branchName ?? "",
      currency: account.currency,
      openingBalance: String(account.openingBalance),
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
    setForm({ ...INITIAL_FORM });
    setError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!form.bankName) { setError("Bank name is required."); return; }
    if (!form.accountName.trim()) { setError("Account name is required."); return; }
    if (!form.accountNumber.trim()) { setError("Account number is required."); return; }
    const opening = Number(form.openingBalance);
    if (!Number.isFinite(opening) || opening < 0) { setError("Opening balance must be zero or more."); return; }
    const payload = {
      bankName: form.bankName,
      accountName: form.accountName.trim(),
      accountNumber: form.accountNumber.trim(),
      branchName: form.branchName.trim() || undefined,
      currency: form.currency,
      openingBalance: opening,
    };
    try {
      setSaving(true);
      if (editing) {
        const data = await apiFetch(`/api/bank-accounts/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        const updated: BankAccount = data?.account ?? data;
        setAccounts((c) => c.map((a) => a.id === updated.id ? updated : a));
        setSuccess("Account updated successfully.");
      } else {
        const data = await apiFetch("/api/bank-accounts", { method: "POST", body: JSON.stringify(payload) });
        const created: BankAccount = data?.account ?? data;
        setAccounts((c) => [created, ...c]);
        setSuccess("Account added successfully.");
      }
      closeForm();
    } catch (e) {
      setError(apiErr(e, "Failed to save account."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: BankAccount) => {
    if (!window.confirm(`Delete "${account.accountName}" (${account.accountNumber})?\n\nThis cannot be undone.`)) return;
    try {
      setDeletingId(account.id);
      setError("");
      await apiFetch(`/api/bank-accounts/${account.id}`, { method: "DELETE" });
      setAccounts((c) => c.filter((a) => a.id !== account.id));
      setSuccess("Account deleted.");
    } catch (e) {
      setError(apiErr(e, "Failed to delete account."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#666B84]">Cash & Banking</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">Cash & Bank Accounts</h1>
          <p className="mt-2 text-[#666B84]">Manage all organizational bank accounts and track cash balances.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void load()} disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button type="button" onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70]">
            <Plus size={18} /> Add Account
          </button>
        </div>
      </div>

      {/* Notices */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}><X size={17} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess("")}><X size={17} /></button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Cash Balance" value={formatKES(summary.totalBalance)}
          sub={`${summary.active} active accounts`} icon={<Wallet size={20} />} />
        <SummaryCard title="Net Movement"
          value={(summary.movement >= 0 ? "+" : "") + formatKES(summary.movement)}
          sub="vs opening balances"
          icon={summary.movement >= 0 ? <TrendingUp size={20} /> : <TrendingUp size={20} />}
          accent={summary.movement >= 0 ? "text-emerald-600" : "text-red-600"} />
        <SummaryCard title="Active Accounts" value={String(summary.active)}
          sub={`${summary.total} total registered`} icon={<Building2 size={20} />} />
        <SummaryCard title="Currencies" value={String(new Set(accounts.map((a) => a.currency)).size)}
          sub="currency types held" icon={<Banknote size={20} />} />
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex items-center rounded-xl border border-[#ECECF3] px-4 focus-within:border-[#0D9488]">
          <Search size={18} className="shrink-0 text-[#666B84]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by bank, account name, number or currency..."
            className="w-full bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-400" />
          {search && <button type="button" onClick={() => setSearch("")} className="text-[#666B84] hover:text-[#20243A]"><X size={17} /></button>}
        </div>
      </div>

      {/* Accounts list */}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white">
          <div className="text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-[#0D9488]" />
            <p className="mt-3 text-sm text-[#666B84]">Loading accounts...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#ECECF3] bg-white px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC]">
            <Building2 size={26} className="text-[#20243A]" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
            {accounts.length === 0 ? "No bank accounts added" : "No matching accounts"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-[#666B84]">
            {accounts.length === 0 ? "Add your first bank account to start tracking cash balances." : "Try a different search term."}
          </p>
          {accounts.length === 0 && (
            <button type="button" onClick={openCreate}
              className="mt-5 flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0B7A70]">
              <Plus size={18} /> Add First Account
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filtered.map((account) => (
            <div key={account.id}
              className="rounded-2xl border border-[#ECECF3] bg-white p-6 transition hover:border-[#0D9488]/30 hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-teal-50">
                    <Building2 size={26} className="text-[#0D9488]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-[#20243A]">{account.accountName}</h2>
                      <StatusBadge status={account.status} />
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-[#0D9488]">{account.bankName}</p>
                    <p className="font-mono text-sm text-[#666B84]">{account.accountNumber}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => openEdit(account)} disabled={!!deletingId}
                    className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:opacity-40">
                    <Edit3 size={17} />
                  </button>
                  <button type="button" onClick={() => void handleDelete(account)}
                    disabled={deletingId === account.id || !!deletingId}
                    className="rounded-lg p-2 text-[#666B84] hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                    {deletingId === account.id ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#F8F9FC] p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#666B84]">
                    <ArrowUpRight size={14} className="text-emerald-600" /> Current Balance
                  </div>
                  <p className="mt-1.5 text-xl font-bold text-[#20243A]">{formatKES(Number(account.currentBalance))}</p>
                  <p className="mt-0.5 text-xs text-[#666B84]">{account.currency}</p>
                </div>
                <div className="rounded-xl bg-[#F8F9FC] p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#666B84]">
                    <ArrowDownLeft size={14} className="text-[#666B84]" /> Opening Balance
                  </div>
                  <p className="mt-1.5 text-xl font-bold text-[#20243A]">{formatKES(Number(account.openingBalance))}</p>
                  <p className="mt-0.5 text-xs text-[#666B84]">{account.currency}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#ECECF3] pt-4 text-xs text-[#666B84]">
                {account.branchName && <span><span className="font-medium">Branch:</span> {account.branchName}</span>}
                <span>Added {formatDate(account.createdAt)}</span>
                {account.integrationEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[#0D9488]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0D9488]" /> Integration Active
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">{editing ? "Edit Account" : "Add Bank Account"}</h2>
                <p className="mt-1 text-sm text-[#666B84]">{editing ? "Update this bank account record." : "Register a new bank account for your organisation."}</p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Bank Name <span className="text-red-500">*</span></label>
                  <select value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] disabled:opacity-60">
                    <option value="">Select bank...</option>
                    {KENYAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Currency <span className="text-red-500">*</span></label>
                  <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] disabled:opacity-60">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Account Name <span className="text-red-500">*</span></label>
                  <input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                    disabled={saving} placeholder="e.g. Ziya FOS Operations Account"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Account Number <span className="text-red-500">*</span></label>
                  <input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                    disabled={saving} placeholder="e.g. 0123456789"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Branch Name <span className="font-normal text-[#666B84]">(optional)</span></label>
                  <input value={form.branchName} onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))}
                    disabled={saving} placeholder="e.g. Westlands Branch"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">Opening Balance (KES)</label>
                  <input type="number" min="0" step="0.01" value={form.openingBalance}
                    onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                    disabled={saving || !!editing} placeholder="0.00"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] disabled:opacity-60" />
                  {editing && <p className="mt-1 text-xs text-[#666B84]">Opening balance cannot be changed after creation.</p>}
                </div>
              </div>
              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={17} className="shrink-0" />{error}
                </div>
              )}
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#ECECF3] pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} disabled={saving}
                  className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70] disabled:opacity-60">
                  {saving ? <Loader2 size={17} className="animate-spin" /> : editing ? <Edit3 size={17} /> : <Plus size={17} />}
                  {saving ? "Saving..." : editing ? "Save Changes" : "Add Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}