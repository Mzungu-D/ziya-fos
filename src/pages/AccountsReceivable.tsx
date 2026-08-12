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

type StatusFilter =
  | "ALL"
  | "PENDING APPROVAL"
  | "APPROVED"
  | "OUTSTANDING"
  | "PARTIALLY PAID"
  | "PAID"
  | "OVERDUE";

/* =========================================================
   CONSTANTS
========================================================= */

const initialForm: InvoiceForm = {
  invoiceNumber: "",
  customerName: "",
  description: "",
  amount: "",
  dueDate: "",
};

const currencyFormatter =
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  });

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

const normalize = (
  value?: string | null
) => {
  return (
    value
      ?.trim()
      .toUpperCase()
      .replaceAll("_", " ") ??
    ""
  );
};

const getEffectiveStatus = (
  receivable: Receivable
): Exclude<
  StatusFilter,
  "ALL"
> => {
  const paymentStatus =
    normalize(
      receivable.paymentStatus
    );

  const approvalStatus =
    normalize(
      receivable.status
    );

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
    amount > 0 &&
    outstanding > 0 &&
    outstanding < amount
  ) {
    return "PARTIALLY PAID";
  }

  const dueDate =
    new Date(
      receivable.dueDate
    );

  if (
    outstanding > 0 &&
    !Number.isNaN(
      dueDate.getTime()
    ) &&
    dueDate.getTime() <
      Date.now()
  ) {
    return "OVERDUE";
  }

  if (
    approvalStatus ===
    "APPROVED"
  ) {
    return "OUTSTANDING";
  }

  return "PENDING APPROVAL";
};

