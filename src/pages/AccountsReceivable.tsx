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
  RefreshCw,
  Search,
  Trash2,
  WalletCards,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  FormEvent,
  ReactNode,
} from "react";

import {
  approveReceivable,
  deleteReceivable,
  fetchReceivableById,
  fetchReceivables,
  recordReceivablePayment,
  updateReceivable,
} from "../services/accountsReceivable";

import type {
  Receivable,
  ReceivableInput,
  ReceivablePagination,
  ReceivableSummary,
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

interface ReceivablePaymentHistoryItem {
  id: string;
  reference: string;
  paymentReference?: string | null;
  amount: number;
  transactionDate: string;
  paymentAccount?: string;
  receivableAccount?: string;
}

interface ReceivableDetail extends Receivable {
  paymentHistory?: ReceivablePaymentHistoryItem[];
  paymentSummary?: {
    paymentCount: number;
    recordedPayments: number;
    expectedPayments: number;
    reconciliationDifference: number;
    reconciled: boolean;
  };
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

type ApiStatusFilter =
  | "ALL"
  | "PENDING APPROVAL"
  | "APPROVED"
  | "OUTSTANDING"
  | "PARTIALLY PAID"
  | "PAID"
  | "OVERDUE";

type ApiAgingFilter =
  | "ALL"
  | "CURRENT"
  | "1-30 DAYS"
  | "31-60 DAYS"
  | "61-90 DAYS"
  | "90+ DAYS";

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE_OPTIONS = [
  10,
  25,
  50,
  100,
] as const;

const DEFAULT_PAGE_SIZE = 25;

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
    maximumFractionDigits: 2,
  });

/* =========================================================
   HELPERS
========================================================= */

const formatCurrency = (
  value: number
): string => {
  const amount = Number(value);

  return currencyFormatter.format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
};

const parseDateValue = (value: string): Date => {
  const trimmed = value?.trim?.() ?? "";

  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed
      .split("-")
      .map(Number);

    return new Date(
      year,
      month - 1,
      day
    );
  }

  return new Date(trimmed);
};

