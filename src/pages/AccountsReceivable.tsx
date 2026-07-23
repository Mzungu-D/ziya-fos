import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
  ReactNode,
} from "react";

import {
  approveReceivable,
  createReceivable,
  deleteReceivable,
  fetchReceivables,
  recordReceivablePayment,
  updateReceivable,
} from "../services/accountsReceivable";

import type {
  Receivable,
  ReceivableInput,
} from "../services/accountsReceivable";

/* =========================================================
   TYPES
========================================================= */

interface InvoiceForm {
  invoiceNumber: string;
  customerName: string;
  description: string;
  amount: string;
  dueDate: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

const currencyFormatter =
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  });

const initialForm: InvoiceForm = {
  invoiceNumber: "",
  customerName: "",
  description: "",
  amount: "",
  dueDate: "",
};

/* =========================================================
   HELPERS
========================================================= */

const formatCurrency = (
  value: number
) => {
  const amount = Number(value);

  return currencyFormatter.format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
};

const formatDate = (
  value: string
) => {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }
  ).format(date);
};

const toDateInput = (
  value: string
) => {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
};

const getEffectiveStatus = (
  receivable: Receivable
) => {
  const paymentStatus =
    receivable.paymentStatus
      ?.toUpperCase()
      .replaceAll("_", " ") ??
    "";

  const approvalStatus =
    receivable.status
      ?.toUpperCase() ?? "";

  const amount =
    Number(
      receivable.amount
    ) || 0;

  const outstanding =
    Number(
      receivable.outstandingBalance
    ) || 0;

  if (
    paymentStatus === "PAID" ||
    outstanding <= 0
  ) {
    return "PAID";
  }

  if (
    outstanding > 0 &&
    amount > 0 &&
    outstanding < amount
  ) {
    return "PARTIALLY PAID";
  }

  const dueDate =
    new Date(
      receivable.dueDate
    );

  if (
    !Number.isNaN(
      dueDate.getTime()
    ) &&
    dueDate.getTime() <
      Date.now() &&
    outstanding > 0
  ) {
    return "OVERDUE";
  }

  if (
    approvalStatus ===
    "APPROVED"
  ) {
    return "APPROVED";
  }

  if (
    approvalStatus ===
      "PENDING" ||
    approvalStatus ===
      "PENDING_APPROVAL"
  ) {
    return "PENDING APPROVAL";
  }

  return (
    approvalStatus ||
    "DRAFT"
  );
};

const getStatusClasses = (
  status: string
) => {
  switch (status) {
    case "PAID":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";

    case "PARTIALLY PAID":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-400";

    case "APPROVED":
      return "border-blue-500/20 bg-blue-500/10 text-blue-400";

    case "OVERDUE":
      return "border-red-500/20 bg-red-500/10 text-red-400";

    case "PENDING APPROVAL":
      return "border-amber-500/20 bg-amber-500/10 text-amber-400";

    default:
      return "border-slate-600 bg-slate-700/30 text-slate-300";
  }
};

/* =========================================================
   COMPONENT
========================================================= */

