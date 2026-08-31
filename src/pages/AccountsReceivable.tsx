/* =========================================================
   ACCOUNTS RECEIVABLE
========================================================= */

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

type StatusFilter =
  | "ALL"
  | "PENDING APPROVAL"
  | "APPROVED"
  | "OUTSTANDING"
  | "PARTIALLY PAID"
  | "PAID"
  | "OVERDUE";

type AgingFilter =
  | "ALL"
  | "CURRENT"
  | "1–30 DAYS"
  | "31–60 DAYS"
  | "61–90 DAYS"
  | "90+ DAYS";

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
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PARTIALLY PAID":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "OUTSTANDING":
      return "border-teal-200 bg-teal-50 text-teal-700";

    case "APPROVED":
      return "border-teal-200 bg-teal-50 text-teal-700";

    case "OVERDUE":
      return "border-red-200 bg-red-50 text-red-700";

    case "PENDING APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-[#ECECF3] bg-[#F8F9FC] text-[#666B84]";
  }
};

const getDaysOverdue = (
  receivable: Receivable
) => {
  const dueDate =
    new Date(
      receivable.dueDate
    );

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    return 0;
  }

  const outstanding =
    Number(
      receivable.outstandingBalance
    ) || 0;

  if (outstanding <= 0) {
    return 0;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  dueDate.setHours(
    0,
    0,
    0,
    0
  );

  const difference =
    today.getTime() -
    dueDate.getTime();

  if (difference <= 0) {
    return 0;
  }

  return Math.floor(
    difference /
      (1000 *
        60 *
        60 *
        24)
  );
};

const getAgingBucket = (
  receivable: Receivable
): Exclude<
  AgingFilter,
  "ALL"
> => {
  const outstanding =
    Number(
      receivable.outstandingBalance
    ) || 0;

  if (outstanding <= 0) {
    return "CURRENT";
  }

  const days =
    getDaysOverdue(
      receivable
    );

  if (days <= 0) {
    return "CURRENT";
  }

  if (days <= 30) {
    return "1–30 DAYS";
  }

  if (days <= 60) {
    return "31–60 DAYS";
  }

  if (days <= 90) {
    return "61–90 DAYS";
  }

  return "90+ DAYS";
};

const getAgingClasses = (
  bucket: string
) => {
  switch (bucket) {
    case "CURRENT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "1–30 DAYS":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "31–60 DAYS":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "61–90 DAYS":
      return "border-red-200 bg-red-50 text-red-700";

    case "90+ DAYS":
      return "border-red-300 bg-red-100 text-red-800";

    default:
      return "border-[#ECECF3] bg-[#F8F9FC] text-[#666B84]";
  }
};

