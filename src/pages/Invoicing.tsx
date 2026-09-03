import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  Eye,
  FileText,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  description: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  dueDate: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

const fmt = (n: unknown) => {
  const num = Number(n ?? 0);
  return isNaN(num)
    ? "0.00"
    : num.toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
};

const isOverdue = (inv: Invoice) =>
  inv.paymentStatus !== "PAID" && new Date(inv.dueDate) < new Date();

const statusBadge = (inv: Invoice) => {
  if (inv.paymentStatus === "PAID")
    return (
      <span className="rounded-full bg-[#16A34A]/10 px-2.5 py-1 text-xs font-semibold text-[#16A34A]">
        Paid
      </span>
    );
  if (isOverdue(inv))
    return (
      <span className="rounded-full bg-[#EF4444]/10 px-2.5 py-1 text-xs font-semibold text-[#EF4444]">
        Overdue
      </span>
    );
  return (
    <span className="rounded-full bg-[#F59E0B]/10 px-2.5 py-1 text-xs font-semibold text-[#F59E0B]">
      Unpaid
    </span>
  );
};

/* ─────────────────────────────────────────────
   MODAL SHELL
───────────────────────────────────────────── */

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <div
        className={`my-4 w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-4">
          <h3 className="text-lg font-bold text-[#20243A]">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#666B84] transition hover:bg-[#F8F9FC]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3.5 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 transition";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   INVOICE DETAIL VIEW
───────────────────────────────────────────── */

function InvoiceDetail({
  invoice,
  onBack,
}: {
  invoice: Invoice;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#666B84] transition hover:bg-[#ECECF3]"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#20243A]">
              {invoice.invoiceNumber}
            </h2>
            <p className="text-sm text-[#666B84]">
              Issued {fmtDate(invoice.issueDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge(invoice)}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] px-4 py-2 text-sm text-[#20243A] transition hover:bg-[#F8F9FC]"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6 p-6">
        {/* Customer */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#666B84]">
              Bill To
            </p>
            <p className="mt-1 font-bold text-[#20243A]">
              {invoice.customerName}
            </p>
            {invoice.customerEmail && (
              <p className="text-sm text-[#666B84]">{invoice.customerEmail}</p>
            )}
            {invoice.customerPhone && (
              <p className="text-sm text-[#666B84]">{invoice.customerPhone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#666B84]">
              Due Date
            </p>
            <p
              className={`mt-1 font-bold ${isOverdue(invoice) ? "text-[#EF4444]" : "text-[#20243A]"}`}
            >
              {fmtDate(invoice.dueDate)}
            </p>
          </div>
        </div>

        {/* Description */}
        {invoice.description && (
          <div className="rounded-xl bg-[#F8F9FC] p-4 text-sm text-[#666B84]">
            {invoice.description}
          </div>
        )}

        {/* Amounts */}
        <div className="overflow-hidden rounded-xl border border-[#ECECF3]">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FC]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[#666B84]">
                  Item
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#666B84]">
                  Amount (KES)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#ECECF3]">
                <td className="px-4 py-3 text-[#20243A]">Subtotal</td>
                <td className="px-4 py-3 text-right font-mono text-[#20243A]">
                  {fmt(invoice.subtotal)}
                </td>
              </tr>
              <tr className="border-t border-[#ECECF3]">
                <td className="px-4 py-3 text-[#20243A]">Tax</td>
                <td className="px-4 py-3 text-right font-mono text-[#20243A]">
                  {fmt(invoice.taxAmount)}
                </td>
              </tr>
              <tr className="border-t-2 border-[#20243A] bg-[#F8F9FC]">
                <td className="px-4 py-3 font-bold text-[#20243A]">
                  Total Amount
                </td>
                <td className="px-4 py-3 text-right font-mono text-xl font-bold text-[#20243A]">
                  {fmt(invoice.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */

export default function Invoicing() {
  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [detail,     setDetail]     = useState<Invoice | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");

  /* form state */
  const [customerName,  setCustomerName]  = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [description,   setDescription]   = useState("");
  const [subtotal,      setSubtotal]      = useState("");
  const [taxRate,       setTaxRate]       = useState("16");
  const [issueDate,     setIssueDate]     = useState("");
  const [dueDate,       setDueDate]       = useState("");

  const taxAmount   = (Number(subtotal) || 0) * (Number(taxRate) || 0) / 100;
  const totalAmount = (Number(subtotal) || 0) + taxAmount;

  /* ── fetch ── */
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError("");
      const res  = await authenticatedFetch("/api/invoices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load invoices");
      setInvoices(data.invoices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  /* ── open detail ── */
  const openDetail = async (inv: Invoice) => {
    try {
      const res  = await authenticatedFetch(`/api/invoices/${inv.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDetail(data.invoice);
    } catch {
      setDetail(inv);
    }
  };

  /* ── create ── */
  const handleCreate = async () => {
    if (!customerName || !subtotal || !issueDate || !dueDate) {
      setFormError("Customer name, subtotal, issue date and due date are required.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      const res = await authenticatedFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
          description:   description   || undefined,
          subtotal:      Number(subtotal),
          taxAmount,
          totalAmount,
          issueDate,
          dueDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create invoice");
      setInvoices((prev) => [data.invoice, ...prev]);
      setShowCreate(false);
      resetForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setDescription("");
    setSubtotal("");
    setTaxRate("16");
    setIssueDate("");
    setDueDate("");
    setFormError("");
  };

  /* ── filter + search ── */
  const visible = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      inv.customerName.toLowerCase().includes(q) ||
      inv.invoiceNumber.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (filter === "unpaid")  return inv.paymentStatus !== "PAID" && !isOverdue(inv);
    if (filter === "overdue") return isOverdue(inv);
    if (filter === "paid")    return inv.paymentStatus === "PAID";
    return true;
  });

  /* ── summary ── */
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalUnpaid   = invoices
    .filter((i) => i.paymentStatus !== "PAID")
    .reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalOverdue  = invoices
    .filter(isOverdue)
    .reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid     = invoices
    .filter((i) => i.paymentStatus === "PAID")
    .reduce((s, i) => s + Number(i.totalAmount), 0);

  /* ── detail view ── */
  if (detail) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">Invoicing</h1>
          <p className="mt-1 text-[#666B84]">Create, manage and track invoices.</p>
        </div>
        <InvoiceDetail invoice={detail} onBack={() => setDetail(null)} />
      </div>
    );
  }

  /* ── list view ── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">Invoicing</h1>
          <p className="mt-1 text-[#666B84]">Create, manage and track invoices.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#5a4de0]"
        >
          <Plus size={17} /> New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Invoiced", value: totalInvoiced, color: "#20243A" },
          { label: "Unpaid",         value: totalUnpaid,   color: "#F59E0B" },
          { label: "Overdue",        value: totalOverdue,  color: "#EF4444" },
          { label: "Paid",           value: totalPaid,     color: "#16A34A" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-[#ECECF3] bg-white p-5">
            <p className="text-sm text-[#666B84]">{c.label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: c.color }}>
              {fmt(c.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={fetchInvoices} className="flex items-center gap-1 underline">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer or invoice number…"
            className="w-full rounded-xl border border-[#ECECF3] bg-white py-2.5 pl-9 pr-4 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="cursor-pointer appearance-none rounded-xl border border-[#ECECF3] bg-white py-2.5 pl-4 pr-9 text-sm text-[#20243A] outline-none"
          >
            <option value="all">All invoices</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#666B84]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#666B84]">
            <RefreshCw size={18} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-[#9CA3AF]">
            <FileText size={36} className="mb-3 opacity-40" />
            <p className="text-sm">
              {search || filter !== "all"
                ? "No invoices match your filter."
                : "No invoices yet. Create your first one."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ECECF3] bg-[#F8F9FC]">
                {["Invoice #", "Customer", "Issue Date", "Due Date", "Amount (KES)", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-[#ECECF3] transition last:border-0 hover:bg-[#F8F9FC]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#20243A]">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#20243A]">{inv.customerName}</div>
                    {inv.customerEmail && (
                      <div className="text-xs text-[#9CA3AF]">{inv.customerEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666B84]">
                    {fmtDate(inv.issueDate)}
                  </td>
                  <td
                    className={`px-4 py-3 text-xs ${
                      isOverdue(inv)
                        ? "font-semibold text-[#EF4444]"
                        : "text-[#666B84]"
                    }`}
                  >
                    {fmtDate(inv.dueDate)}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#20243A]">
                    {fmt(inv.totalAmount)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(inv)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(inv)}
                      title="View invoice"
                      className="rounded-lg p-1.5 text-[#666B84] transition hover:bg-[#ECECF3] hover:text-[#20243A]"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreate && (
        <Modal title="New Invoice" onClose={() => setShowCreate(false)} wide>
          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice Number"><input className={inputCls} value="Generated automatically" readOnly aria-readonly="true" /></Field>
              <Field label="Customer Name *">
                <input
                  className={inputCls}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Acme Ltd"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer Email">
                <input
                  className={inputCls}
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="billing@acme.com"
                />
              </Field>
              <Field label="Customer Phone">
                <input
                  className={inputCls}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+254 700 000 000"
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className={inputCls}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Services rendered…"
              />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Subtotal (KES) *">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Tax Rate (%)">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="16"
                />
              </Field>
              <Field label="Total Amount">
                <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3.5 py-2.5 text-sm font-bold text-[#20243A]">
                  {fmt(totalAmount)}
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Issue Date *">
                <input
                  className={inputCls}
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </Field>
              <Field label="Due Date *">
                <input
                  className={inputCls}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>

            {/* Live tax breakdown */}
            {Number(subtotal) > 0 && (
              <div className="rounded-xl bg-[#F8F9FC] p-3 text-sm">
                <div className="flex justify-between text-[#666B84]">
                  <span>Subtotal</span>
                  <span className="font-mono">{fmt(Number(subtotal))}</span>
                </div>
                <div className="flex justify-between text-[#666B84]">
                  <span>Tax ({taxRate}%)</span>
                  <span className="font-mono">{fmt(taxAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[#ECECF3] pt-1 font-bold text-[#20243A]">
                  <span>Total</span>
                  <span className="font-mono text-[#20243A]">{fmt(totalAmount)}</span>
                </div>
              </div>
            )}

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-[#ECECF3] px-4 py-2 text-sm text-[#666B84] hover:bg-[#F8F9FC]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2 text-sm font-medium text-white hover:bg-[#5a4de0] disabled:opacity-60"
              >
                {saving && <RefreshCw size={14} className="animate-spin" />}
                Create Invoice
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}









