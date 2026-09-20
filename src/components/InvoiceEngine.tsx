import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  authenticatedFetch,
  getAuthToken,
} from "../lib/auth";

import {
  createInvoice,
  deleteInvoice,
  fetchInvoiceStats,
  fetchInvoices,
  finalizeInvoice,
  voidInvoice,
  type Invoice,
  type InvoiceLineInput,
  type InvoiceStats,
} from "../services/invoice";

/* =========================================================
   TYPES
========================================================= */

interface InvoiceEngineProps {
  onAutoPostRevenue?: (
    clientName: string,
    amount: number
  ) => void;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type?: string;
  isActive?: boolean;
}

interface AccountResponse {
  success?: boolean;
  accounts?: AccountOption[];
  data?: AccountOption[];
  message?: string;
}

type DisplayStatus =
  | "Paid"
  | "Partially Paid"
  | "Pending"
  | "Overdue"
  | "Draft"
  | "Posted"
  | "Void";

/* =========================================================
   CONSTANTS
========================================================= */

const API_ACCOUNTS_URL = "/api/accounts";

const DEFAULT_REVENUE_ACCOUNT_CODE = "4100";

const INPUT_CLASS =
  "w-full min-h-[42px] rounded-xl border border-[#E6E8EF] bg-white px-3 py-2.5 text-sm text-[#20243A] placeholder:text-[#A0A4B5] outline-none transition-all focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F7F8FA] disabled:text-[#9297A8]";

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-wide text-[#666B84]";

const CARD_CLASS =
  "rounded-2xl border border-[#E7E9F0] bg-white shadow-sm";

/* =========================================================
   MONEY
========================================================= */

const KES = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

/* =========================================================
   DATE
========================================================= */

const formatDate = (
  value: string | undefined | null
): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const todayISO = (): string => {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDaysToISO = (
  dateString: string,
  days: number
): string => {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  date.setDate(
    date.getDate() + days
  );

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/* =========================================================
   STATUS
========================================================= */

const getInvoiceStatus = (
  invoice: Invoice
): DisplayStatus => {
  const invoiceStatus =
    String(invoice.status ?? "")
      .toUpperCase();

  if (invoiceStatus === "DRAFT") {
    return "Draft";
  }

  if (invoiceStatus === "VOID") {
    return "Void";
  }

  const total = Number(
    invoice.totalAmount ?? 0
  );

  const outstanding = Math.max(
    0,
    Number(
      invoice.outstandingBalance ??
        total
    )
  );

  if (
    outstanding <= 0 ||
    String(invoice.paymentStatus)
      .toUpperCase() === "PAID"
  ) {
    return "Paid";
  }

  if (
    String(invoice.paymentStatus)
      .toUpperCase() ===
      "PARTIALLY_PAID"
  ) {
    return "Partially Paid";
  }

  if (
    invoiceStatus === "POSTED" &&
    invoice.dueDate
  ) {
    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const dueDate = new Date(
      invoice.dueDate
    );

    dueDate.setHours(
      0,
      0,
      0,
      0
    );

    if (dueDate < today) {
      return "Overdue";
    }
  }

  return invoiceStatus === "POSTED"
    ? "Pending"
    : "Draft";
};

/* =========================================================
   STATUS STYLES
========================================================= */

const StatusBadge = ({
  status,
}: {
  status: DisplayStatus;
}) => {
  if (status === "Paid") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Paid
      </span>
    );
  }

  if (status === "Partially Paid") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Partially Paid
      </span>
    );
  }

  if (status === "Overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">
        <AlertCircle className="h-3.5 w-3.5" />
        Overdue
      </span>
    );
  }

  if (status === "Posted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Posted
      </span>
    );
  }

  if (status === "Void") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
        <XCircle className="h-3.5 w-3.5" />
        Void
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
      <Clock3 className="h-3.5 w-3.5" />
      Draft
    </span>
  );
};

/* =========================================================
   NUMBER
========================================================= */

const safeNumber = (
  value: string | number
): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

/* =========================================================
   ACCOUNT RESPONSE NORMALIZER
========================================================= */

const normalizeAccounts = (
  response: AccountResponse
): AccountOption[] => {
  const source =
    response.accounts ??
    response.data ??
    [];

  return source
    .filter(
      (account) =>
        Boolean(account?.id) &&
        Boolean(account?.code) &&
        Boolean(account?.name)
    )
    .filter(
      (account) =>
        account.isActive !== false
    )
    .sort((a, b) =>
      `${a.code} ${a.name}`.localeCompare(
        `${b.code} ${b.name}`
      )
    );
};

/* =========================================================
   INVOICE ENGINE
========================================================= */