export default function AccountsReceivable() {
  const [
    receivables,
    setReceivables,
  ] = useState<Receivable[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    selectedInvoice,
    setSelectedInvoice,
  ] =
    useState<Receivable | null>(
      null
    );

  const [
    showInvoiceForm,
    setShowInvoiceForm,
  ] = useState(false);

  const [
    editingInvoice,
    setEditingInvoice,
  ] =
    useState<Receivable | null>(
      null
    );

  const [
    showPaymentForm,
    setShowPaymentForm,
  ] = useState(false);

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    form,
    setForm,
  ] =
    useState<InvoiceForm>(
      initialForm
    );

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const loadReceivables =
    useCallback(
      async (
        showLoader = true
      ) => {
        if (showLoader) {
          setLoading(true);
        }

        setError("");

        try {
          const response =
            await fetchReceivables();

          setReceivables(
            response.receivables ??
              []
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load accounts receivable"
          );
        } finally {
          if (showLoader) {
            setLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    void loadReceivables();
  }, [loadReceivables]);

  /* =======================================================
     MESSAGES
  ======================================================= */

  const showSuccess = (
    message: string
  ) => {
    setError("");
    setSuccessMessage(
      message
    );

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3500);
  };

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      return receivables.reduce(
        (totals, item) => {
          const amount =
            Number(
              item.amount
            ) || 0;

          const outstanding =
            Number(
              item.outstandingBalance
            ) || 0;

          const status =
            getEffectiveStatus(
              item
            );

          totals.invoiced +=
            amount;

          totals.outstanding +=
            outstanding;

          totals.collected +=
            Math.max(
              0,
              amount -
                outstanding
            );

          if (
            status ===
            "OVERDUE"
          ) {
            totals.overdue +=
              outstanding;
          }

          return totals;
        },
        {
          invoiced: 0,
          outstanding: 0,
          collected: 0,
          overdue: 0,
        }
      );
    }, [receivables]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredReceivables =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return receivables.filter(
        (item) => {
          const status =
            getEffectiveStatus(
              item
            );

          const matchesSearch =
            !term ||
            item.customerName
              .toLowerCase()
              .includes(term) ||
            item.invoiceNumber
              .toLowerCase()
              .includes(term) ||
            item.description
              .toLowerCase()
              .includes(term);

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      receivables,
      search,
      statusFilter,
    ]);

  /* =======================================================
     FORM
  ======================================================= */

  const openNewInvoice =
    () => {
      setEditingInvoice(
        null
      );

      setForm(
        initialForm
      );

      setError("");
      setShowInvoiceForm(
        true
      );
    };

  const openEditInvoice = (
    invoice: Receivable
  ) => {
    if (
      Number(
        invoice.outstandingBalance
      ) !==
      Number(invoice.amount)
    ) {
      setError(
        "Invoices with recorded payments cannot be edited."
      );

      return;
    }

    setEditingInvoice(
      invoice
    );

    setForm({
      invoiceNumber:
        invoice.invoiceNumber,

      customerName:
        invoice.customerName,

      description:
        invoice.description,

      amount: String(
        invoice.amount
      ),

      dueDate:
        toDateInput(
          invoice.dueDate
        ),
    });

    setSelectedInvoice(
      null
    );

    setShowInvoiceForm(
      true
    );
  };

  const closeInvoiceForm =
    () => {
      if (saving) {
        return;
      }

      setShowInvoiceForm(
        false
      );

      setEditingInvoice(
        null
      );

      setForm(
        initialForm
      );
    };

  const handleSubmit =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      setError("");

      const amount =
        Number(form.amount);

      if (
        !form.invoiceNumber.trim() ||
        !form.customerName.trim() ||
        !form.description.trim() ||
        !form.dueDate
      ) {
        setError(
          "Complete all required invoice fields."
        );

        return;
      }

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        setError(
          "Invoice amount must be greater than zero."
        );

        return;
      }

      const payload: ReceivableInput =
        {
          invoiceNumber:
            form.invoiceNumber.trim(),

          customerName:
            form.customerName.trim(),

          description:
            form.description.trim(),

          amount,

          dueDate:
            form.dueDate,
        };

      setSaving(true);

      try {
        if (
          editingInvoice
        ) {
          const response =
            await updateReceivable(
              editingInvoice.id,
              payload
            );

          setReceivables(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  editingInvoice.id
                    ? response.receivable
                    : item
              )
          );

          showSuccess(
            response.message ??
              "Invoice updated successfully."
          );
        } else {
          const response =
            await createReceivable(
              payload
            );

          setReceivables(
            (current) => [
              response.receivable,
              ...current,
            ]
          );

          showSuccess(
            response.message ??
              "Invoice created successfully."
          );
        }

        closeInvoiceForm();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to save invoice"
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     APPROVE
  ======================================================= */

  const handleApprove =
    async (
      invoice: Receivable
    ) => {
      const confirmed =
        window.confirm(
          `Approve invoice ${invoice.invoiceNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        true
      );

      setError("");

      try {
        const response =
          await approveReceivable(
            invoice.id
          );

        setReceivables(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                invoice.id
                  ? response.receivable
                  : item
            )
        );

        setSelectedInvoice(
          response.receivable
        );

        showSuccess(
          response.message ??
            "Invoice approved."
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to approve invoice"
        );
      } finally {
        setActionLoading(
          false
        );
      }
    };

  /* =======================================================
     PAYMENT
  ======================================================= */

  const openPaymentForm = (
    invoice: Receivable
  ) => {
    if (
      invoice.status !==
      "APPROVED"
    ) {
      setError(
        "Approve the invoice before recording a customer payment."
      );

      return;
    }

    if (
      Number(
        invoice.outstandingBalance
      ) <= 0
    ) {
      setError(
        "This invoice has already been fully paid."
      );

      return;
    }

    setSelectedInvoice(
      invoice
    );

    setPaymentAmount("");
    setError("");
    setShowPaymentForm(
      true
    );
  };

  const handlePayment =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      if (!selectedInvoice) {
        return;
      }

      const amount =
        Number(
          paymentAmount
        );

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        setError(
          "Enter a valid payment amount."
        );

        return;
      }

      if (
        amount >
        Number(
          selectedInvoice.outstandingBalance
        )
      ) {
        setError(
          "Payment cannot exceed the outstanding balance."
        );

        return;
      }

      setActionLoading(
        true
      );

      setError("");

      try {
        const response =
          await recordReceivablePayment(
            selectedInvoice.id,
            amount
          );

        setReceivables(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                selectedInvoice.id
                  ? response.receivable
                  : item
            )
        );

        setSelectedInvoice(
          response.receivable
        );

        setShowPaymentForm(
          false
        );

        setPaymentAmount("");

        showSuccess(
          response.message ??
            "Payment recorded successfully."
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to record payment"
        );
      } finally {
        setActionLoading(
          false
        );
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete =
    async (
      invoice: Receivable
    ) => {
      if (
        Number(
          invoice.outstandingBalance
        ) !==
        Number(invoice.amount)
      ) {
        setError(
          "Invoices with recorded payments cannot be deleted."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        true
      );

      setError("");

      try {
        const response =
          await deleteReceivable(
            invoice.id
          );

        setReceivables(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                invoice.id
            )
        );

        setSelectedInvoice(
          null
        );

        showSuccess(
          response.message ??
            "Invoice deleted successfully."
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to delete invoice"
        );
      } finally {
        setActionLoading(
          false
        );
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">
      {/* Header */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Accounts Receivable
          </h1>

          <p className="mt-2 text-slate-400">
            Manage customer invoices,
            outstanding balances and incoming
            payments.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              void loadReceivables(
                false
              )
            }
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-slate-300 transition hover:bg-slate-800"
          >
            <RefreshCw
              size={17}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={
              openNewInvoice
            }
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            New Invoice
          </button>
        </div>
      </div>

      {/* Messages */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div className="flex-1">
            {error}
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={18} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
          <CheckCircle2
            size={20}
          />
          {successMessage}
        </div>
      )}

      {/* Summary */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Invoiced"
          value={formatCurrency(
            summary.invoiced
          )}
          icon={
            <FileText
              size={21}
            />
          }
        />

        <SummaryCard
          title="Outstanding"
          value={formatCurrency(
            summary.outstanding
          )}
          icon={
            <WalletCards
              size={21}
            />
          }
        />

        <SummaryCard
          title="Collected"
          value={formatCurrency(
            summary.collected
          )}
          icon={
            <Banknote
              size={21}
            />
          }
        />

        <SummaryCard
          title="Overdue"
          value={formatCurrency(
            summary.overdue
          )}
          icon={
            <Clock3
              size={21}
            />
          }
        />
      </div>

      {/* Search */}

      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-slate-800 bg-slate-950/40 px-3">
            <Search
              size={18}
              className="text-slate-500"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value
                )
              }
              type="text"
              placeholder="Search customer, invoice or description..."
              className="flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/40 px-3">
            <Filter
              size={17}
              className="text-slate-500"
            />

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
              className="min-w-48 bg-transparent px-3 py-3 text-slate-300 outline-none"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="PENDING APPROVAL">
                Pending Approval
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="PARTIALLY PAID">
                Partially Paid
              </option>

              <option value="PAID">
                Paid
              </option>

              <option value="OVERDUE">
                Overdue
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827]">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-slate-400">
            <Loader2
              size={22}
              className="animate-spin"
            />

            Loading receivables...
          </div>
        ) : filteredReceivables.length ===
          0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
              <Users
                size={26}
              />
            </div>

            <h3 className="font-semibold text-white">
              No invoices found
            </h3>

            <p className="mt-2 max-w-md text-sm text-slate-400">
              Create a customer
              invoice or adjust your
              search and filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead className="bg-slate-900/80 text-sm text-slate-400">
                <tr>
                  <th className="p-4 text-left">
                    Customer
                  </th>

                  <th className="p-4 text-left">
                    Invoice
                  </th>

                  <th className="p-4 text-right">
                    Amount
                  </th>

                  <th className="p-4 text-right">
                    Outstanding
                  </th>

                  <th className="p-4 text-left">
                    Due Date
                  </th>

                  <th className="p-4 text-left">
                    Status
                  </th>

                  <th className="p-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredReceivables.map(
                  (invoice) => {
                    const status =
                      getEffectiveStatus(
                        invoice
                      );

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-t border-slate-800 transition hover:bg-slate-900/60"
                      >
                        <td className="p-4">
                          <div className="font-medium text-white">
                            {
                              invoice.customerName
                            }
                          </div>

                          <div className="mt-1 max-w-64 truncate text-xs text-slate-500">
                            {
                              invoice.description
                            }
                          </div>
                        </td>

                        <td className="p-4 font-medium text-blue-400">
                          {
                            invoice.invoiceNumber
                          }
                        </td>

                        <td className="p-4 text-right text-slate-200">
                          {formatCurrency(
                            invoice.amount
                          )}
                        </td>

                        <td className="p-4 text-right font-semibold text-white">
                          {formatCurrency(
                            invoice.outstandingBalance
                          )}
                        </td>

                        <td className="p-4 text-slate-300">
                          {formatDate(
                            invoice.dueDate
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                              status
                            )}`}
                          >
                            {
                              status
                            }
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              title="View invoice"
                              onClick={() =>
                                setSelectedInvoice(
                                  invoice
                                )
                              }
                            >
                              <Eye
                                size={
                                  17
                                }
                              />
                            </ActionButton>

                            {invoice.status !==
                              "APPROVED" && (
                              <ActionButton
                                title="Approve invoice"
                                onClick={() =>
                                  void handleApprove(
                                    invoice
                                  )
                                }
                              >
                                <CheckCircle2
                                  size={
                                    17
                                  }
                                />
                              </ActionButton>
                            )}

                            {invoice.status ===
                              "APPROVED" &&
                              Number(
                                invoice.outstandingBalance
                              ) >
                                0 && (
                                <ActionButton
                                  title="Record payment"
                                  onClick={() =>
                                    openPaymentForm(
                                      invoice
                                    )
                                  }
                                >
                                  <Banknote
                                    size={
                                      17
                                    }
                                  />
                                </ActionButton>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-slate-500">
        Showing{" "}
        {
          filteredReceivables.length
        }{" "}
        of{" "}
        {receivables.length}{" "}
        invoices
      </div>

      {/* Invoice Modal */}

      {showInvoiceForm && (
        <Modal
          title={
            editingInvoice
              ? "Edit Customer Invoice"
              : "New Customer Invoice"
          }
          description={
            editingInvoice
              ? "Update invoice information before any payment is recorded."
              : "Create a new accounts receivable invoice."
          }
          onClose={
            closeInvoiceForm
          }
        >
          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-5"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Customer Name *">
                <input
                  value={
                    form.customerName
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        customerName:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder="Enter customer name"
                  className="input-style"
                />
              </FormField>

              <FormField label="Invoice Number *">
                <input
                  value={
                    form.invoiceNumber
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        invoiceNumber:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder="e.g. AR-2026-001"
                  className="input-style"
                />
              </FormField>

              <FormField label="Amount (KES) *">
                <input
                  value={
                    form.amount
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        amount:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  className="input-style"
                />
              </FormField>

              <FormField label="Due Date *">
                <input
                  value={
                    form.dueDate
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        dueDate:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  type="date"
                  className="input-style"
                />
              </FormField>
            </div>

            <FormField label="Description *">
              <textarea
                value={
                  form.description
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      description:
                        event
                          .target
                          .value,
                    })
                  )
                }
                rows={4}
                placeholder="Describe the goods, service or customer obligation..."
                className="input-style resize-none"
              />
            </FormField>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={
                  closeInvoiceForm
                }
                disabled={
                  saving
                }
                className="rounded-xl border border-slate-700 px-5 py-2.5 font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Plus
                    size={18}
                  />
                )}

                {editingInvoice
                  ? "Save Changes"
                  : "Create Invoice"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}

      {selectedInvoice &&
        !showPaymentForm &&
        !showInvoiceForm && (
          <Modal
            title={
              selectedInvoice.invoiceNumber
            }
            description="Customer invoice details and collection status."
            onClose={() =>
              setSelectedInvoice(
                null
              )
            }
          >
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Detail
                  label="Customer"
                  value={
                    selectedInvoice.customerName
                  }
                />

                <Detail
                  label="Invoice Number"
                  value={
                    selectedInvoice.invoiceNumber
                  }
                />

                <Detail
                  label="Original Amount"
                  value={formatCurrency(
                    selectedInvoice.amount
                  )}
                />

                <Detail
                  label="Outstanding Balance"
                  value={formatCurrency(
                    selectedInvoice.outstandingBalance
                  )}
                />

                <Detail
                  label="Due Date"
                  value={formatDate(
                    selectedInvoice.dueDate
                  )}
                />

                <Detail
                  label="Status"
                  value={getEffectiveStatus(
                    selectedInvoice
                  )}
                />

                <Detail
                  label="Created"
                  value={formatDate(
                    selectedInvoice.createdAt
                  )}
                />

                <Detail
                  label="Approved By"
                  value={
                    selectedInvoice.approvedBy ??
                    "Not approved"
                  }
                />
              </div>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Description
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-slate-300">
                  {
                    selectedInvoice.description
                  }
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-5">
                {Number(
                  selectedInvoice.outstandingBalance
                ) ===
                  Number(
                    selectedInvoice.amount
                  ) && (
                  <button
                    type="button"
                    onClick={() =>
                      openEditInvoice(
                        selectedInvoice
                      )
                    }
                    className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-slate-300 hover:bg-slate-800"
                  >
                    <Edit3
                      size={17}
                    />
                    Edit
                  </button>
                )}

                {selectedInvoice.status !==
                  "APPROVED" && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      void handleApprove(
                        selectedInvoice
                      )
                    }
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <CheckCircle2
                      size={17}
                    />
                    Approve
                  </button>
                )}

                {selectedInvoice.status ===
                  "APPROVED" &&
                  Number(
                    selectedInvoice.outstandingBalance
                  ) >
                    0 && (
                    <button
                      type="button"
                      onClick={() =>
                        openPaymentForm(
                          selectedInvoice
                        )
                      }
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-white hover:bg-emerald-700"
                    >
                      <Banknote
                        size={
                          17
                        }
                      />
                      Record Payment
                    </button>
                  )}

                {Number(
                  selectedInvoice.outstandingBalance
                ) ===
                  Number(
                    selectedInvoice.amount
                  ) && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      void handleDelete(
                        selectedInvoice
                      )
                    }
                    className="flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    <Trash2
                      size={17}
                    />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </Modal>
        )}

      {/* Payment Modal */}

      {showPaymentForm &&
        selectedInvoice && (
          <Modal
            title="Record Customer Payment"
            description={`Apply a payment against ${selectedInvoice.invoiceNumber}.`}
            onClose={() => {
              if (
                actionLoading
              ) {
                return;
              }

              setShowPaymentForm(
                false
              );
            }}
          >
            <form
              onSubmit={
                handlePayment
              }
              className="space-y-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Detail
                  label="Customer"
                  value={
                    selectedInvoice.customerName
                  }
                />

                <Detail
                  label="Outstanding"
                  value={formatCurrency(
                    selectedInvoice.outstandingBalance
                  )}
                />
              </div>

              <FormField label="Payment Amount (KES) *">
                <input
                  value={
                    paymentAmount
                  }
                  onChange={(
                    event
                  ) =>
                    setPaymentAmount(
                      event.target
                        .value
                    )
                  }
                  type="number"
                  min="0.01"
                  max={
                    selectedInvoice.outstandingBalance
                  }
                  step="0.01"
                  placeholder="0.00"
                  autoFocus
                  className="input-style"
                />
              </FormField>

              <button
                type="button"
                onClick={() =>
                  setPaymentAmount(
                    String(
                      selectedInvoice.outstandingBalance
                    )
                  )
                }
                className="text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                Use full outstanding
                balance
              </button>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowPaymentForm(
                      false
                    )
                  }
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    actionLoading
                  }
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {actionLoading ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Banknote
                      size={18}
                    />
                  )}

                  Record Payment
                </button>
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {title}
        </span>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          {icon}
        </div>
      </div>

      <div className="text-xl font-bold text-white">
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400"
    >
      {children}
    </button>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>

      {children}
    </label>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>

      <div className="break-words font-medium text-slate-200">
        {value}
      </div>
    </div>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {title}
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={21} />
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}