const getCollectionPercentage = (
  invoice: Receivable
) => {
  const amount =
    Number(
      invoice.amount
    ) || 0;

  const outstanding =
    Number(
      invoice.outstandingBalance
    ) || 0;

  if (amount <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      ((amount -
        outstanding) /
        amount) *
        100
    )
  );
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
    agingFilter,
    setAgingFilter,
  ] =
    useState<AgingFilter>(
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

  const collectionRate =
    summary.invoiced > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (summary.collected /
              summary.invoiced) *
              100
          )
        )
      : 0;

  const invoiceMetrics =
    useMemo(() => {
      return receivables.reduce(
        (metrics, invoice) => {
          const status =
            getEffectiveStatus(
              invoice
            );

          metrics.total += 1;

          if (
            status === "PAID"
          ) {
            metrics.paid += 1;
          }

          if (
            status ===
            "PARTIALLY PAID"
          ) {
            metrics.partial += 1;
          }

          if (
            status ===
            "PENDING APPROVAL"
          ) {
            metrics.pending += 1;
          }

          if (
            status === "OVERDUE"
          ) {
            metrics.overdue += 1;
          }

          return metrics;
        },
        {
          total: 0,
          paid: 0,
          partial: 0,
          pending: 0,
          overdue: 0,
        }
      );
    }, [receivables]);

  /* =======================================================
     AGING
  ======================================================= */

  const agingSummary =
    useMemo(() => {
      return receivables.reduce(
        (totals, invoice) => {
          const outstanding =
            Number(
              invoice.outstandingBalance
            ) || 0;

          if (
            outstanding <= 0
          ) {
            return totals;
          }

          const bucket =
            getAgingBucket(
              invoice
            );

          if (
            bucket ===
            "CURRENT"
          ) {
            totals.current +=
              outstanding;
          }

          if (
            bucket ===
            "1–30 DAYS"
          ) {
            totals.days1to30 +=
              outstanding;
          }

          if (
            bucket ===
            "31–60 DAYS"
          ) {
            totals.days31to60 +=
              outstanding;
          }

          if (
            bucket ===
            "61–90 DAYS"
          ) {
            totals.days61to90 +=
              outstanding;
          }

          if (
            bucket ===
            "90+ DAYS"
          ) {
            totals.days90Plus +=
              outstanding;
          }

          return totals;
        },
        {
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90Plus: 0,
        }
      );
    }, [receivables]);

  /* =======================================================
     CUSTOMER EXPOSURE
  ======================================================= */

  const customerExposure =
    useMemo(() => {
      const grouped =
        new Map<
          string,
          {
            customerName: string;
            invoiceCount: number;
            invoiced: number;
            collected: number;
            outstanding: number;
            overdue: number;
          }
        >();

      receivables.forEach(
        (invoice) => {
          const customerName =
            invoice.customerName.trim() ||
            "Unknown Customer";

          const existing =
            grouped.get(
              customerName
            ) ?? {
              customerName,
              invoiceCount: 0,
              invoiced: 0,
              collected: 0,
              outstanding: 0,
              overdue: 0,
            };

          const amount =
            Number(
              invoice.amount
            ) || 0;

          const outstanding =
            Number(
              invoice.outstandingBalance
            ) || 0;

          existing.invoiceCount +=
            1;

          existing.invoiced +=
            amount;

          existing.outstanding +=
            outstanding;

          existing.collected +=
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
            existing.overdue +=
              outstanding;
          }

          grouped.set(
            customerName,
            existing
          );
        }
      );

      return Array.from(
        grouped.values()
      ).sort(
        (a, b) =>
          b.outstanding -
          a.outstanding
      );
    }, [receivables]);

  const customerCount =
    customerExposure.length;

  const customersWithBalance =
    customerExposure.filter(
      (customer) =>
        customer.outstanding > 0
    ).length;

  /* =======================================================
     FILTERED DATA
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

          const aging =
            getAgingBucket(
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

          const matchesAging =
            agingFilter ===
              "ALL" ||
            aging ===
              agingFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesAging
          );
        }
      );
    }, [
      receivables,
      search,
      statusFilter,
      agingFilter,
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
    <div className="space-y-6 pb-10">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
              <WalletCards
                size={22}
              />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#20243A]">
                Accounts Receivable
              </h1>

              <p className="mt-1 text-[#666B84]">
                Manage customer invoices,
                collections and outstanding
                balances.
              </p>
            </div>
          </div>
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
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 font-medium text-[#666B84] shadow-sm transition hover:bg-[#F8F9FC] disabled:opacity-50"
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
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#0B7F74]"
          >
            <Plus size={18} />

            New Invoice
          </button>
        </div>
      </div>

      {/* ===================================================
          ALERTS
      =================================================== */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1 text-sm font-medium">
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="rounded p-1 hover:bg-red-100"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle2
            size={20}
          />

          <span className="text-sm font-medium">
            {successMessage}
          </span>
        </div>
      )}

      {/* ===================================================
          KPI CARDS
      =================================================== */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Invoiced"
          value={formatCurrency(
            summary.invoiced
          )}
          subtitle={`${invoiceMetrics.total} invoice${invoiceMetrics.total === 1 ? "" : "s"}`}
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
          subtitle={`${invoiceMetrics.overdue} overdue invoice${invoiceMetrics.overdue === 1 ? "" : "s"}`}
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
          subtitle={`${collectionRate.toFixed(1)}% collection rate`}
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
          subtitle="Outstanding overdue exposure"
          icon={
            <Clock3
              size={21}
            />
          }
          danger={
            summary.overdue >
            0
          }
        />
      </div>

      {/* ===================================================
          COLLECTION PERFORMANCE
      =================================================== */}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#20243A]">
                Collection Performance
              </p>

              <p className="mt-1 text-sm text-[#888DA3]">
                Amount collected against total invoiced.
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-[#20243A]">
                {collectionRate.toFixed(
                  1
                )}
                %
              </p>

              <p className="mt-1 text-xs text-[#888DA3]">
                collection rate
              </p>
            </div>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#ECECF3]">
            <div
              className="h-full rounded-full bg-[#0D9488] transition-all duration-500"
              style={{
                width: `${collectionRate}%`,
              }}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Collected"
              value={formatCurrency(
                summary.collected
              )}
            />

            <Metric
              label="Outstanding"
              value={formatCurrency(
                summary.outstanding
              )}
            />

            <Metric
              label="Invoices"
              value={String(
                invoiceMetrics.total
              )}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#20243A]">
            Invoice Status
          </p>

          <p className="mt-1 text-sm text-[#888DA3]">
            Current receivables portfolio.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatusMetric
              label="Pending"
              value={
                invoiceMetrics.pending
              }
            />

            <StatusMetric
              label="Partial"
              value={
                invoiceMetrics.partial
              }
            />

            <StatusMetric
              label="Paid"
              value={
                invoiceMetrics.paid
              }
            />

            <StatusMetric
              label="Overdue"
              value={
                invoiceMetrics.overdue
              }
            />
          </div>
        </div>
      </div>

      {/* ===================================================
          OVERDUE EXPOSURE
      =================================================== */}

      <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Clock3
                size={19}
              />
            </div>

            <div>
              <p className="font-semibold text-red-900">
                Overdue Exposure
              </p>

              <p className="mt-1 text-sm text-red-700/80">
                {invoiceMetrics.overdue} invoice
                {invoiceMetrics.overdue ===
                1
                  ? ""
                  : "s"} require
                collection attention.
              </p>
            </div>
          </div>

          <div className="text-left md:text-right">
            <p className="text-xl font-bold text-red-900">
              {formatCurrency(
                summary.overdue
              )}
            </p>

            <button
              type="button"
              onClick={() => {
                setStatusFilter(
                  "OVERDUE"
                );
                setAgingFilter(
                  "ALL"
                );
              }}
              className="mt-1 text-sm font-semibold text-red-700 hover:text-red-900"
            >
              View overdue invoices
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================
          RECEIVABLES AGING
      =================================================== */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#20243A]">
              Receivables Aging
            </h2>

            <p className="mt-1 text-sm text-[#888DA3]">
              Outstanding balances grouped by days past due.
            </p>
          </div>

          {agingFilter !==
            "ALL" && (
            <button
              type="button"
              onClick={() =>
                setAgingFilter(
                  "ALL"
                )
              }
              className="text-sm font-semibold text-[#0D9488] hover:text-[#0B7F74]"
            >
              Clear aging filter
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AgingCard
            label="Current"
            value={
              agingSummary.current
            }
            total={
              summary.outstanding
            }
            active={
              agingFilter ===
              "CURRENT"
            }
            onClick={() =>
              setAgingFilter(
                agingFilter ===
                  "CURRENT"
                  ? "ALL"
                  : "CURRENT"
              )
            }
          />

          <AgingCard
            label="1–30 Days"
            value={
              agingSummary.days1to30
            }
            total={
              summary.outstanding
            }
            active={
              agingFilter ===
              "1–30 DAYS"
            }
            onClick={() =>
              setAgingFilter(
                agingFilter ===
                  "1–30 DAYS"
                  ? "ALL"
                  : "1–30 DAYS"
              )
            }
          />

          <AgingCard
            label="31–60 Days"
            value={
              agingSummary.days31to60
            }
            total={
              summary.outstanding
            }
            active={
              agingFilter ===
              "31–60 DAYS"
            }
            onClick={() =>
              setAgingFilter(
                agingFilter ===
                  "31–60 DAYS"
                  ? "ALL"
                  : "31–60 DAYS"
              )
            }
          />

          <AgingCard
            label="61–90 Days"
            value={
              agingSummary.days61to90
            }
            total={
              summary.outstanding
            }
            active={
              agingFilter ===
              "61–90 DAYS"
            }
            onClick={() =>
              setAgingFilter(
                agingFilter ===
                  "61–90 DAYS"
                  ? "ALL"
                  : "61–90 DAYS"
              )
            }
          />

          <AgingCard
            label="90+ Days"
            value={
              agingSummary.days90Plus
            }
            total={
              summary.outstanding
            }
            danger
            active={
              agingFilter ===
              "90+ DAYS"
            }
            onClick={() =>
              setAgingFilter(
                agingFilter ===
                  "90+ DAYS"
                  ? "ALL"
                  : "90+ DAYS"
              )
            }
          />
        </div>
      </div>

      {/* ===================================================
          CUSTOMER EXPOSURE
      =================================================== */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#ECECF3] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users
                size={19}
                className="text-[#0D9488]"
              />

              <h2 className="text-lg font-bold text-[#20243A]">
                Customer Exposure
              </h2>
            </div>

            <p className="mt-1 text-sm text-[#888DA3]">
              Customers ranked by outstanding receivable balance.
            </p>
          </div>

          <div className="flex gap-5 text-sm">
            <div>
              <span className="text-[#888DA3]">
                Customers
              </span>

              <span className="ml-2 font-semibold text-[#20243A]">
                {customerCount}
              </span>
            </div>

            <div>
              <span className="text-[#888DA3]">
                With balance
              </span>

              <span className="ml-2 font-semibold text-[#20243A]">
                {customersWithBalance}
              </span>
            </div>
          </div>
        </div>

        {customerExposure.length ===
        0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#888DA3]">
            No customer exposure is available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-[#ECECF3] bg-[#FAFBFD] text-xs uppercase tracking-wide text-[#888DA3]">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">
                    Customer
                  </th>

                  <th className="px-6 py-4 text-center font-semibold">
                    Invoices
                  </th>

                  <th className="px-6 py-4 text-right font-semibold">
                    Invoiced
                  </th>

                  <th className="px-6 py-4 text-right font-semibold">
                    Collected
                  </th>

                  <th className="px-6 py-4 text-right font-semibold">
                    Outstanding
                  </th>

                  <th className="px-6 py-4 text-right font-semibold">
                    Overdue
                  </th>
                </tr>
              </thead>

              <tbody>
                {customerExposure.map(
                  (
                    customer
                  ) => (
                    <tr
                      key={
                        customer.customerName
                      }
                      className="border-b border-[#ECECF3] last:border-b-0 hover:bg-[#FAFBFD]"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#20243A]">
                          {
                            customer.customerName
                          }
                        </div>

                        <div className="mt-1 text-xs text-[#888DA3]">
                          Customer receivable exposure
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center text-sm font-medium text-[#666B84]">
                        {
                          customer.invoiceCount
                        }
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-medium text-[#20243A]">
                        {formatCurrency(
                          customer.invoiced
                        )}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-medium text-emerald-600">
                        {formatCurrency(
                          customer.collected
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-[#20243A]">
                          {formatCurrency(
                            customer.outstanding
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {customer.overdue >
                        0 ? (
                          <span className="text-sm font-bold text-red-600">
                            {formatCurrency(
                              customer.overdue
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-[#888DA3]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================
          SEARCH + FILTERS
      =================================================== */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-[#ECECF3] bg-[#FAFBFD] px-3">
            <Search
              size={18}
              className="shrink-0 text-[#888DA3]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search customer, invoice or description..."
              className="flex-1 bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#9CA1B5]"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="text-[#888DA3] hover:text-[#20243A]"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div className="flex items-center rounded-xl border border-[#ECECF3] bg-[#FAFBFD] px-3">
            <Filter
              size={17}
              className="shrink-0 text-[#888DA3]"
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
              className="min-w-52 bg-transparent px-3 py-3 text-sm text-[#666B84] outline-none"
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

          <div className="flex items-center rounded-xl border border-[#ECECF3] bg-[#FAFBFD] px-3">
            <Clock3
              size={17}
              className="shrink-0 text-[#888DA3]"
            />

            <select
              value={
                agingFilter
              }
              onChange={(event) =>
                setAgingFilter(
                  event.target
                    .value as AgingFilter
                )
              }
              className="min-w-48 bg-transparent px-3 py-3 text-sm text-[#666B84] outline-none"
            >
              <option value="ALL">
                All Aging
              </option>

              <option value="CURRENT">
                Current
              </option>

              <option value="1–30 DAYS">
                1–30 Days
              </option>

              <option value="31–60 DAYS">
                31–60 Days
              </option>

              <option value="61–90 DAYS">
                61–90 Days
              </option>

              <option value="90+ DAYS">
                90+ Days
              </option>
            </select>
          </div>
        </div>

        {(search ||
          statusFilter !==
            "ALL" ||
          agingFilter !==
            "ALL") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#888DA3]">
              Active filters:
            </span>

            {search && (
              <FilterPill
                label={`Search: ${search}`}
                onRemove={() =>
                  setSearch("")
                }
              />
            )}

            {statusFilter !==
              "ALL" && (
              <FilterPill
                label={
                  statusFilter
                }
                onRemove={() =>
                  setStatusFilter(
                    "ALL"
                  )
                }
              />
            )}

            {agingFilter !==
              "ALL" && (
              <FilterPill
                label={
                  agingFilter
                }
                onRemove={() =>
                  setAgingFilter(
                    "ALL"
                  )
                }
              />
            )}

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter(
                  "ALL"
                );
                setAgingFilter(
                  "ALL"
                );
              }}
              className="ml-1 font-semibold text-[#0D9488] hover:text-[#0B7F74]"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ===================================================
          TABLE
      =================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
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
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC] text-[#888DA3]">
              <FileText
                size={30}
              />
            </div>

            <h3 className="mt-4 font-semibold text-[#20243A]">
              No invoices found
            </h3>

            <p className="mt-2 max-w-md text-sm text-[#888DA3]">
              Create an invoice or adjust your search, status or aging filters.
            </p>

            {(search ||
              statusFilter !==
                "ALL" ||
              agingFilter !==
                "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter(
                    "ALL"
                  );
                  setAgingFilter(
                    "ALL"
                  );
                }}
                className="mt-4 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B7F74]"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px]">
              <thead className="border-b border-[#ECECF3] bg-[#FAFBFD] text-xs uppercase tracking-wide text-[#888DA3]">
                <tr>
                  <th className="px-5 py-4 text-left font-semibold">
                    Customer
                  </th>

                  <th className="px-5 py-4 text-left font-semibold">
                    Invoice
                  </th>

                  <th className="px-5 py-4 text-left font-semibold">
                    Issue Date
                  </th>

                  <th className="px-5 py-4 text-left font-semibold">
                    Due Date
                  </th>

                  <th className="px-5 py-4 text-right font-semibold">
                    Amount
                  </th>

                  <th className="px-5 py-4 text-right font-semibold">
                    Outstanding
                  </th>

                  <th className="px-5 py-4 text-left font-semibold">
                    Collection
                  </th>

                  <th className="px-5 py-4 text-left font-semibold">
                    Aging
                  </th>

                  <th className="px-5 py-4 text-left font-semibold">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right font-semibold">
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

                    const aging =
                      getAgingBucket(
                        invoice
                      );

                    const daysOverdue =
                      getDaysOverdue(
                        invoice
                      );

                    const busy =
                      actionLoading &&
                      actionId ===
                        invoice.id;

                    const percentage =
                      getCollectionPercentage(
                        invoice
                      );

                    const amount =
                      Number(
                        invoice.amount
                      ) || 0;

                    const outstanding =
                      Number(
                        invoice.outstandingBalance
                      ) || 0;

                    const collected =
                      Math.max(
                        0,
                        amount -
                          outstanding
                      );

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-b border-[#ECECF3] last:border-b-0 transition hover:bg-[#FAFBFD]"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#20243A]">
                            {
                              invoice.customerName
                            }
                          </div>

                          <div className="mt-1 max-w-52 truncate text-xs text-[#888DA3]">
                            {
                              invoice.description
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-semibold text-[#20243A]">
                            {
                              invoice.invoiceNumber
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-[#666B84]">
                          {formatDate(
                            invoice.createdAt
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#666B84]">
                          {formatDate(
                            invoice.dueDate
                          )}
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-[#20243A]">
                          {formatCurrency(
                            amount
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="text-sm font-bold text-[#20243A]">
                            {formatCurrency(
                              outstanding
                            )}
                          </div>

                          {collected >
                            0 && (
                            <div className="mt-1 text-xs text-emerald-600">
                              {formatCurrency(
                                collected
                              )}{" "}
                              collected
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="min-w-36">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#20243A]">
                                {percentage.toFixed(
                                  0
                                )}
                                %
                              </span>

                              <span className="text-[11px] text-[#888DA3]">
                                collected
                              </span>
                            </div>

                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ECECF3]">
                              <div
                                className="h-full rounded-full bg-[#0D9488] transition-all"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getAgingClasses(
                                aging
                              )}`}
                            >
                              {
                                aging
                              }
                            </span>

                            {daysOverdue >
                              0 && (
                              <span className="text-[11px] font-medium text-red-600">
                                {daysOverdue}{" "}
                                day
                                {daysOverdue ===
                                1
                                  ? ""
                                  : "s"}{" "}
                                overdue
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              status
                            )}`}
                          >
                            {
                              status
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {busy ? (
                              <div className="flex h-9 w-9 items-center justify-center">
                                <Loader2
                                  size={
                                    17
                                  }
                                  className="animate-spin text-[#0D9488]"
                                />
                              </div>
                            ) : (
                              <>
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

                                <ActionButton
                                  title="Edit invoice"
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

                                {normalize(
                                  invoice.status
                                ) ===
                                  "APPROVED" &&
                                  outstanding >
                                    0 && (
                                    <ActionButton
                                      title="Record customer payment"
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
                                  title="Delete invoice"
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

      <div className="flex flex-col gap-1 text-sm text-[#888DA3] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing{" "}
          <strong className="text-[#20243A]">
            {
              filteredReceivables.length
            }
          </strong>{" "}
          of{" "}
          <strong className="text-[#20243A]">
            {receivables.length}
          </strong>{" "}
          invoices
        </span>

        {agingFilter !==
          "ALL" && (
          <span>
            Aging filter:{" "}
            <strong className="text-[#20243A]">
              {
                agingFilter
              }
            </strong>
          </span>
        )}
      </div>

      {/* ===================================================
          CREATE / EDIT MODAL
      =================================================== */}

      {showInvoiceForm && (
        <Modal
          title={
            editingInvoice
              ? "Edit Customer Invoice"
              : "New Customer Invoice"
          }
          description={
            editingInvoice
              ? "Update the invoice information before saving."
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
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-[#9CA1B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-[#9CA1B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-[#9CA1B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                className="w-full resize-none rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none transition placeholder:text-[#9CA1B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />
            </FormField>

            {form.amount &&
              Number(
                form.amount
              ) > 0 && (
                <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#666B84]">
                      Invoice total
                    </span>

                    <span className="text-lg font-bold text-[#20243A]">
                      {formatCurrency(
                        Number(
                          form.amount
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  closeInvoiceForm
                }
                className="rounded-xl border border-[#ECECF3] bg-white px-5 py-2.5 font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 font-semibold text-white hover:bg-[#0B7F74] disabled:opacity-50"
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

      {/* ===================================================
          DETAILS
      =================================================== */}

      {selectedInvoice &&
        !showPaymentForm &&
        !showInvoiceForm && (
          <Modal
            title={
              selectedInvoice.invoiceNumber
            }
            description="Customer invoice details and collection position."
            onClose={() =>
              setSelectedInvoice(
                null
              )
            }
          >
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-[#ECECF3] bg-[#FAFBFD] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#888DA3]">
                    Customer
                  </p>

                  <p className="mt-1 text-lg font-bold text-[#20243A]">
                    {
                      selectedInvoice.customerName
                    }
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                    getEffectiveStatus(
                      selectedInvoice
                    )
                  )}`}
                >
                  {getEffectiveStatus(
                    selectedInvoice
                  )}
                </span>
              </div>

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
                  label="Invoice Amount"
                  value={formatCurrency(
                    selectedInvoice.amount
                  )}
                />

                <Detail
                  label="Collected"
                  value={formatCurrency(
                    Math.max(
                      0,
                      Number(
                        selectedInvoice.amount
                      ) -
                        Number(
                          selectedInvoice.outstandingBalance
                        )
                    )
                  )}
                />

                <Detail
                  label="Outstanding"
                  value={formatCurrency(
                    selectedInvoice.outstandingBalance
                  )}
                />

                <Detail
                  label="Issue Date"
                  value={formatDate(
                    selectedInvoice.createdAt
                  )}
                />

                <Detail
                  label="Due Date"
                  value={formatDate(
                    selectedInvoice.dueDate
                  )}
                />

                <Detail
                  label="Aging"
                  value={getAgingBucket(
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

              <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#888DA3]">
                  Description
                </div>

                <div className="text-sm leading-6 text-[#666B84]">
                  {
                    selectedInvoice.description
                  }
                </div>
              </div>

              <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#20243A]">
                      Collection Progress
                    </p>

                    <p className="mt-1 text-xs text-[#888DA3]">
                      Amount collected against the original invoice.
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-[#20243A]">
                      {getCollectionPercentage(
                        selectedInvoice
                      ).toFixed(
                        1
                      )}
                      %
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#ECECF3]">
                  <div
                    className="h-full rounded-full bg-[#0D9488] transition-all"
                    style={{
                      width: `${getCollectionPercentage(
                        selectedInvoice
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-emerald-600">
                    Collected{" "}
                    {formatCurrency(
                      Math.max(
                        0,
                        Number(
                          selectedInvoice.amount
                        ) -
                          Number(
                            selectedInvoice.outstandingBalance
                          )
                      )
                    )}
                  </span>

                  <span className="font-medium text-[#666B84]">
                    Outstanding{" "}
                    {formatCurrency(
                      selectedInvoice.outstandingBalance
                    )}
                  </span>
                </div>
              </div>

              {getDaysOverdue(
                selectedInvoice
              ) > 0 &&
                Number(
                  selectedInvoice.outstandingBalance
                ) > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-3">
                      <Clock3
                        size={19}
                        className="text-red-700"
                      />

                      <div>
                        <p className="font-semibold text-red-900">
                          Payment overdue
                        </p>

                        <p className="mt-1 text-sm text-red-700">
                          This invoice is{" "}
                          {
                            getDaysOverdue(
                              selectedInvoice
                            )
                          }{" "}
                          day
                          {getDaysOverdue(
                            selectedInvoice
                          ) ===
                          1
                            ? ""
                            : "s"}{" "}
                          past its due date.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={() =>
                    openEditInvoice(
                      selectedInvoice
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 font-medium text-[#666B84] hover:bg-[#F8F9FC]"
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
                    className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 font-semibold text-white hover:bg-[#0B7F74] disabled:opacity-50"
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
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
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
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
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

      {/* ===================================================
          PAYMENT
      =================================================== */}

      {showPaymentForm &&
        selectedInvoice && (
          <Modal
            title="Record Customer Payment"
            description={`Apply a payment to ${selectedInvoice.invoiceNumber}.`}
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
              <div className="grid gap-4 sm:grid-cols-3">
                <Detail
                  label="Invoice Amount"
                  value={formatCurrency(
                    selectedInvoice.amount
                  )}
                />

                <Detail
                  label="Already Collected"
                  value={formatCurrency(
                    Math.max(
                      0,
                      Number(
                        selectedInvoice.amount
                      ) -
                        Number(
                          selectedInvoice.outstandingBalance
                        )
                    )
                  )}
                />

                <Detail
                  label="Outstanding"
                  value={formatCurrency(
                    selectedInvoice.outstandingBalance
                  )}
                />
              </div>

              <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-4">
                <div className="flex items-center gap-3">
                  <Users
                    size={18}
                    className="text-[#0D9488]"
                  />

                  <div>
                    <p className="text-sm font-semibold text-[#20243A]">
                      {
                        selectedInvoice.customerName
                      }
                    </p>

                    <p className="mt-0.5 text-xs text-[#888DA3]">
                      {
                        selectedInvoice.invoiceNumber
                      }
                    </p>
                  </div>
                </div>
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
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                  autoFocus
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-lg font-semibold text-[#20243A] outline-none transition placeholder:text-[#9CA1B5] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </FormField>

              {paymentAmount &&
                Number(
                  paymentAmount
                ) > 0 && (
                  <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#666B84]">
                        Remaining balance after payment
                      </span>

                      <span className="text-lg font-bold text-[#20243A]">
                        {formatCurrency(
                          Math.max(
                            0,
                            Number(
                              selectedInvoice.outstandingBalance
                            ) -
                              Number(
                                paymentAmount
                              )
                          )
                        )}
                      </span>
                    </div>
                  </div>
                )}

              <button
                type="button"
                onClick={() =>
                  setPaymentAmount(
                    String(
                      selectedInvoice.outstandingBalance
                    )
                  )
                }
                className="text-sm font-semibold text-[#0D9488] hover:text-[#0B7F74]"
              >
                Use full outstanding balance
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
                  className="rounded-xl border border-[#ECECF3] bg-white px-5 py-2.5 font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    actionLoading
                  }
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
  subtitle,
  icon,
  danger = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-[#666B84]">
          {title}
        </span>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            danger
              ? "bg-red-50 text-red-600"
              : "bg-[#0D9488]/10 text-[#0D9488]"
          }`}
        >
          {icon}
        </div>
      </div>

      <div
        className={`text-xl font-bold ${
          danger &&
          value !== "KES 0.00"
            ? "text-red-700"
            : "text-[#20243A]"
        }`}
      >
        {value}
      </div>

      <div className="mt-2 text-xs text-[#888DA3]">
        {subtitle}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-[#888DA3]">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-[#20243A]">
        {value}
      </div>
    </div>
  );
}

function StatusMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-3">
      <div className="text-xs text-[#888DA3]">
        {label}
      </div>

      <div className="mt-1 text-lg font-bold text-[#20243A]">
        {value}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#ECECF3] bg-[#FAFBFD] px-2.5 py-1 font-medium text-[#666B84] hover:bg-[#F1F3F7]"
    >
      {label}

      <X size={13} />
    </button>
  );
}

function AgingCard({
  label,
  value,
  total,
  danger = false,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  total: number;
  danger?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const percentage =
    total > 0
      ? Math.min(
          100,
          (value / total) *
            100
        )
      : 0;

  return (
    <div
      role={
        onClick
          ? "button"
          : undefined
      }
      tabIndex={
        onClick
          ? 0
          : undefined
      }
      onClick={onClick}
      onKeyDown={(event) => {
        if (
          onClick &&
          (event.key ===
            "Enter" ||
            event.key ===
              " ")
        ) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`rounded-xl border p-4 transition ${
        active
          ? "border-[#0D9488] bg-teal-50 ring-2 ring-[#0D9488]/10"
          : danger
            ? "border-red-100 bg-red-50/40"
            : "border-[#ECECF3] bg-[#FAFBFD]"
      } ${
        onClick
          ? "cursor-pointer hover:border-[#0D9488]/40 hover:shadow-sm"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-sm font-semibold ${
            danger
              ? "text-red-800"
              : "text-[#20243A]"
          }`}
        >
          {label}
        </span>

        <span className="text-xs font-medium text-[#888DA3]">
          {percentage.toFixed(
            0
          )}
          %
        </span>
      </div>

      <div
        className={`mt-3 text-lg font-bold ${
          danger
            ? "text-red-800"
            : "text-[#20243A]"
        }`}
      >
        {formatCurrency(
          value
        )}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ECECF3]">
        <div
          className={`h-full rounded-full ${
            danger
              ? "bg-red-500"
              : "bg-[#0D9488]"
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      {active && (
        <div className="mt-2 text-[11px] font-semibold text-[#0D9488]">
          Filter active
        </div>
      )}
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
      aria-label={title}
      onClick={onClick}
      className={
        danger
          ? "flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
          : "flex h-9 w-9 items-center justify-center rounded-lg border border-[#ECECF3] bg-white text-[#666B84] transition hover:border-[#0D9488]/40 hover:bg-[#0D9488]/10 hover:text-[#0D9488]"
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
      <span className="mb-2 block text-sm font-semibold text-[#666B84]">
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
    <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#888DA3]">
        {label}
      </div>

      <div className="break-words font-semibold text-[#20243A]">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#ECECF3] bg-white p-6">
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
            aria-label="Close"
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