const formatDate = (
  value: string
): string => {
  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
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
): string => {
  const trimmed = value?.trim?.() ?? "";

  if (/^\\d{4}-\\d{2}-\\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalize = (
  value?: string | null
): string => {
  return (
    value
      ?.trim()
      .toUpperCase()
      .replaceAll("_", " ") ??
    ""
  );
};

const toApiAgingFilter = (
  value: AgingFilter
): ApiAgingFilter => {
  switch (value) {
    case "1–30 DAYS":
      return "1-30 DAYS";

    case "31–60 DAYS":
      return "31-60 DAYS";

    case "61–90 DAYS":
      return "61-90 DAYS";

    default:
      return value;
  }
};

/* =========================================================
   LOCAL DISPLAY STATUS
========================================================= */

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

  if (
    approvalStatus !==
    "APPROVED"
  ) {
    return "PENDING APPROVAL";
  }

  if (
    outstanding > 0 &&
    getDaysOverdue(receivable) > 0
  ) {
    return "OVERDUE";
  }

  return "OUTSTANDING";
};

/* =========================================================
   AGING
========================================================= */

const getDaysOverdue = (
  receivable: Receivable
): number => {
  const outstanding =
    Number(
      receivable.outstandingBalance
    ) || 0;

  if (outstanding <= 0) {
    return 0;
  }

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

  return Math.max(
    0,
    Math.floor(
      (
        today.getTime() -
        dueDate.getTime()
      ) /
        (1000 * 60 * 60 * 24)
    )
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

/* =========================================================
   STYLING HELPERS
========================================================= */

const getStatusClasses = (
  status: string
): string => {
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

const getAgingClasses = (
  aging: string
): string => {
  switch (aging) {
    case "CURRENT":
      return "text-teal-700";

    case "1–30 DAYS":
      return "text-amber-600";

    case "31–60 DAYS":
      return "text-orange-600";

    case "61–90 DAYS":
      return "text-red-500";

    case "90+ DAYS":
      return "font-bold text-red-700";

    default:
      return "text-[#666B84]";
  }
};

/* =========================================================
   COMPONENT
========================================================= */

export default function AccountsReceivable() {
  /* =======================================================
     DATA
  ======================================================= */

  const [
    receivables,
    setReceivables,
  ] = useState<Receivable[]>([]);

  const [
    pagination,
    setPagination,
  ] = useState<ReceivablePagination>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [
    serverSummary,
    setServerSummary,
  ] = useState<ReceivableSummary>({
    totalInvoiced: 0,
    totalOutstanding: 0,
    totalCollected: 0,
    totalOverdue: 0,
    overdueCount: 0,
  });

  /* =======================================================
     UI STATE
  ======================================================= */

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

  /* =======================================================
     FILTER STATE
  ======================================================= */

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>(
    "ALL"
  );

  const [
    agingFilter,
    setAgingFilter,
  ] = useState<AgingFilter>(
    "ALL"
  );

  const [
    pageSize,
    setPageSize,
  ] = useState(
    DEFAULT_PAGE_SIZE
  );

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  /* =======================================================
     MODAL STATE
  ======================================================= */

  const [
    selectedInvoice,
    setSelectedInvoice,
  ] = useState<ReceivableDetail | null>(
    null
  );

  const [
    editingInvoice,
    setEditingInvoice,
  ] = useState<Receivable | null>(
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
  ] = useState<InvoiceForm>(
    initialForm
  );

  const requestSequence =
    useRef(0);

  const successTimer =
    useRef<number | null>(null);

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState<Date | null>(null);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  /* =======================================================
     SUCCESS MESSAGE
  ======================================================= */

  const showSuccess = useCallback(
    (message: string) => {
      setError("");

      if (
        successTimer.current !==
        null
      ) {
        window.clearTimeout(
          successTimer.current
        );
      }

      setSuccessMessage(
        message
      );

      successTimer.current =
        window.setTimeout(() => {
          setSuccessMessage("");
          successTimer.current =
            null;
        }, 3500);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (
        successTimer.current !==
        null
      ) {
        window.clearTimeout(
          successTimer.current
        );
      }
    };
  }, []);

  /* =======================================================
     LOAD RECEIVABLES
  ======================================================= */

  const loadReceivables =
    useCallback(
      async (
        requestedPage = currentPage,
        requestedPageSize = pageSize,
        showLoader = true
      ) => {
        const sequence =
          ++requestSequence.current;

        if (showLoader) {
          setLoading(true);
        }

        setError("");

        try {
          const response =
            await fetchReceivables({
              page: requestedPage,
              pageSize:
                requestedPageSize,
              search,
              status:
                statusFilter as ApiStatusFilter,
              aging:
                toApiAgingFilter(
                  agingFilter
                ),
            });

          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          const nextReceivables =
            response.receivables ??
            [];

          setReceivables(
            nextReceivables
          );

          if (
            response.pagination
          ) {
            const nextPagination =
              response.pagination;

            setPagination(
              nextPagination
            );

            if (
              nextPagination.page !==
                currentPage &&
              nextPagination.page >=
                1
            ) {
              setCurrentPage(
                nextPagination.page
              );
            }
          } else {
            const total =
              response.count ??
              nextReceivables.length;

            const totalPages =
              Math.max(
                1,
                Math.ceil(
                  total /
                    requestedPageSize
                )
              );

            setPagination({
              page:
                requestedPage,
              pageSize:
                requestedPageSize,
              total,
              totalPages,
            });
          }

          if (
            response.summary
          ) {
            setServerSummary(
              response.summary
            );
          }

          setLastUpdatedAt(
            new Date()
          );
        } catch (err) {
          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load accounts receivable."
          );
        } finally {
          if (
            sequence ===
              requestSequence.current &&
            showLoader
          ) {
            setLoading(false);
          }
        }
      },
      [
        currentPage,
        pageSize,
        search,
        statusFilter,
        agingFilter,
      ]
    );

  /* =======================================================
     INITIAL / FILTERED LOAD
  ======================================================= */

  useEffect(() => {
    void loadReceivables(
      currentPage,
      pageSize,
      true
    );
  }, [
    loadReceivables,
    currentPage,
    pageSize,
  ]);

  /* =======================================================
     SEARCH DEBOUNCE
  ======================================================= */

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        setSearch(
          searchInput.trim()
        );

        setCurrentPage(1);
      }, 350);

    return () =>
      window.clearTimeout(
        timer
      );
  }, [searchInput]);

  /* =======================================================
     FILTER CHANGES
  ======================================================= */

  const handleStatusChange = (
    value: StatusFilter
  ) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleAgingChange = (
    value: AgingFilter
  ) => {
    setAgingFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (
    value: number
  ) => {
    setPageSize(value);
    setCurrentPage(1);
  };

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    serverSummary;

  const collectionRate =
    useMemo(() => {
      if (
        summary.totalInvoiced <=
        0
      ) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          (
            summary.totalCollected /
            summary.totalInvoiced
          ) * 100
        )
      );
    }, [
      summary.totalInvoiced,
      summary.totalCollected,
    ]);

  /* =======================================================
     PAGE-LEVEL METRICS
  ======================================================= */

  const pageMetrics =
    useMemo(() => {
      return receivables.reduce(
        (totals, invoice) => {
          const status =
            getEffectiveStatus(
              invoice
            );

          if (
            status === "PAID"
          ) {
            totals.paid += 1;
          }

          if (
            status ===
            "PARTIALLY PAID"
          ) {
            totals.partial += 1;
          }

          if (
            status ===
            "PENDING APPROVAL"
          ) {
            totals.pending += 1;
          }

          return totals;
        },
        {
          paid: 0,
          partial: 0,
          pending: 0,
        }
      );
    }, [receivables]);

  /* =======================================================
     CURRENT PAGE AGING
  ======================================================= */

  const agingSummary =
    useMemo(() => {
      const result = {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90Plus: 0,
      };

      receivables.forEach(
        (invoice) => {
          const outstanding =
            Number(
              invoice.outstandingBalance
            ) || 0;

          if (
            outstanding <= 0
          ) {
            return;
          }

          switch (
            getAgingBucket(
              invoice
            )
          ) {
            case "CURRENT":
              result.current +=
                outstanding;
              break;

            case "1–30 DAYS":
              result.days1to30 +=
                outstanding;
              break;

            case "31–60 DAYS":
              result.days31to60 +=
                outstanding;
              break;

            case "61–90 DAYS":
              result.days61to90 +=
                outstanding;
              break;

            case "90+ DAYS":
              result.days90Plus +=
                outstanding;
              break;
          }
        }
      );

      return result;
    }, [receivables]);

  /* =======================================================
     EDIT INVOICE
  ======================================================= */

  const openEditInvoice = (
    invoice: Receivable
  ) => {
    if (
      normalize(invoice.status) !==
      "PENDING"
    ) {
      setError(
        "Only receivables pending approval can be edited."
      );
      return;
    }

    setError("");

    setEditingInvoice(
      invoice
    );

    setForm({
      invoiceNumber:
        invoice.invoiceNumber ??
        "",
      customerName:
        invoice.customerName ??
        "",
      description:
        invoice.description ??
        "",
      amount: String(
        invoice.amount ?? ""
      ),
      dueDate:
        toDateInput(
          invoice.dueDate
        ),
    });

    setShowInvoiceForm(
      true
    );
  };

  /* =======================================================
     VIEW INVOICE
  ======================================================= */

  const openViewInvoice = (
    invoice: Receivable
  ) => {
    setSelectedInvoice(
      invoice
    );

    setError("");
    setDetailLoading(true);

    void fetchReceivableById(
      invoice.id
    )
      .then((response) => {
        setSelectedInvoice(
          (current) =>
            current?.id ===
            invoice.id
              ? (response.receivable as ReceivableDetail)
              : current
        );
      })
      .catch(() => {
        // The list record remains usable when the detail request fails.
        // The user can refresh or reopen the invoice to retry.
      })
      .finally(() => {
        setDetailLoading(false);
      });
  };

  /* =======================================================
     CLOSE EDIT
  ======================================================= */

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

      setError("");
    };

  /* =======================================================
     CLOSE PAYMENT
  ======================================================= */

  const closePaymentForm =
    () => {
      if (actionLoading) {
        return;
      }

      setShowPaymentForm(
        false
      );

      setPaymentAmount(
        ""
      );
    };

  /* =======================================================
     CLOSE VIEW
  ======================================================= */

  const closeViewModal = () => {
    setSelectedInvoice(
      null
    );
  };

  /* =======================================================
     UPDATE INVOICE
  ======================================================= */

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    if (!editingInvoice) {
      setError(
        "Invoices must be created from the Invoicing module."
      );

      return;
    }

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
      !Number.isFinite(amount) ||
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

    const hasPayment =
      Number(
        editingInvoice.outstandingBalance
      ) !==
      Number(
        editingInvoice.amount
      );

    if (hasPayment) {
      setError(
        "Invoices with recorded payments cannot have their accounting amount changed."
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
      const response =
        await updateReceivable(
          editingInvoice.id,
          payload
        );

      showSuccess(
        response.message ??
          "Invoice updated successfully."
      );

      setShowInvoiceForm(
        false
      );

      setEditingInvoice(
        null
      );

      setForm(
        initialForm
      );

      await loadReceivables(
        currentPage,
        pageSize,
        false
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update invoice."
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
        ) !== "PENDING"
      ) {
        setError(
          "Only receivables pending approval can be approved."
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

      setActionLoading(true);
      setActionId(
        invoice.id
      );
      setError("");

      try {
        const response =
          await approveReceivable(
            invoice.id
          );

        showSuccess(
          response.message ??
            "Invoice approved successfully."
        );

        await loadReceivables(
          currentPage,
          pageSize,
          false
        );

        if (
          selectedInvoice?.id ===
          invoice.id
        ) {
          setSelectedInvoice(
            response.receivable
          );
        }
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
     PAYMENT FORM
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

    setPaymentAmount(
      ""
    );

    setShowPaymentForm(
      true
    );
  };

  /* =======================================================
     RECORD PAYMENT
  ======================================================= */

  const handlePayment = async (
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
      !Number.isFinite(amount) ||
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

    setActionLoading(true);

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

      setSelectedInvoice(
        response.receivable
      );

      setShowPaymentForm(
        false
      );

      setPaymentAmount(
        ""
      );

      showSuccess(
        response.message ??
          "Customer payment recorded successfully."
      );

      await loadReceivables(
        currentPage,
        pageSize,
        false
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
        Number(
          invoice.amount
        );

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

      setActionLoading(true);

      setActionId(
        invoice.id
      );

      setError("");

      try {
        const response =
          await deleteReceivable(
            invoice.id
          );

        showSuccess(
          response.message ??
            "Invoice deleted successfully."
        );

        if (
          selectedInvoice?.id ===
          invoice.id
        ) {
          setSelectedInvoice(
            null
          );
        }

        /*
         * If the current page becomes empty
         * after deletion, move back one page.
         */
        const nextTotal =
          Math.max(
            0,
            pagination.total - 1
          );

        const nextTotalPages =
          Math.max(
            1,
            Math.ceil(
              nextTotal /
                pageSize
            )
          );

        const nextPage =
          Math.min(
            currentPage,
            nextTotalPages
          );

        if (
          nextPage !==
          currentPage
        ) {
          setCurrentPage(
            nextPage
          );
        } else {
          await loadReceivables(
            currentPage,
            pageSize,
            false
          );
        }
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
     FILTER CLEAR
  ======================================================= */

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter(
      "ALL"
    );
    setAgingFilter(
      "ALL"
    );
    setCurrentPage(1);
  };

  const hasFilters =
    Boolean(
      searchInput.trim()
    ) ||
    statusFilter !==
      "ALL" ||
    agingFilter !==
      "ALL";

  /* =======================================================
     OVERDUE VIEW
  ======================================================= */

  const viewOverdueInvoices =
    () => {
      setSearchInput("");
      setSearch("");
      setStatusFilter(
        "OVERDUE"
      );
      setAgingFilter(
        "ALL"
      );
      setCurrentPage(1);

      window.setTimeout(() => {
        document
          .getElementById(
            "receivables-table"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",
            block: "start",
          });
      }, 50);
    };

  /* =======================================================
     PAGINATION
  ======================================================= */

  const goToPage = (
    page: number
  ) => {
    const safePage =
      Math.max(
        1,
        Math.min(
          page,
          pagination.totalPages
        )
      );

    if (
      safePage ===
      currentPage
    ) {
      return;
    }

    setCurrentPage(
      safePage
    );
  };

  const paginationStart =
    pagination.total === 0
      ? 0
      : (
          (
            pagination.page -
            1
          ) *
            pagination.pageSize
        ) + 1;

  const paginationEnd =
    Math.min(
      pagination.page *
        pagination.pageSize,
      pagination.total
    );

  /* =======================================================
     PAGE NUMBERS
  ======================================================= */

  const pageNumbers =
    useMemo(() => {
      const totalPages =
        pagination.totalPages;

      const current =
        pagination.page;

      if (totalPages <= 7) {
        return Array.from(
          {
            length:
              totalPages,
          },
          (_, index) =>
            index + 1
        );
      }

      if (current <= 4) {
        return [
          1,
          2,
          3,
          4,
          5,
          -1,
          totalPages,
        ];
      }

      if (
        current >=
        totalPages - 3
      ) {
        return [
          1,
          -1,
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      }

      return [
        1,
        -1,
        current - 1,
        current,
        current + 1,
        -1,
        totalPages,
      ];
    }, [
      pagination.totalPages,
      pagination.page,
    ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6 pb-10">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>
          <div className="flex items-center gap-2 text-sm text-[#888DA3]">
            <span>
              Finance
            </span>

            <span>
              /
            </span>

            <span className="font-medium text-[#666B84]">
              Accounts Receivable
            </span>
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
            Accounts Receivable
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666B84]">
            Monitor customer invoices,
            collections, outstanding
            balances and overdue
            exposure from one
            financial workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          {lastUpdatedAt && (
            <div className="self-center text-xs text-[#888DA3]">
              Updated{" "}
              {lastUpdatedAt.toLocaleTimeString(
                "en-KE",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void loadReceivables(
                currentPage,
                pageSize,
                true
              )
            }
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] shadow-sm transition hover:bg-[#F8F9FC] disabled:opacity-50"
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

          <span className="flex-1 text-sm">
            {error}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void loadReceivables(
                  currentPage,
                  pageSize,
                  true
                )
              }
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="rounded-lg p-1 transition hover:bg-red-100"
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>

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
            summary.totalInvoiced
          )}
          subtitle={`${pagination.total} invoice${
            pagination.total ===
            1
              ? ""
              : "s"
          }`}
          icon={
            <FileText
              size={21}
            />
          }
        />

        <SummaryCard
          title="Outstanding"
          value={formatCurrency(
            summary.totalOutstanding
          )}
          subtitle="Customer balances to collect"
          icon={
            <WalletCards
              size={21}
            />
          }
        />

        <SummaryCard
          title="Collected"
          value={formatCurrency(
            summary.totalCollected
          )}
          subtitle={`${collectionRate.toFixed(
            1
          )}% collection rate`}
          icon={
            <Banknote
              size={21}
            />
          }
        />

        <SummaryCard
          title="Overdue"
          value={formatCurrency(
            summary.totalOverdue
          )}
          subtitle={`${summary.overdueCount} overdue invoice${
            summary.overdueCount ===
            1
              ? ""
              : "s"
          }`}
          icon={
            <Clock3
              size={21}
            />
          }
          danger={
            summary.totalOverdue >
            0
          }
        />

      </div>

      {/* ===================================================
          SECONDARY METRICS
      =================================================== */}

      <div className="grid gap-4 md:grid-cols-3">

        <MiniMetric
          label="Paid invoices"
          value={String(
            pageMetrics.paid
          )}
          description="Fully settled on current page"
          icon={
            <CheckCircle2
              size={18}
            />
          }
        />

        <MiniMetric
          label="Partially paid"
          value={String(
            pageMetrics.partial
          )}
          description="Remaining balances on current page"
          icon={
            <Banknote
              size={18}
            />
          }
        />

        <MiniMetric
          label="Pending approval"
          value={String(
            pageMetrics.pending
          )}
          description="Awaiting approval on current page"
          icon={
            <Clock3
              size={18}
            />
          }
        />

      </div>

      {/* ===================================================
          COLLECTION PERFORMANCE
      =================================================== */}

      <div className="grid gap-6 lg:grid-cols-3">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm lg:col-span-2">

          <div className="flex items-start justify-between gap-4">

            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Collection Performance
              </p>

              <h2 className="mt-2 text-2xl font-bold text-[#20243A]">
                {collectionRate.toFixed(
                  1
                )}
                %
              </h2>

              <p className="mt-1 text-sm text-[#888DA3]">
                of invoiced value has been collected
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-[#0D9488]">
              <CheckCircle2
                size={22}
              />
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

          <div className="mt-3 flex items-center justify-between text-xs text-[#888DA3]">

            <span>
              Collected{" "}
              {formatCurrency(
                summary.totalCollected
              )}
            </span>

            <span>
              Total{" "}
              {formatCurrency(
                summary.totalInvoiced
              )}
            </span>

          </div>

        </div>

        <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Overdue Exposure
              </p>

              <h2 className="mt-2 text-2xl font-bold text-red-600">
                {formatCurrency(
                  summary.totalOverdue
                )}
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle
                size={22}
              />
            </div>

          </div>

          <p className="mt-4 text-sm leading-6 text-[#666B84]">
            {summary.overdueCount} invoice
            {summary.overdueCount ===
            1
              ? ""
              : "s"}{" "}
            require
            {summary.overdueCount ===
            1
              ? "s"
              : ""}{" "}
            collection attention.
          </p>

          <div className="mt-5 rounded-xl bg-red-50 px-4 py-3">

            <div className="flex items-center justify-between">

              <span className="text-xs font-medium text-red-700">
                Share of outstanding
              </span>

              <span className="text-sm font-bold text-red-700">

                {summary.totalOutstanding >
                0
                  ? (
                      (
                        summary.totalOverdue /
                        summary.totalOutstanding
                      ) *
                      100
                    ).toFixed(
                      1
                    )
                  : "0.0"}

                %

              </span>

            </div>

          </div>

          <button
            type="button"
            onClick={
              viewOverdueInvoices
            }
            className="mt-5 flex w-full items-center justify-between rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-1"
          >
            <span>
              View overdue invoices
            </span>

            <span
              aria-hidden="true"
              className="text-lg leading-none"
            >
              →
            </span>
          </button>

        </div>

      </div>

      {/* ===================================================
          AGING
      =================================================== */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="text-lg font-bold text-[#20243A]">
              Receivables Aging
            </h2>

            <p className="mt-1 text-sm text-[#666B84]">
              Aging distribution for the currently loaded page.
            </p>
          </div>

          <div className="rounded-lg bg-[#F8F9FC] px-3 py-2 text-sm">

            <span className="text-[#888DA3]">
              Portfolio outstanding
            </span>

            <span className="ml-2 font-semibold text-[#20243A]">
              {formatCurrency(
                summary.totalOutstanding
              )}
            </span>

          </div>

        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

          <AgingCard
            label="Current"
            value={
              agingSummary.current
            }
            total={Math.max(
              summary.totalOutstanding,
              0
            )}
          />

          <AgingCard
            label="1–30 Days"
            value={
              agingSummary.days1to30
            }
            total={Math.max(
              summary.totalOutstanding,
              0
            )}
          />

          <AgingCard
            label="31–60 Days"
            value={
              agingSummary.days31to60
            }
            total={Math.max(
              summary.totalOutstanding,
              0
            )}
          />

          <AgingCard
            label="61–90 Days"
            value={
              agingSummary.days61to90
            }
            total={Math.max(
              summary.totalOutstanding,
              0
            )}
          />

          <AgingCard
            label="90+ Days"
            value={
              agingSummary.days90Plus
            }
            total={Math.max(
              summary.totalOutstanding,
              0
            )}
            danger
          />

        </div>

      </div>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-3 xl:flex-row">

          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[#ECECF3] bg-[#FAFBFD] px-3">

            <Search
              size={18}
              className="shrink-0 text-[#888DA3]"
            />

            <input
              type="text"
              value={
                searchInput
              }
              onChange={(event) =>
                setSearchInput(
                  event.target
                    .value
                )
              }
              placeholder="Search customer, invoice or description..."
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A4B5]"
            />

            {searchInput && (
              <button
                type="button"
                onClick={() =>
                  setSearchInput(
                    ""
                  )
                }
                className="rounded-lg p-1 text-[#888DA3] hover:bg-[#ECECF3] hover:text-[#20243A]"
              >
                <X size={17} />
              </button>
            )}

          </div>

          <div className="flex items-center rounded-xl border border-[#ECECF3] bg-[#FAFBFD] px-3">

            <Filter
              size={17}
              className="text-[#888DA3]"
            />

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                handleStatusChange(
                  event.target
                    .value as StatusFilter
                )
              }
              className="min-w-48 bg-transparent px-3 py-3 text-sm text-[#666B84] outline-none"
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
              className="text-[#888DA3]"
            />

            <select
              value={
                agingFilter
              }
              onChange={(event) =>
                handleAgingChange(
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

          {hasFilters && (
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC]"
            >
              Clear filters
            </button>
          )}

        </div>

      </div>

      {/* ===================================================
          TABLE
      =================================================== */}

      <div
        id="receivables-table"
        className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm"
      >

        <div className="flex flex-col gap-3 border-b border-[#ECECF3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="font-semibold text-[#20243A]">
              Customer Receivables
            </h2>

            <p className="mt-1 text-xs text-[#888DA3]">
              {pagination.total ===
              0
                ? "No invoices"
                : `Showing ${paginationStart.toLocaleString()}–${paginationEnd.toLocaleString()} of ${pagination.total.toLocaleString()} invoices`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            <div className="text-xs text-[#888DA3]">
              Outstanding{" "}
              <span className="font-semibold text-[#20243A]">
                {formatCurrency(
                  summary.totalOutstanding
                )}
              </span>
            </div>

            <select
              value={
                pageSize
              }
              onChange={(event) =>
                handlePageSizeChange(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              className="rounded-lg border border-[#ECECF3] bg-white px-3 py-2 text-xs font-medium text-[#666B84] outline-none focus:border-[#0D9488]"
            >
              {PAGE_SIZE_OPTIONS.map(
                (size) => (
                  <option
                    key={size}
                    value={size}
                  >
                    {size} / page
                  </option>
                )
              )}
            </select>

          </div>

        </div>

        {loading ? (

          <div className="flex min-h-72 items-center justify-center gap-3 text-[#666B84]">

            <Loader2
              size={22}
              className="animate-spin"
            />

            <span className="text-sm">
              Loading receivables...
            </span>

          </div>

        ) : receivables.length ===
          0 ? (

          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC] text-[#888DA3]">

              <FileText
                size={28}
              />

            </div>

            <h3 className="mt-4 font-semibold text-[#20243A]">
              No invoices found
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#666B84]">
              No receivables match
              the current search
              and filter criteria.
            </p>

            {hasFilters && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="mt-4 rounded-xl border border-[#ECECF3] px-4 py-2 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC]"
              >
                Clear filters
              </button>
            )}

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1500px]">

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

                {receivables.map(
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

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-b border-[#ECECF3] last:border-b-0 transition hover:bg-[#FAFBFD]"
                      >

                        <td className="px-5 py-4">

                          <div className="font-medium text-[#20243A]">
                            {
                              invoice.customerName
                            }
                          </div>

                          <div className="mt-1 max-w-56 truncate text-xs text-[#888DA3]">
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

                        <td className="px-5 py-4">

                          <span
                            className={
                              status ===
                              "OVERDUE"
                                ? "text-sm font-semibold text-red-600"
                                : "text-sm text-[#666B84]"
                            }
                          >
                            {formatDate(
                              invoice.dueDate
                            )}
                          </span>

                          {status ===
                            "OVERDUE" && (
                            <div className="mt-1 text-xs text-red-500">
                              {
                                daysOverdue
                              }{" "}
                              day
                              {daysOverdue ===
                              1
                                ? ""
                                : "s"}{" "}
                              overdue
                            </div>
                          )}

                        </td>

                        <td className="px-5 py-4 text-right text-sm font-medium text-[#20243A]">
                          {formatCurrency(
                            invoice.amount
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">

                          <span className="text-sm font-semibold text-[#20243A]">
                            {formatCurrency(
                              invoice.outstandingBalance
                            )}
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          {Number(
                            invoice.outstandingBalance
                          ) <= 0 ? (

                            <span className="text-sm font-medium text-emerald-600">
                              Paid
                            </span>

                          ) : (

                            <div>

                              <span
                                className={`text-sm font-semibold ${getAgingClasses(
                                  aging
                                )}`}
                              >
                                {aging ===
                                "CURRENT"
                                  ? "Current"
                                  : `${daysOverdue} days`}
                              </span>

                              <p className="mt-0.5 text-xs text-[#888DA3]">
                                {aging ===
                                "CURRENT"
                                  ? "Not overdue"
                                  : aging}
                              </p>

                            </div>

                          )}

                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                              status
                            )}`}
                          >
                            {status}
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-2">

                            {busy ? (

                              <div className="flex h-9 w-9 items-center justify-center">

                                <Loader2
                                  size={17}
                                  className="animate-spin text-[#0D9488]"
                                />

                              </div>

                            ) : (

                              <>

                                <ActionButton
                                  title="View invoice"
                                  onClick={() =>
                                    openViewInvoice(
                                      invoice
                                    )
                                  }
                                >
                                  <Eye
                                    size={17}
                                  />
                                </ActionButton>

                                {normalize(
                                  invoice.status
                                ) === "PENDING" && (
                                  <ActionButton
                                    title="Edit invoice"
                                    disabled={
                                      actionLoading
                                    }
                                    onClick={() =>
                                      openEditInvoice(
                                        invoice
                                      )
                                    }
                                  >
                                    <Edit3
                                      size={17}
                                    />
                                  </ActionButton>
                                )}

                                {normalize(
                                  invoice.status
                                ) ===
                                  "PENDING" && (
                                  <ActionButton
                                    title="Approve invoice"
                                    onClick={() =>
                                      void handleApprove(
                                        invoice
                                      )
                                    }
                                  >
                                    <CheckCircle2
                                      size={17}
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
                                      size={17}
                                    />
                                  </ActionButton>
                                )}

                                {normalize(
                                  invoice.status
                                ) === "PENDING" && (
                                  <ActionButton
                                    title="Delete invoice"
                                    danger
                                    disabled={actionLoading}
                                    onClick={() =>
                                      void handleDelete(
                                        invoice
                                      )
                                    }
                                  >
                                    <Trash2
                                      size={17}
                                    />
                                  </ActionButton>
                                )}

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

        {/* =================================================
            PAGINATION
        ================================================= */}

        {!loading &&
          pagination.total >
            0 && (
            <div className="flex flex-col gap-4 border-t border-[#ECECF3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-xs text-[#888DA3]">
                Showing{" "}
                <span className="font-semibold text-[#666B84]">
                  {paginationStart.toLocaleString()}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[#666B84]">
                  {paginationEnd.toLocaleString()}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[#666B84]">
                  {pagination.total.toLocaleString()}
                </span>
              </p>

              <div className="flex items-center gap-1">

                <button
                  type="button"
                  disabled={
                    pagination.page <=
                      1 ||
                    loading
                  }
                  onClick={() =>
                    goToPage(
                      pagination.page -
                        1
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ECECF3] bg-white text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft
                    size={17}
                  />
                </button>

                {pageNumbers.map(
                  (
                    page,
                    index
                  ) =>
                    page === -1 ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="flex h-9 w-9 items-center justify-center text-sm text-[#888DA3]"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={() =>
                          goToPage(
                            page
                          )
                        }
                        className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-medium transition ${
                          pagination.page ===
                          page
                            ? "border-[#0D9488] bg-[#0D9488] text-white"
                            : "border-[#ECECF3] bg-white text-[#666B84] hover:bg-[#F8F9FC]"
                        }`}
                      >
                        {page}
                      </button>
                    )
                )}

                <button
                  type="button"
                  disabled={
                    pagination.page >=
                      pagination.totalPages ||
                    loading
                  }
                  onClick={() =>
                    goToPage(
                      pagination.page +
                        1
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ECECF3] bg-white text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>

              </div>

            </div>
          )}

      </div>

      {/* ===================================================
          VIEW INVOICE MODAL
      =================================================== */}

      {selectedInvoice &&
        !showPaymentForm && (
          <Modal
            title="Customer Invoice"
            description="Review the receivable transaction and current customer balance."
            onClose={
              closeViewModal
            }
          >

            <div className="space-y-5">

              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0D9488]">
                      Invoice
                    </p>

                    <h3 className="mt-1 text-2xl font-bold text-[#20243A]">
                      {
                        selectedInvoice.invoiceNumber
                      }
                    </h3>

                    <p className="mt-1 text-sm text-[#666B84]">
                      {
                        selectedInvoice.customerName
                      }
                    </p>

                    {detailLoading && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#0D9488]">
                        <Loader2
                          size={13}
                          className="animate-spin"
                        />
                        Refreshing financial details...
                      </div>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
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

              </div>

              <div className="grid gap-4 sm:grid-cols-2">

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
                  label="Invoice Amount"
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
                  label="Payment Status"
                  value={normalize(
                    selectedInvoice.paymentStatus
                  )}
                />

                <Detail
                  label="Approval Status"
                  value={normalize(
                    selectedInvoice.status
                  )}
                />

                <Detail
                  label="Created"
                  value={formatDate(
                    selectedInvoice.createdAt
                  )}
                />

              </div>

              <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-4">

                <p className="text-xs font-semibold uppercase tracking-wider text-[#888DA3]">
                  Description
                </p>

                <p className="mt-2 text-sm leading-6 text-[#666B84]">
                  {
                    selectedInvoice.description
                  }
                </p>

              </div>

              {selectedInvoice.paymentSummary && (
                <div className="rounded-xl border border-[#ECECF3] bg-[#FAFBFD] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">
                        Payment history
                      </p>
                      <p className="mt-1 text-xs text-[#888DA3]">
                        Recorded receipts against this receivable.
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedInvoice.paymentSummary.reconciled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {selectedInvoice.paymentSummary.reconciled
                        ? "Reconciled"
                        : "Review"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Detail
                      label="Payments"
                      value={String(
                        selectedInvoice.paymentSummary.paymentCount
                      )}
                    />
                    <Detail
                      label="Recorded"
                      value={formatCurrency(
                        selectedInvoice.paymentSummary.recordedPayments
                      )}
                    />
                    <Detail
                      label="Expected"
                      value={formatCurrency(
                        selectedInvoice.paymentSummary.expectedPayments
                      )}
                    />
                  </div>

                  {selectedInvoice.paymentHistory &&
                    selectedInvoice.paymentHistory.length > 0 && (
                      <div className="mt-4 overflow-x-auto rounded-lg border border-[#ECECF3] bg-white">
                        <table className="w-full min-w-[620px] text-sm">
                          <thead className="border-b border-[#ECECF3] bg-[#FAFBFD] text-xs uppercase tracking-wide text-[#888DA3]">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left font-semibold">
                                Reference
                              </th>
                              <th className="px-4 py-3 text-left font-semibold">
                                Account
                              </th>
                              <th className="px-4 py-3 text-right font-semibold">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInvoice.paymentHistory.map(
                              (payment) => (
                                <tr
                                  key={payment.id}
                                  className="border-b border-[#ECECF3] last:border-b-0"
                                >
                                  <td className="px-4 py-3 text-[#666B84]">
                                    {formatDate(
                                      payment.transactionDate
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-[#20243A]">
                                      {payment.paymentReference ||
                                        payment.reference}
                                    </div>
                                    {payment.paymentReference &&
                                      payment.paymentReference !==
                                        payment.reference && (
                                        <div className="mt-0.5 text-xs text-[#888DA3]">
                                          {payment.reference}
                                        </div>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 text-[#666B84]">
                                    {payment.paymentAccount || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-[#20243A]">
                                    {formatCurrency(
                                      payment.amount
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
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">

                {normalize(
                  selectedInvoice.status
                ) ===
                  "PENDING" && (
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
                    className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F766E] disabled:opacity-50"
                  >
                    <CheckCircle2
                      size={18}
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
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <Banknote
                      size={18}
                    />
                    Record Payment
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    closeViewModal
                  }
                  className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC]"
                >
                  Close
                </button>

              </div>

            </div>

          </Modal>
        )}

      {/* ===================================================
          EDIT INVOICE MODAL
      =================================================== */}

      {showInvoiceForm && (
        <Modal
          title="Edit Customer Invoice"
          description="Update the invoice information before saving."
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

            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">

              <div className="flex gap-3">

                <FileText
                  size={19}
                  className="mt-0.5 shrink-0 text-[#0D9488]"
                />

                <div>

                  <p className="text-sm font-semibold text-[#20243A]">
                    Customer invoice
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#666B84]">
                    Update the existing invoice information.
                  </p>

                </div>

              </div>

            </div>

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
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Customer name"
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="INV-2026-001"
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
                        event.target
                          .value,
                    })
                  )
                }
                placeholder="Describe the goods, service or receivable..."
                className="w-full resize-none rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />

            </FormField>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">

              <button
                type="button"
                disabled={saving}
                onClick={
                  closeInvoiceForm
                }
                className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F766E] disabled:opacity-50"
              >

                {saving ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Edit3
                    size={18}
                  />
                )}

                Save Changes

              </button>

            </div>

          </form>

        </Modal>
      )}

      {/* ===================================================
          PAYMENT MODAL
      =================================================== */}

      {showPaymentForm &&
        selectedInvoice && (
        <Modal
          title="Record Customer Payment"
          description={`Apply a payment against ${selectedInvoice.invoiceNumber}.`}
          onClose={
            closePaymentForm
          }
        >

          <form
            onSubmit={
              handlePayment
            }
            className="space-y-5"
          >

            <div className="rounded-2xl bg-emerald-50 p-5">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600">

                  <Banknote
                    size={20}
                  />

                </div>

                <div>

                  <p className="text-sm font-semibold text-emerald-900">
                    Customer payment
                  </p>

                  <p className="mt-1 text-xs text-emerald-700">
                    Apply a payment to the outstanding invoice balance.
                  </p>

                </div>

              </div>

            </div>

            <div className="grid gap-4 sm:grid-cols-2">

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
                className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
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
              className="text-left text-sm font-medium text-[#0D9488] hover:text-[#0F766E]"
            >
              Use full outstanding balance
            </button>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">

              <button
                type="button"
                disabled={
                  actionLoading
                }
                onClick={
                  closePaymentForm
                }
                className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  actionLoading
                }
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
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
   SUMMARY CARD
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
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm transition hover:shadow-md">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <span className="text-sm font-medium text-[#666B84]">
            {title}
          </span>

          <div
            className={`mt-2 break-words text-xl font-bold leading-tight ${
              danger
                ? "text-red-600"
                : "text-[#20243A]"
            }`}
          >
            {value}
          </div>

          <p className="mt-1 text-xs text-[#888DA3]">
            {subtitle}
          </p>

        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            danger
              ? "bg-red-50 text-red-600"
              : "bg-teal-50 text-[#0D9488]"
          }`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

/* =========================================================
   MINI METRIC
========================================================= */

function MiniMetric({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#0D9488]">
        {icon}
      </div>

      <div className="min-w-0">

        <p className="text-sm text-[#666B84]">
          {label}
        </p>

        <p className="mt-1 text-xl font-bold text-[#20243A]">
          {value}
        </p>

        <p className="mt-0.5 truncate text-xs text-[#888DA3]">
          {description}
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   AGING CARD
========================================================= */

function AgingCard({
  label,
  value,
  total,
  danger = false,
}: {
  label: string;
  value: number;
  total: number;
  danger?: boolean;
}) {
  const percentage =
    total > 0
      ? Math.min(
          100,
          (value / total) * 100
        )
      : 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        danger
          ? "border-red-100 bg-red-50/40"
          : "border-[#ECECF3] bg-[#FAFBFD]"
      }`}
    >

      <div className="flex items-center justify-between gap-2">

        <span className="text-sm font-medium text-[#666B84]">
          {label}
        </span>

        {danger && (
          <AlertCircle
            size={16}
            className="text-red-500"
          />
        )}

      </div>

      <div
        className={`mt-3 text-lg font-bold ${
          danger
            ? "text-red-600"
            : "text-[#20243A]"
        }`}
      >
        {formatCurrency(
          value
        )}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ECECF3]">

        <div
          className={`h-full rounded-full transition-all ${
            danger
              ? "bg-red-500"
              : "bg-[#0D9488]"
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

      <div className="mt-2 text-xs text-[#888DA3]">
        {percentage.toFixed(
          1
        )}
        % of outstanding
      </div>

    </div>
  );
}

/* =========================================================
   ACTION BUTTON
========================================================= */

function ActionButton({
  children,
  title,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={
        danger
          ? "flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          : "flex h-9 w-9 items-center justify-center rounded-lg border border-[#ECECF3] bg-white text-[#666B84] transition hover:border-[#0D9488]/30 hover:bg-teal-50 hover:text-[#0D9488] disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

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

/* =========================================================
   DETAIL
========================================================= */

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

/* =========================================================
   MODAL
========================================================= */

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
  const titleId = `modal-title-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >

        <div className="flex items-start justify-between border-b border-[#ECECF3] p-6">

          <div className="pr-6">

            <h2
              id={titleId}
              className="text-2xl font-bold text-[#20243A]"
            >
              {title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#666B84]">
              {description}
            </p>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#666B84] transition hover:bg-[#F8F9FC] hover:text-[#20243A]"
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