export default function InvoiceEngine({
  onAutoPostRevenue,
}: InvoiceEngineProps) {
  /* =======================================================
     DATA
  ======================================================= */

  const [
    invoices,
    setInvoices,
  ] = useState<Invoice[]>([]);

  const [
    stats,
    setStats,
  ] = useState<InvoiceStats | null>(
    null
  );

  const [
    accounts,
    setAccounts,
  ] = useState<AccountOption[]>(
    []
  );

  /* =======================================================
     FORM
  ======================================================= */

  const [
    customerName,
    setCustomerName,
  ] = useState("");

  const [
    customerEmail,
    setCustomerEmail,
  ] = useState("");

  const [
    customerPhone,
    setCustomerPhone,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    issueDate,
    setIssueDate,
  ] = useState(todayISO());

  const [
    dueDate,
    setDueDate,
  ] = useState(
    addDaysToISO(
      todayISO(),
      30
    )
  );

  const [
    lineDescription,
    setLineDescription,
  ] = useState("");

  const [
    lineQuantity,
    setLineQuantity,
  ] = useState("1");

  const [
    lineUnitPrice,
    setLineUnitPrice,
  ] = useState("");

  const [
    lineDiscount,
    setLineDiscount,
  ] = useState("0");

  const [
    lineTaxRate,
    setLineTaxRate,
  ] = useState("16");

  const [
    lineAccountId,
    setLineAccountId,
  ] = useState("");

  /* =======================================================
     FILTERS
  ======================================================= */

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    paymentFilter,
    setPaymentFilter,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

  const PAGE_SIZE = 20;

  /* =======================================================
     UI STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loadingAccounts,
    setLoadingAccounts,
  ] = useState(true);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    processingId,
    setProcessingId,
  ] = useState<string | null>(
    null
  );

  const [
    processingAction,
    setProcessingAction,
  ] = useState<
    | "finalize"
    | "void"
    | "delete"
    | null
  >(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /* =======================================================
     CALCULATED LINE VALUES
  ======================================================= */

  const calculatedLine = useMemo(() => {
    const quantity = Math.max(
      0,
      safeNumber(lineQuantity)
    );

    const unitPrice = Math.max(
      0,
      safeNumber(lineUnitPrice)
    );

    const discount = Math.max(
      0,
      safeNumber(lineDiscount)
    );

    const taxRate = Math.min(
      100,
      Math.max(
        0,
        safeNumber(lineTaxRate)
      )
    );

    const gross =
      quantity * unitPrice;

    const safeDiscount = Math.min(
      discount,
      gross
    );

    const lineSubtotal =
      gross - safeDiscount;

    const taxAmount =
      lineSubtotal *
      (taxRate / 100);

    const lineTotal =
      lineSubtotal + taxAmount;

    return {
      quantity,
      unitPrice,
      discountAmount:
        safeDiscount,
      taxRate,
      lineSubtotal,
      taxAmount,
      lineTotal,
    };
  }, [
    lineQuantity,
    lineUnitPrice,
    lineDiscount,
    lineTaxRate,
  ]);

  /* =======================================================
     LOAD INVOICES
  ======================================================= */

  const loadInvoices =
    useCallback(
      async (
        showSpinner = true
      ) => {
        try {
          if (showSpinner) {
            setLoading(true);
          } else {
            setRefreshing(true);
          }

          setError("");

          const response =
            await fetchInvoices({
              page,
              limit: PAGE_SIZE,
              search,
              status:
                statusFilter ||
                undefined,
              paymentStatus:
                paymentFilter ||
                undefined,
            });

          if (!response.success) {
            throw new Error(
              response.message ||
                "Unable to load invoices."
            );
          }

          setInvoices(
            response.invoices ?? []
          );
        } catch (err) {
          console.error(
            "Invoice load error:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load invoices."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        page,
        search,
        statusFilter,
        paymentFilter,
      ]
    );

  /* =======================================================
     LOAD STATS
  ======================================================= */

  const loadStats =
    useCallback(async () => {
      try {
        const response =
          await fetchInvoiceStats();

        if (
          response.success &&
          response.stats
        ) {
          setStats(
            response.stats
          );
        }
      } catch (err) {
        console.error(
          "Invoice stats error:",
          err
        );
      }
    }, []);

  /* =======================================================
     LOAD ACCOUNTS
  ======================================================= */

  const loadAccounts =
    useCallback(async () => {
      try {
        setLoadingAccounts(true);

        const token =
          getAuthToken();

        if (!token) {
          throw new Error(
            "Authentication required."
          );
        }

        const response =
          await authenticatedFetch(
            API_ACCOUNTS_URL,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          (await response.json()) as AccountResponse;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load accounts."
          );
        }

        setAccounts(
          normalizeAccounts(data)
        );
      } catch (err) {
        console.error(
          "Invoice accounts error:",
          err
        );

        /*
         * Account selection is optional because
         * the backend defaults invoice revenue
         * to account 4100.
         */
        setAccounts([]);
      } finally {
        setLoadingAccounts(false);
      }
    }, []);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  /* =======================================================
     RESET FORM
  ======================================================= */

  const resetForm = () => {
    const today =
      todayISO();

    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setDescription("");

    setIssueDate(today);

    setDueDate(
      addDaysToISO(
        today,
        30
      )
    );

    setLineDescription("");
    setLineQuantity("1");
    setLineUnitPrice("");
    setLineDiscount("0");
    setLineTaxRate("16");

    const revenueAccount =
      accounts.find(
        (account) =>
          account.code ===
          DEFAULT_REVENUE_ACCOUNT_CODE
      );

    setLineAccountId(
      revenueAccount?.id ?? ""
    );
  };

  /* =======================================================
     CREATE DRAFT
  ======================================================= */

  const handleCreateInvoice =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();

      setError("");
      setSuccessMessage("");

      const normalizedCustomerName =
        customerName.trim();

      const normalizedEmail =
        customerEmail.trim();

      const normalizedPhone =
        customerPhone.trim();

      const normalizedDescription =
        description.trim();

      const normalizedLineDescription =
        lineDescription.trim();

      if (
        !normalizedCustomerName
      ) {
        setError(
          "Customer name is required."
        );
        return;
      }

      if (
        !normalizedLineDescription
      ) {
        setError(
          "Invoice line description is required."
        );
        return;
      }

      if (
        !issueDate ||
        !dueDate
      ) {
        setError(
          "Issue date and due date are required."
        );
        return;
      }

      if (
        dueDate < issueDate
      ) {
        setError(
          "Due date cannot be before issue date."
        );
        return;
      }

      if (
        calculatedLine.quantity <=
        0
      ) {
        setError(
          "Quantity must be greater than zero."
        );
        return;
      }

      if (
        calculatedLine.unitPrice <
        0
      ) {
        setError(
          "Unit price cannot be negative."
        );
        return;
      }

      if (
        calculatedLine.lineSubtotal <=
        0
      ) {
        setError(
          "Invoice line subtotal must be greater than zero."
        );
        return;
      }

      if (
        calculatedLine.taxRate <
          0 ||
        calculatedLine.taxRate >
          100
      ) {
        setError(
          "Tax rate must be between 0% and 100%."
        );
        return;
      }

      const line: InvoiceLineInput =
        {
          accountId:
            lineAccountId ||
            undefined,

          description:
            normalizedLineDescription,

          quantity:
            calculatedLine.quantity,

          unitPrice:
            calculatedLine.unitPrice,

          discountAmount:
            calculatedLine.discountAmount,

          taxRate:
            calculatedLine.taxRate,
        };

      try {
        setCreating(true);

        const response =
          await createInvoice({
            customerName:
              normalizedCustomerName,

            customerEmail:
              normalizedEmail ||
              null,

            customerPhone:
              normalizedPhone ||
              null,

            description:
              normalizedDescription,

            issueDate,

            dueDate,

            lines: [line],
          });

        if (!response.success) {
          throw new Error(
            response.message ||
              "Unable to create invoice."
          );
        }

        const generatedNumber =
          response.invoice
            ?.invoiceNumber;

        resetForm();

        await Promise.all([
          loadInvoices(false),
          loadStats(),
        ]);

        setSuccessMessage(
          generatedNumber
            ? `Draft ${generatedNumber} created successfully.`
            : "Invoice draft created successfully."
        );
      } catch (err) {
        console.error(
          "Create invoice error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to create invoice."
        );
      } finally {
        setCreating(false);
      }
    };

  /* =======================================================
     FINALIZE INVOICE
  ======================================================= */

  const handleFinalize =
    async (
      invoice: Invoice
    ) => {
      if (
        !window.confirm(
          `Finalize ${invoice.invoiceNumber}? This will post the invoice to Accounts Receivable and create the accounting journal entry.`
        )
      ) {
        return;
      }

      try {
        setProcessingId(
          invoice.id
        );

        setProcessingAction(
          "finalize"
        );

        setError("");
        setSuccessMessage("");

        const response =
          await finalizeInvoice(
            invoice.id
          );

        if (!response.success) {
          throw new Error(
            response.message ||
              "Unable to finalize invoice."
          );
        }

        await Promise.all([
          loadInvoices(false),
          loadStats(),
        ]);

        setSuccessMessage(
          `${invoice.invoiceNumber} has been finalized and posted.`
        );

        if (
          onAutoPostRevenue
        ) {
          onAutoPostRevenue(
            invoice.customerName,
            safeNumber(
              invoice.totalAmount
            )
          );
        }
      } catch (err) {
        console.error(
          "Finalize invoice error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to finalize invoice."
        );
      } finally {
        setProcessingId(null);
        setProcessingAction(null);
      }
    };

  /* =======================================================
     VOID INVOICE
  ======================================================= */

  const handleVoid =
    async (
      invoice: Invoice
    ) => {
      if (
        !window.confirm(
          `Void ${invoice.invoiceNumber}? A reversing journal entry will be created.`
        )
      ) {
        return;
      }

      try {
        setProcessingId(
          invoice.id
        );

        setProcessingAction(
          "void"
        );

        setError("");
        setSuccessMessage("");

        const response =
          await voidInvoice(
            invoice.id
          );

        if (!response.success) {
          throw new Error(
            response.message ||
              "Unable to void invoice."
          );
        }

        await Promise.all([
          loadInvoices(false),
          loadStats(),
        ]);

        setSuccessMessage(
          `${invoice.invoiceNumber} has been voided successfully.`
        );
      } catch (err) {
        console.error(
          "Void invoice error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to void invoice."
        );
      } finally {
        setProcessingId(null);
        setProcessingAction(null);
      }
    };

  /* =======================================================
     DELETE DRAFT
  ======================================================= */

  const handleDelete =
    async (
      invoice: Invoice
    ) => {
      if (
        !window.confirm(
          `Delete draft ${invoice.invoiceNumber}? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        setProcessingId(
          invoice.id
        );

        setProcessingAction(
          "delete"
        );

        setError("");
        setSuccessMessage("");

        const response =
          await deleteInvoice(
            invoice.id
          );

        if (!response.success) {
          throw new Error(
            response.message ||
              "Unable to delete invoice."
          );
        }

        await Promise.all([
          loadInvoices(false),
          loadStats(),
        ]);

        setSuccessMessage(
          `${invoice.invoiceNumber} was deleted.`
        );
      } catch (err) {
        console.error(
          "Delete invoice error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to delete invoice."
        );
      } finally {
        setProcessingId(null);
        setProcessingAction(null);
      }
    };

  /* =======================================================
     DISPLAY SUMMARY
  ======================================================= */

  const summary = useMemo(() => {
    if (stats) {
      return {
        totalInvoiced:
          safeNumber(
            stats.totalInvoiced
          ),

        outstanding:
          safeNumber(
            stats.outstanding
          ),

        collected:
          safeNumber(
            stats.collected
          ),

        overdue:
          safeNumber(
            stats.overdue
          ),
      };
    }

    return invoices.reduce(
      (result, invoice) => {
        const total =
          safeNumber(
            invoice.totalAmount
          );

        const outstanding =
          Math.max(
            0,
            safeNumber(
              invoice.outstandingBalance ??
                total
            )
          );

        result.totalInvoiced +=
          total;

        result.outstanding +=
          outstanding;

        result.collected +=
          Math.max(
            0,
            total - outstanding
          );

        if (
          getInvoiceStatus(
            invoice
          ) === "Overdue"
        ) {
          result.overdue +=
            outstanding;
        }

        return result;
      },
      {
        totalInvoiced: 0,
        outstanding: 0,
        collected: 0,
        overdue: 0,
      }
    );
  }, [stats, invoices]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const hasPreviousPage =
    page > 1;

  const hasNextPage =
    invoices.length >= PAGE_SIZE;

  /* =======================================================
     ACTION LOADING
  ======================================================= */

  const isProcessing = (
    invoiceId: string,
    action:
      | "finalize"
      | "void"
      | "delete"
  ) =>
    processingId ===
      invoiceId &&
    processingAction ===
      action;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D9488]/10">
              <FileText className="h-5 w-5 text-[#0D9488]" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#20243A]">
                Invoice Management
              </h2>

              <p className="text-xs text-[#666B84]">
                Customer billing, Accounts Receivable and invoice posting.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadInvoices(false);
            void loadStats();
          }}
          disabled={
            refreshing ||
            loading
          }
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[#E2E5EC] bg-white px-4 text-xs font-bold text-[#3E4358] shadow-sm transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing
                ? "animate-spin"
                : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>
              Total Invoiced
            </span>

            <FileText className="h-4 w-4 text-[#0D9488]" />
          </div>

          <div className="mt-3 text-xl font-bold text-[#20243A]">
            {KES(
              summary.totalInvoiced
            )}
          </div>

          <div className="mt-1 text-[10px] text-[#85899B]">
            Customer invoices
          </div>
        </div>

        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>
              Collected
            </span>

            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>

          <div className="mt-3 text-xl font-bold text-emerald-600">
            {KES(
              summary.collected
            )}
          </div>

          <div className="mt-1 text-[10px] text-[#85899B]">
            Payments received
          </div>
        </div>

        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>
              Outstanding
            </span>

            <Clock3 className="h-4 w-4 text-amber-500" />
          </div>

          <div className="mt-3 text-xl font-bold text-amber-600">
            {KES(
              summary.outstanding
            )}
          </div>

          <div className="mt-1 text-[10px] text-[#85899B]">
            Open receivables
          </div>
        </div>

        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>
              Overdue
            </span>

            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>

          <div className="mt-3 text-xl font-bold text-red-600">
            {KES(
              summary.overdue
            )}
          </div>

          <div className="mt-1 text-[10px] text-[#85899B]">
            Past due exposure
          </div>
        </div>

      </div>

      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <div className="flex-1">
            <div className="font-bold">
              Invoice operation failed
            </div>

            <div className="mt-0.5 text-xs">
              {error}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="rounded-lg p-1 hover:bg-red-100"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

          <div className="flex-1">
            <div className="font-bold">
              Invoice operation completed
            </div>

            <div className="mt-0.5 text-xs">
              {successMessage}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
            className="rounded-lg p-1 hover:bg-emerald-100"
            aria-label="Dismiss success message"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================
          CREATE INVOICE
      ===================================================== */}

      <section className={`${CARD_CLASS} overflow-hidden`}>

        <div className="border-b border-[#ECEEF3] bg-[#FBFCFD] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#0D9488]" />

                <h3 className="text-sm font-bold text-[#20243A]">
                  Create Customer Invoice
                </h3>
              </div>

              <p className="mt-1 text-xs text-[#6E7387]">
                Create a draft invoice. The official invoice number is generated by the server.
              </p>
            </div>

            <div className="rounded-xl border border-[#E4E7ED] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#777C8E]">
              Invoice number: Auto-generated
            </div>

          </div>
        </div>

        <form
          onSubmit={
            handleCreateInvoice
          }
          className="space-y-6 p-5"
        >

          {/* =================================================
              CUSTOMER
          ================================================= */}

          <div>
            <div className="mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                Customer Information
              </h4>

              <p className="mt-1 text-xs text-[#777C8E]">
                Enter the customer that will be billed.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <div className="flex flex-col gap-1.5">
                <label className={LABEL_CLASS}>
                  Customer Name *
                </label>

                <input
                  type="text"
                  required
                  value={
                    customerName
                  }
                  onChange={(event) =>
                    setCustomerName(
                      event.target.value
                    )
                  }
                  placeholder="e.g. KCB Corporate"
                  className={
                    INPUT_CLASS
                  }
                  disabled={
                    creating
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={LABEL_CLASS}>
                  Customer Email
                </label>

                <input
                  type="email"
                  value={
                    customerEmail
                  }
                  onChange={(event) =>
                    setCustomerEmail(
                      event.target.value
                    )
                  }
                  placeholder="customer@company.com"
                  className={
                    INPUT_CLASS
                  }
                  disabled={
                    creating
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className={LABEL_CLASS}>
                  Customer Phone
                </label>

                <input
                  type="tel"
                  value={
                    customerPhone
                  }
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value
                    )
                  }
                  placeholder="+254 7XX XXX XXX"
                  className={
                    INPUT_CLASS
                  }
                  disabled={
                    creating
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className={LABEL_CLASS}>
                  Invoice Description
                </label>

                <textarea
                  rows={3}
                  value={
                    description
                  }
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder="Describe the overall goods or services covered by this invoice."
                  className={`${INPUT_CLASS} resize-y`}
                  disabled={
                    creating
                  }
                />
              </div>

            </div>
          </div>

          {/* =================================================
              PAYMENT TERMS
          ================================================= */}

          <div>
            <div className="mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                Invoice Dates
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <div className="flex flex-col gap-1.5">
                <label className={LABEL_CLASS}>
                  Issue Date *
                </label>

                <input
                  type="date"
                  required
                  value={
                    issueDate
                  }
                  onChange={(event) =>
                    setIssueDate(
                      event.target.value
                    )
                  }
                  className={
                    INPUT_CLASS
                  }
                  disabled={
                    creating
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={LABEL_CLASS}>
                  Due Date *
                </label>

                <input
                  type="date"
                  required
                  value={
                    dueDate
                  }
                  min={
                    issueDate
                  }
                  onChange={(event) =>
                    setDueDate(
                      event.target.value
                    )
                  }
                  className={
                    INPUT_CLASS
                  }
                  disabled={
                    creating
                  }
                />
              </div>

            </div>
          </div>

          {/* =================================================
              LINE ITEM
          ================================================= */}

          <div>
            <div className="mb-3 flex flex-col gap-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                Invoice Line
              </h4>

              <p className="text-xs text-[#777C8E]">
                Revenue account, quantity, price, discount and tax are calculated into the final accounting amount.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E7E9F0] bg-[#FBFCFD] p-4">

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

                <div className="flex flex-col gap-1.5 xl:col-span-2">
                  <label className={LABEL_CLASS}>
                    Line Description *
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      lineDescription
                    }
                    onChange={(event) =>
                      setLineDescription(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Software implementation services"
                    className={
                      INPUT_CLASS
                    }
                    disabled={
                      creating
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={LABEL_CLASS}>
                    Revenue Account
                  </label>

                  <select
                    value={
                      lineAccountId
                    }
                    onChange={(event) =>
                      setLineAccountId(
                        event.target.value
                      )
                    }
                    className={
                      INPUT_CLASS
                    }
                    disabled={
                      creating ||
                      loadingAccounts
                    }
                  >
                    <option value="">
                      Default — 4100 Sales Revenue
                    </option>

                    {accounts
                      .filter(
                        (account) =>
                          !account.type ||
                          account.type ===
                            "INCOME"
                      )
                      .map(
                        (account) => (
                          <option
                            key={
                              account.id
                            }
                            value={
                              account.id
                            }
                          >
                            {account.code} —{" "}
                            {account.name}
                          </option>
                        )
                      )}
                  </select>

                  <span className="text-[10px] text-[#85899B]">
                    {loadingAccounts
                      ? "Loading accounts..."
                      : "Only tenant income accounts should be used for invoice revenue."}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={LABEL_CLASS}>
                    Quantity *
                  </label>

                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    required
                    value={
                      lineQuantity
                    }
                    onChange={(event) =>
                      setLineQuantity(
                        event.target.value
                      )
                    }
                    className={`${INPUT_CLASS} font-mono`}
                    disabled={
                      creating
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={LABEL_CLASS}>
                    Unit Price (KES) *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={
                      lineUnitPrice
                    }
                    onChange={(event) =>
                      setLineUnitPrice(
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                    className={`${INPUT_CLASS} font-mono`}
                    disabled={
                      creating
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={LABEL_CLASS}>
                    Discount (KES)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      lineDiscount
                    }
                    onChange={(event) =>
                      setLineDiscount(
                        event.target.value
                      )
                    }
                    className={`${INPUT_CLASS} font-mono`}
                    disabled={
                      creating
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={LABEL_CLASS}>
                    Tax Rate (%)
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      lineTaxRate
                    }
                    onChange={(event) =>
                      setLineTaxRate(
                        event.target.value
                      )
                    }
                    className={`${INPUT_CLASS} font-mono`}
                    disabled={
                      creating
                    }
                  />
                </div>

              </div>

              {/* LINE CALCULATION */}

              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[#E7E9F0] pt-4 sm:grid-cols-3">

                <div>
                  <div className={LABEL_CLASS}>
                    Line Subtotal
                  </div>

                  <div className="mt-1 font-mono text-sm font-bold text-[#20243A]">
                    {KES(
                      calculatedLine.lineSubtotal
                    )}
                  </div>
                </div>

                <div>
                  <div className={LABEL_CLASS}>
                    Tax Amount
                  </div>

                  <div className="mt-1 font-mono text-sm font-bold text-[#666B84]">
                    {KES(
                      calculatedLine.taxAmount
                    )}
                  </div>
                </div>

                <div>
                  <div className={LABEL_CLASS}>
                    Invoice Total
                  </div>

                  <div className="mt-1 font-mono text-base font-bold text-[#0D9488]">
                    {KES(
                      calculatedLine.lineTotal
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* =================================================
              ACCOUNTING NOTICE
          ================================================= */}

          <div className="rounded-xl border border-[#DCEDEA] bg-[#F3FAF9] px-4 py-3">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />

              <div>
                <div className="text-xs font-bold text-[#20243A]">
                  Draft-first accounting workflow
                </div>

                <div className="mt-1 text-[11px] leading-5 text-[#687083]">
                  Creating the invoice saves a draft only. Finalizing the invoice creates the Accounts Receivable record and balanced accounting journal entry.
                </div>
              </div>
            </div>
          </div>

          {/* =================================================
              SUBMIT
          ================================================= */}

          <div className="flex flex-col gap-3 border-t border-[#ECEEF3] pt-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="text-[11px] text-[#777C8E]">
              Invoice number is generated securely by the backend.
            </div>

            <button
              type="submit"
              disabled={
                creating
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white shadow-lg shadow-teal-600/10 transition hover:bg-[#0B7F75] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Draft...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Invoice Draft
                </>
              )}
            </button>

          </div>

        </form>
      </section>

      {/* =====================================================
          INVOICE CONTROL CENTER
      ===================================================== */}

      <section className={`${CARD_CLASS} overflow-hidden`}>

        {/* HEADER */}

        <div className="border-b border-[#ECEEF3] bg-[#FBFCFD] px-5 py-4">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0D9488]" />

                <h3 className="text-sm font-bold text-[#20243A]">
                  Invoice Control Center
                </h3>
              </div>

              <p className="mt-1 text-xs text-[#6E7387]">
                Manage drafts, posted invoices, receivables and invoice accounting status.
              </p>
            </div>

            {/* FILTERS */}

            <div className="flex flex-col gap-2 sm:flex-row">

              <div className="relative min-w-0 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9EAE]" />

                <input
                  type="search"
                  value={
                    search
                  }
                  onChange={(event) => {
                    setPage(1);
                    setSearch(
                      event.target.value
                    );
                  }}
                  placeholder="Search invoices..."
                  className="min-h-[40px] w-full rounded-xl border border-[#E1E4EB] bg-white pl-9 pr-3 text-xs text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                />
              </div>

              <select
                value={
                  statusFilter
                }
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(
                    event.target.value
                  );
                }}
                className="min-h-[40px] rounded-xl border border-[#E1E4EB] bg-white px-3 text-xs font-semibold text-[#4C5267] outline-none focus:border-[#0D9488]"
              >
                <option value="">
                  All Statuses
                </option>

                <option value="DRAFT">
                  Draft
                </option>

                <option value="POSTED">
                  Posted
                </option>

                <option value="VOID">
                  Void
                </option>
              </select>

              <select
                value={
                  paymentFilter
                }
                onChange={(event) => {
                  setPage(1);
                  setPaymentFilter(
                    event.target.value
                  );
                }}
                className="min-h-[40px] rounded-xl border border-[#E1E4EB] bg-white px-3 text-xs font-semibold text-[#4C5267] outline-none focus:border-[#0D9488]"
              >
                <option value="">
                  All Payments
                </option>

                <option value="UNPAID">
                  Unpaid
                </option>

                <option value="PARTIALLY_PAID">
                  Partially Paid
                </option>

                <option value="PAID">
                  Paid
                </option>
              </select>

            </div>
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1050px] w-full text-left text-xs">

            <thead className="bg-[#FAFBFC]">
              <tr className="border-b border-[#ECEEF3]">

                <th className="px-5 py-3 font-bold uppercase tracking-wide text-[#777C8E]">
                  Invoice
                </th>

                <th className="px-5 py-3 font-bold uppercase tracking-wide text-[#777C8E]">
                  Customer
                </th>

                <th className="px-5 py-3 text-right font-bold uppercase tracking-wide text-[#777C8E]">
                  Amount
                </th>

                <th className="px-5 py-3 font-bold uppercase tracking-wide text-[#777C8E]">
                  Issue Date
                </th>

                <th className="px-5 py-3 font-bold uppercase tracking-wide text-[#777C8E]">
                  Due Date
                </th>

                <th className="px-5 py-3 font-bold uppercase tracking-wide text-[#777C8E]">
                  Status
                </th>

                <th className="px-5 py-3 text-right font-bold uppercase tracking-wide text-[#777C8E]">
                  Actions
                </th>

              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center text-[#777C8E]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading invoices...
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4F6F8]">
                        <FileText className="h-5 w-5 text-[#8A8FA0]" />
                      </div>

                      <div className="mt-3 text-sm font-bold text-[#3E4358]">
                        No invoices found
                      </div>

                      <div className="mt-1 text-xs text-[#8A8FA0]">
                        Try changing your filters or create a new invoice draft.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map(
                  (invoice) => {
                    const displayStatus =
                      getInvoiceStatus(
                        invoice
                      );

                    const total =
                      safeNumber(
                        invoice.totalAmount
                      );

                    const outstanding =
                      Math.max(
                        0,
                        safeNumber(
                          invoice.outstandingBalance ??
                            total
                        )
                      );

                    const paid =
                      Math.max(
                        0,
                        total -
                          outstanding
                      );

                    const isBusy =
                      processingId ===
                      invoice.id;

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-b border-[#ECEEF3] last:border-0 hover:bg-[#FCFDFD]"
                      >

                        {/* INVOICE */}

                        <td className="px-5 py-4 align-top">

                          <div className="font-mono text-xs font-bold text-[#20243A]">
                            {
                              invoice.invoiceNumber
                            }
                          </div>

                          <div className="mt-1 text-[10px] text-[#9297A8]">
                            {invoice.status ??
                              "—"}
                          </div>

                        </td>

                        {/* CUSTOMER */}

                        <td className="px-5 py-4 align-top">

                          <div className="font-semibold text-[#30354A]">
                            {
                              invoice.customerName
                            }
                          </div>

                          {invoice.customerEmail && (
                            <div className="mt-1 max-w-[220px] truncate text-[10px] text-[#9297A8]">
                              {
                                invoice.customerEmail
                              }
                            </div>
                          )}

                          {invoice.customerPhone && (
                            <div className="mt-0.5 text-[10px] text-[#9297A8]">
                              {
                                invoice.customerPhone
                              }
                            </div>
                          )}

                        </td>

                        {/* AMOUNT */}

                        <td className="px-5 py-4 text-right align-top">

                          <div className="font-mono text-xs font-bold text-[#20243A]">
                            {KES(
                              total
                            )}
                          </div>

                          {displayStatus !==
                            "Draft" &&
                            displayStatus !==
                              "Void" &&
                            outstanding >
                              0 &&
                            outstanding <
                              total && (
                              <div className="mt-1 text-[10px] font-medium text-amber-600">
                                {KES(
                                  outstanding
                                )}{" "}
                                outstanding
                              </div>
                            )}

                          {displayStatus ===
                            "Paid" &&
                            paid > 0 && (
                            <div className="mt-1 text-[10px] font-medium text-emerald-600">
                              {KES(
                                paid
                              )}{" "}
                              collected
                            </div>
                          )}

                        </td>

                        {/* ISSUE DATE */}

                        <td className="px-5 py-4 align-top text-[#5E6477]">
                          {formatDate(
                            invoice.issueDate
                          )}
                        </td>

                        {/* DUE DATE */}

                        <td className="px-5 py-4 align-top text-[#5E6477]">
                          {formatDate(
                            invoice.dueDate
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 align-top">
                          <StatusBadge
                            status={
                              displayStatus
                            }
                          />
                        </td>

                        {/* ACTIONS */}

                        <td className="px-5 py-4 align-top">

                          <div className="flex justify-end gap-2">

                            {String(
                              invoice.status
                            ).toUpperCase() ===
                              "DRAFT" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleFinalize(
                                      invoice
                                    )
                                  }
                                  disabled={
                                    isBusy
                                  }
                                  className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] px-3 text-[10px] font-bold text-white transition hover:bg-[#0B7F75] disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Finalize and post invoice"
                                >
                                  {isProcessing(
                                    invoice.id,
                                    "finalize"
                                  ) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}

                                  Post
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleDelete(
                                      invoice
                                    )
                                  }
                                  disabled={
                                    isBusy
                                  }
                                  className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[10px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Delete draft"
                                >
                                  {isProcessing(
                                    invoice.id,
                                    "delete"
                                  ) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}

                                  Delete
                                </button>
                              </>
                            )}

                            {String(
                              invoice.status
                            ).toUpperCase() ===
                              "POSTED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleVoid(
                                    invoice
                                  )
                                }
                                disabled={
                                  isBusy
                                }
                                className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Void posted invoice"
                              >
                                {isProcessing(
                                  invoice.id,
                                  "void"
                                ) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}

                                Void
                              </button>
                            )}

                            {String(
                              invoice.status
                            ).toUpperCase() ===
                              "VOID" && (
                              <span className="px-2 text-[10px] font-medium italic text-[#9A9EAE]">
                                No actions
                              </span>
                            )}

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )
              )}

            </tbody>

          </table>
        </div>

        {/* =================================================
            PAGINATION
        ================================================= */}

        <div className="flex flex-col gap-3 border-t border-[#ECEEF3] bg-[#FBFCFD] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="text-[10px] font-medium text-[#85899B]">
            Page {page}
            {invoices.length > 0
              ? ` • ${invoices.length} invoice${
                  invoices.length === 1
                    ? ""
                    : "s"
                }`
              : ""}
          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                )
              }
              disabled={
                !hasPreviousPage ||
                loading
              }
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E0E3EA] bg-white px-2.5 text-[10px] font-bold text-[#555B6F] transition hover:bg-[#F6F7F9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>

            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 px-2 text-[10px] font-bold text-[#0D9488]">
              {page}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage(
                  (current) =>
                    current + 1
                )
              }
              disabled={
                !hasNextPage ||
                loading
              }
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E0E3EA] bg-white px-2.5 text-[10px] font-bold text-[#555B6F] transition hover:bg-[#F6F7F9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

          </div>
        </div>

      </section>

    </div>
  );
}