const getStatusClasses = (
  status: string
) => {
  switch (status) {
    case "PAID":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";

    case "PARTIALLY PAID":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-400";

    case "OUTSTANDING":
      return "border-[#20243A]/20 bg-[#20243A]/10 text-[#20243A]";

    case "APPROVED":
      return "border-[#20243A]/20 bg-[#20243A]/10 text-[#20243A]";

    case "OVERDUE":
      return "border-red-500/20 bg-red-500/10 text-red-400";

    case "PENDING APPROVAL":
      return "border-amber-500/20 bg-amber-500/10 text-amber-400";

    default:
      return "border-[#ECECF3] bg-[#ECECF3]/30 text-[#666B84]";
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
    actionId,
    setActionId,
  ] = useState<string | null>(
    null
  );

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
  ] =
    useState<StatusFilter>(
      "ALL"
    );

  const [
    selectedInvoice,
    setSelectedInvoice,
  ] =
    useState<Receivable | null>(
      null
    );

  const [
    editingInvoice,
    setEditingInvoice,
  ] =
    useState<Receivable | null>(
      null
    );

  const [
    showInvoiceForm,
    setShowInvoiceForm,
  ] = useState(false);

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
     DATA
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
              : "Failed to load accounts receivable."
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
        (totals, invoice) => {
          const amount =
            Number(
              invoice.amount
            ) || 0;

          const outstanding =
            Number(
              invoice.outstandingBalance
            ) || 0;

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
            getEffectiveStatus(
              invoice
            ) === "OVERDUE"
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
     SEARCH + STATUS FILTER
  ======================================================= */

  const filteredReceivables =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return receivables.filter(
        (invoice) => {
          const status =
            getEffectiveStatus(
              invoice
            );

          const matchesSearch =
            !term ||
            invoice.customerName
              .toLowerCase()
              .includes(term) ||
            invoice.invoiceNumber
              .toLowerCase()
              .includes(term) ||
            invoice.description
              .toLowerCase()
              .includes(term);

          let matchesStatus =
            statusFilter ===
              "ALL" ||
            status ===
              statusFilter;

          /*
           * APPROVED is included as a
           * filter option for workflow
           * visibility. An approved
           * unpaid invoice appears as
           * OUTSTANDING in the table.
           */
          if (
            statusFilter ===
            "APPROVED"
          ) {
            matchesStatus =
              normalize(
                invoice.status
              ) ===
              "APPROVED";
          }

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
     CREATE
  ======================================================= */

  const openNewInvoice =
    () => {
      setError("");
      setEditingInvoice(
        null
      );
      setForm(
        initialForm
      );
      setShowInvoiceForm(
        true
      );
    };

  /* =======================================================
     EDIT
  ======================================================= */

  const openEditInvoice = (
    invoice: Receivable
  ) => {
    const hasPayment =
      Number(
        invoice.outstandingBalance
      ) !==
      Number(invoice.amount);

    if (hasPayment) {
      setError(
        "This invoice already has a recorded payment and cannot be edited."
      );

      return;
    }

    setError("");

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

  /* =======================================================
     SAVE
  ======================================================= */

  const handleSubmit =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      setError("");

      const invoiceNumber =
        form.invoiceNumber.trim();

      const customerName =
        form.customerName.trim();

      const description =
        form.description.trim();

      const amount =
        Number(form.amount);

      /*
       * These fields are required by
       * the Prisma schema, therefore
       * they cannot be saved blank.
       *
       * The user can still delete and
       * replace their contents freely.
       */
      if (!invoiceNumber) {
        setError(
          "Invoice number is required."
        );
        return;
      }

      if (!customerName) {
        setError(
          "Customer name is required."
        );
        return;
      }

      if (!description) {
        setError(
          "Description is required."
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
          "Amount must be greater than zero."
        );
        return;
      }

      if (!form.dueDate) {
        setError(
          "Due date is required."
        );
        return;
      }

      const payload: ReceivableInput =
        {
          invoiceNumber,
          customerName,
          description,
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
                (invoice) =>
                  invoice.id ===
                  editingInvoice.id
                    ? response.receivable
                    : invoice
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

        setShowInvoiceForm(
          false
        );

        setEditingInvoice(
          null
        );

        setForm(
          initialForm
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to save invoice."
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
      if (
        normalize(
          invoice.status
        ) === "APPROVED"
      ) {
        setError(
          "This invoice is already approved."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Approve invoice ${invoice.invoiceNumber} for ${invoice.customerName}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        true
      );
      setActionId(
        invoice.id
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
          (current) =>
            current?.id ===
            invoice.id
              ? response.receivable
              : current
        );

        showSuccess(
          response.message ??
            "Invoice approved successfully."
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to approve invoice."
        );
      } finally {
        setActionLoading(
          false
        );
        setActionId(null);
      }
    };

  /* =======================================================
     PAYMENT
  ======================================================= */

  const openPaymentForm = (
    invoice: Receivable
  ) => {
    if (
      normalize(
        invoice.status
      ) !== "APPROVED"
    ) {
      setError(
        "Approve the invoice before recording payment."
      );

      return;
    }

    if (
      Number(
        invoice.outstandingBalance
      ) <= 0
    ) {
      setError(
        "This invoice is already fully paid."
      );

      return;
    }

    setError("");

    setSelectedInvoice(
      invoice
    );

    setPaymentAmount("");

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
          "Enter a valid payment amount greater than zero."
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
      setActionId(
        selectedInvoice.id
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
              (invoice) =>
                invoice.id ===
                selectedInvoice.id
                  ? response.receivable
                  : invoice
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
            "Customer payment recorded successfully."
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to record customer payment."
        );
      } finally {
        setActionLoading(
          false
        );
        setActionId(null);
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete =
    async (
      invoice: Receivable
    ) => {
      const hasPayment =
        Number(
          invoice.outstandingBalance
        ) !==
        Number(invoice.amount);

      if (hasPayment) {
        setError(
          "This invoice has recorded payments and cannot be deleted. Financial records with payment activity must remain in the audit trail."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Delete invoice ${invoice.invoiceNumber} for ${invoice.customerName}?\n\nThis action permanently removes the invoice and cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        true
      );
      setActionId(
        invoice.id
      );
      setError("");

      try {
        const response =
          await deleteReceivable(
            invoice.id
          );

        /*
         * Remove only after the API
         * confirms successful deletion.
         */
        setReceivables(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                invoice.id
            )
        );

        setSelectedInvoice(
          (current) =>
            current?.id ===
            invoice.id
              ? null
              : current
        );

        showSuccess(
          response.message ??
            "Invoice deleted successfully."
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to delete invoice."
        );
      } finally {
        setActionLoading(
          false
        );
        setActionId(null);
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Accounts Receivable
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage customer invoices,
            outstanding balances and
            incoming payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              loading
            }
            onClick={() =>
              void loadReceivables(
                true
              )
            }
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-[#666B84] transition hover:bg-[#F8F9FC] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={
              openNewInvoice
            }
            className="flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 font-medium text-[#20243A] transition hover:bg-[#5a4de0]"
          >
            <Plus size={18} />
            New Invoice
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="rounded p-1 hover:bg-red-500/10"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* SUCCESS */}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
          <CheckCircle2
            size={20}
          />

          {successMessage}
        </div>
      )}

      {/* SUMMARY */}

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

      {/* SEARCH + FILTER */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-[#ECECF3] bg-slate-950/40 px-3">
            <Search
              size={18}
              className="text-[#666B84]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search customer, invoice or description..."
              className="flex-1 bg-transparent px-3 py-3 text-[#20243A] outline-none placeholder:text-slate-600"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="text-[#666B84] hover:text-[#20243A]"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div className="flex items-center rounded-xl border border-[#ECECF3] bg-slate-950/40 px-3">
            <Filter
              size={17}
              className="text-[#666B84]"
            />

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter
                )
              }
              className="min-w-52 bg-transparent px-3 py-3 text-[#666B84] outline-none"
            >
              <option value="ALL">
                All Statuses
              </option>

              <option value="PENDING APPROVAL">
                Pending Approval
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="OUTSTANDING">
                Outstanding
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

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-[#666B84]">
            <Loader2
              size={22}
              className="animate-spin"
            />
            Loading receivables...
          </div>
        ) : filteredReceivables.length ===
          0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <FileText
              size={36}
              className="mb-4 text-slate-600"
            />

            <h3 className="font-semibold text-[#20243A]">
              No invoices found
            </h3>

            <p className="mt-2 text-sm text-[#666B84]">
              Create an invoice or
              adjust your search and
              status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-white/80 text-sm text-[#666B84]">
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

                    const busy =
                      actionLoading &&
                      actionId ===
                        invoice.id;

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-t border-[#ECECF3] transition hover:bg-white/60"
                      >
                        <td className="p-4">
                          <div className="font-medium text-[#20243A]">
                            {
                              invoice.customerName
                            }
                          </div>

                          <div className="mt-1 max-w-60 truncate text-xs text-[#666B84]">
                            {
                              invoice.description
                            }
                          </div>
                        </td>

                        <td className="p-4 font-medium text-[#20243A]">
                          {
                            invoice.invoiceNumber
                          }
                        </td>

                        <td className="p-4 text-right text-[#20243A]">
                          {formatCurrency(
                            invoice.amount
                          )}
                        </td>

                        <td className="p-4 text-right font-semibold text-[#20243A]">
                          {formatCurrency(
                            invoice.outstandingBalance
                          )}
                        </td>

                        <td className="p-4 text-[#666B84]">
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
                            {busy ? (
                              <div className="flex h-9 w-9 items-center justify-center">
                                <Loader2
                                  size={
                                    17
                                  }
                                  className="animate-spin text-[#20243A]"
                                />
                              </div>
                            ) : (
                              <>
                                <ActionButton
                                  title="View"
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

                                <ActionButton
                                  title="Edit"
                                  onClick={() =>
                                    openEditInvoice(
                                      invoice
                                    )
                                  }
                                >
                                  <Edit3
                                    size={
                                      17
                                    }
                                  />
                                </ActionButton>

                                {normalize(
                                  invoice.status
                                ) !==
                                  "APPROVED" && (
                                  <ActionButton
                                    title="Approve"
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

                                {normalize(
                                  invoice.status
                                ) ===
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

                                <ActionButton
                                  title="Delete"
                                  danger
                                  onClick={() =>
                                    void handleDelete(
                                      invoice
                                    )
                                  }
                                >
                                  <Trash2
                                    size={
                                      17
                                    }
                                  />
                                </ActionButton>
                              </>
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

      <div className="text-sm text-[#666B84]">
        Showing{" "}
        {
          filteredReceivables.length
        }{" "}
        of{" "}
        {receivables.length}{" "}
        invoices
      </div>

      {/* CREATE / EDIT MODAL */}

      {showInvoiceForm && (
        <Modal
          title={
            editingInvoice
              ? "Edit Customer Invoice"
              : "New Customer Invoice"
          }
          description={
            editingInvoice
              ? "Update the invoice information."
              : "Create a new customer receivable."
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
                  type="text"
                  value={
                    form.customerName
                  }
                  onChange={(event) =>
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
                  placeholder="Customer name"
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-slate-600 focus:border-[#20243A]"
                />
              </FormField>

              <FormField label="Invoice Number *">
                <input
                  type="text"
                  value={
                    form.invoiceNumber
                  }
                  onChange={(event) =>
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
                  placeholder="AR-2026-001"
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-slate-600 focus:border-[#20243A]"
                />
              </FormField>

              <FormField label="Amount (KES) *">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    form.amount
                  }
                  onChange={(event) =>
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
                  placeholder="0.00"
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-slate-600 focus:border-[#20243A]"
                />
              </FormField>

              <FormField label="Due Date *">
                <input
                  type="date"
                  value={
                    form.dueDate
                  }
                  onChange={(event) =>
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
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition focus:border-[#20243A]"
                />
              </FormField>
            </div>

            <FormField label="Description *">
              <textarea
                rows={4}
                value={
                  form.description
                }
                onChange={(event) =>
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
                placeholder="Invoice description"
                className="w-full resize-none rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-slate-600 focus:border-[#20243A]"
              />
            </FormField>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  closeInvoiceForm
                }
                className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex items-center gap-2 rounded-xl bg-[#20243A] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#5a4de0] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : editingInvoice ? (
                  <Edit3
                    size={18}
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

      {/* DETAILS */}

      {selectedInvoice &&
        !showPaymentForm &&
        !showInvoiceForm && (
          <Modal
            title={
              selectedInvoice.invoiceNumber
            }
            description="Customer invoice details."
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
                  label="Invoice"
                  value={
                    selectedInvoice.invoiceNumber
                  }
                />

                <Detail
                  label="Amount"
                  value={formatCurrency(
                    selectedInvoice.amount
                  )}
                />

                <Detail
                  label="Outstanding"
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
                  label="Payment Status"
                  value={
                    normalize(
                      selectedInvoice.paymentStatus
                    ) ||
                    "UNPAID"
                  }
                />

                <Detail
                  label="Approved By"
                  value={
                    selectedInvoice.approvedBy ??
                    "Not approved"
                  }
                />
              </div>

              <div className="rounded-xl border border-[#ECECF3] bg-slate-950/30 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#666B84]">
                  Description
                </div>

                <div className="text-[#666B84]">
                  {
                    selectedInvoice.description
                  }
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={() =>
                    openEditInvoice(
                      selectedInvoice
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-[#ECECF3] px-4 py-2.5 text-[#666B84] hover:bg-[#F8F9FC]"
                >
                  <Edit3
                    size={17}
                  />
                  Edit
                </button>

                {normalize(
                  selectedInvoice.status
                ) !==
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
                    className="flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 text-[#20243A] hover:bg-[#5a4de0] disabled:opacity-50"
                  >
                    <CheckCircle2
                      size={17}
                    />
                    Approve
                  </button>
                )}

                {normalize(
                  selectedInvoice.status
                ) ===
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
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[#20243A] hover:bg-emerald-700"
                    >
                      <Banknote
                        size={
                          17
                        }
                      />
                      Record Payment
                    </button>
                  )}

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
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2
                    size={17}
                  />
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}

      {/* PAYMENT */}

      {showPaymentForm &&
        selectedInvoice && (
          <Modal
            title="Record Customer Payment"
            description={`Apply payment to ${selectedInvoice.invoiceNumber}.`}
            onClose={() => {
              if (
                actionLoading
              ) {
                return;
              }

              setShowPaymentForm(
                false
              );
              setPaymentAmount("");
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
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={
                    selectedInvoice.outstandingBalance
                  }
                  value={
                    paymentAmount
                  }
                  onChange={(event) =>
                    setPaymentAmount(
                      event.target
                        .value
                    )
                  }
                  placeholder="0.00"
                  autoFocus
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
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
                className="text-sm font-medium text-[#20243A] hover:text-[#20243A]"
              >
                Use full outstanding
                balance
              </button>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  disabled={
                    actionLoading
                  }
                  onClick={() => {
                    setShowPaymentForm(
                      false
                    );
                    setPaymentAmount(
                      ""
                    );
                  }}
                  className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    actionLoading
                  }
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-[#20243A] hover:bg-emerald-700 disabled:opacity-50"
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
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-[#666B84]">
          {title}
        </span>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20243A]/10 text-[#20243A]">
          {icon}
        </div>
      </div>

      <div className="text-xl font-bold text-[#20243A]">
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        danger
          ? "flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 text-red-400 transition hover:bg-red-500/10"
          : "flex h-9 w-9 items-center justify-center rounded-lg border border-[#ECECF3] text-[#666B84] transition hover:border-[#20243A]/40 hover:bg-[#20243A]/10 hover:text-[#20243A]"
      }
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
      <span className="mb-2 block text-sm font-medium text-[#666B84]">
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
    <div className="rounded-xl border border-[#ECECF3] bg-slate-950/30 p-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[#666B84]">
        {label}
      </div>

      <div className="break-words font-medium text-[#20243A]">
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
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#ECECF3] p-6">
          <div>
            <h2 className="text-2xl font-bold text-[#20243A]">
              {title}
            </h2>

            <p className="mt-2 text-sm text-[#666B84]">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
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
