import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
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
  approveExpense,
  createExpense,
  deleteExpense,
  postExpense,
  recordExpensePayment,
  submitExpense,
} from "../services/expenses";
import type { Expense } from "../services/expenses";
import { authenticatedFetch } from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

interface Vendor {
  id: string;
  vendorCode?: string;
  name: string;
  status?: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BankAccount {
  id: string;
  name?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  currency?: string;
  status?: string;
}

interface ExpenseForm {
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  vendorId: string;
  expenseAccountId: string;
  paymentAccountId: string;
  bankAccountId: string;
  paymentMethod: string;
}

interface ExpensePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface ExpenseSummary {
  totalSpend: number;
  pending: number;
  approved: number;
  posted: number;
  paid: number;
}

interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

interface ExpensesResponse {
  success: boolean;
  expenses: Expense[];
  pagination?: ExpensePagination;
  summary?: ExpenseSummary;
  categoryBreakdown?: CategorySummary[];
  message?: string;
}

interface ApiListResponse<T> {
  success?: boolean;
  data?: T[];
  vendors?: T[];
  accounts?: T[];
  bankAccounts?: T[];
  message?: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZES = [25, 50, 100] as const;

const ANALYSIS_ROWS = 5;

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
  category: "",
  description: "",
  amount: "",
  expenseDate: "",
  vendorId: "",
  expenseAccountId: "",
  paymentAccountId: "",
  bankAccountId: "",
  paymentMethod: "",
};

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) =>
  currencyFormatter.format(
    Number.isFinite(value) ? value : 0
  );

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getToday = () =>
  new Date().toISOString().slice(0, 10);

const getErrorMessage = (
  error: unknown,
  fallback: string
) => {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
};

const normalizeStatus = (status?: string) =>
  (status || "DRAFT")
    .toUpperCase()
    .replace(/\s+/g, "_");

const statusLabel = (status?: string) => {
  const value = normalizeStatus(status);

  if (
    value === "PENDING" ||
    value === "PENDING_APPROVAL"
  ) {
    return "Pending approval";
  }

  if (value === "UNPAID") {
    return "Unpaid";
  }

  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
};

const statusTone = (status?: string) => {
  switch (normalizeStatus(status)) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PENDING":
    case "PENDING_APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";

    case "POSTED":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "PAID":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

const paymentTone = (status?: string) =>
  (status || "").toUpperCase() === "PAID"
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : "border-slate-200 bg-slate-50 text-slate-600";

const accountLabel = (
  account?: Account | null
) =>
  account
    ? `${account.code} · ${account.name}`
    : "Not assigned";

const bankLabel = (
  bank?: BankAccount | null
) => {
  if (!bank) return "Not assigned";

  const title =
    bank.name ||
    bank.accountName ||
    bank.bankName ||
    "Bank account";

  const number = bank.accountNumber
    ? ` · ${bank.accountNumber}`
    : "";

  return `${title}${number}`;
};

const csvSafe = (value: unknown) => {
  const stringValue = String(value ?? "");

  const safeValue = /^[=+\-@]/.test(
    stringValue
  )
    ? `'${stringValue}`
    : stringValue;

  return `"${safeValue.replace(/"/g, '""')}"`;
};

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function StatCard({
  label,
  value,
  detail,
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group min-w-0 rounded-2xl border bg-white p-5 text-left transition ${
        active
          ? "border-[#20243A] shadow-sm"
          : "border-[#E8EAF0] hover:border-[#D6D8E2] hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#858BA0]">
            {label}
          </p>

          <p className="mt-2 break-all text-xl font-bold leading-tight tracking-tight text-[#20243A] sm:text-2xl">
            {value}
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-[#858BA0]">
            {detail}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F7FA] text-[#20243A] transition group-hover:bg-[#EFF1F5]">
          {icon}
        </div>
      </div>
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#20243A]">
        {label}{" "}
        {required && (
          <span className="text-red-500">
            *
          </span>
        )}
      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-xs leading-5 text-[#858BA0]">
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0D9488]">
            {eyebrow}
          </p>
        )}

        <h2 className="mt-1 text-lg font-bold tracking-tight text-[#20243A]">
          {title}
        </h2>

        {detail && (
          <p className="mt-1 text-sm text-[#858BA0]">
            {detail}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F6F9] text-[#20243A]">
        <Receipt size={21} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#20243A]">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-sm leading-6 text-[#858BA0]">
        {detail}
      </p>

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[#F0F1F5] py-3 last:border-b-0">
      <span className="shrink-0 text-xs font-medium text-[#858BA0]">
        {label}
      </span>

      <span className="min-w-0 text-right text-sm font-semibold text-[#30364C]">
        {value}
      </span>
    </div>
  );
}

function Workflow({
  status,
  paymentStatus,
}: {
  status: string;
  paymentStatus: string;
}) {
  const current = normalizeStatus(status);

  const steps = [
    ["DRAFT", "Draft"],
    ["PENDING_APPROVAL", "Submitted"],
    ["APPROVED", "Approved"],
    ["POSTED", "Posted"],
    ["PAID", "Paid"],
  ];

  const currentIndex =
    current === "PENDING" ||
    current === "PENDING_APPROVAL"
      ? 1
      : current === "APPROVED"
        ? 2
        : current === "POSTED"
          ? 3
          : current === "PAID" ||
              paymentStatus.toUpperCase() === "PAID"
            ? 4
            : 0;

  return (
    <div className="rounded-2xl border border-[#E8EAF0] bg-[#FAFBFC] p-4">
      <div className="flex items-center gap-1">
        {steps.map(([key, label], index) => {
          const complete =
            index <= currentIndex;

          const rejected =
            current === "REJECTED" &&
            index === 1;

          return (
            <div
              key={key}
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  rejected
                    ? "bg-red-100 text-red-700"
                    : complete
                      ? "bg-[#20243A] text-white"
                      : "bg-white text-[#A0A5B5] ring-1 ring-inset ring-[#E0E2E8]"
                }`}
              >
                {complete && !rejected ? (
                  <Check size={13} />
                ) : (
                  index + 1
                )}
              </div>

              <span
                className={`hidden truncate text-[10px] font-bold sm:block ${
                  complete
                    ? "text-[#30364C]"
                    : "text-[#A0A5B5]"
                }`}
              >
                {label}
              </span>

              {index <
                steps.length - 1 && (
                <div
                  className={`mx-1 h-px min-w-2 flex-1 ${
                    index < currentIndex
                      ? "bg-[#20243A]"
                      : "bg-[#E2E4EA]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   PAGINATION
========================================================= */

function Pagination({
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  pagination: ExpensePagination;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const {
    page,
    total,
    totalPages,
    hasPreviousPage,
    hasNextPage,
  } = pagination;

  const start =
    total === 0
      ? 0
      : (page - 1) * pageSize + 1;

  const end = Math.min(
    page * pageSize,
    total
  );

  return (
    <div className="flex flex-col gap-3 border-t border-[#E9EBF0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <p className="text-xs text-[#858BA0]">
          Showing{" "}
          <span className="font-bold text-[#596077]">
            {start}
          </span>{" "}
          to{" "}
          <span className="font-bold text-[#596077]">
            {end}
          </span>{" "}
          of{" "}
          <span className="font-bold text-[#596077]">
            {total}
          </span>
        </p>

        <select
          value={pageSize}
          onChange={(event) =>
            onPageSizeChange(
              Number(event.target.value)
            )
          }
          className="h-9 rounded-lg border border-[#DFE1E8] bg-white px-2 text-xs font-semibold text-[#596077] outline-none focus:border-[#20243A]"
          aria-label="Rows per page"
        >
          {PAGE_SIZES.map((size) => (
            <option
              key={size}
              value={size}
            >
              {size} / page
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPreviousPage}
          onClick={() =>
            onPageChange(page - 1)
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DFE1E8] bg-white px-3 text-xs font-bold text-[#596077] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={14} />
          Previous
        </button>

        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#20243A] px-3 text-xs font-bold text-white">
          {page}
        </span>

        <span className="text-xs text-[#858BA0]">
          of {Math.max(totalPages, 1)}
        </span>

        <button
          type="button"
          disabled={!hasNextPage}
          onClick={() =>
            onPageChange(page + 1)
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DFE1E8] bg-white px-3 text-xs font-bold text-[#596077] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function PanelPagination({
  pagination,
  onPageChange,
}: {
  pagination: ExpensePagination;
  onPageChange: (page: number) => void;
}) {
  const {
    page,
    pageSize,
    total,
    totalPages,
    hasPreviousPage,
    hasNextPage,
  } = pagination;

  const start =
    total === 0
      ? 0
      : (page - 1) * pageSize + 1;

  const end =
    total === 0
      ? 0
      : Math.min(
          page * pageSize,
          total
        );

  return (
    <div className="mt-5 flex min-w-0 flex-col gap-3 border-t border-[#EEF0F4] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-xs text-[#858BA0]">
        {total === 0 ? (
          "No records"
        ) : (
          <>
            Showing{" "}
            <span className="font-bold text-[#596077]">
              {start}
            </span>
            {"–"}
            <span className="font-bold text-[#596077]">
              {end}
            </span>
            {" of "}
            <span className="font-bold text-[#596077]">
              {total}
            </span>
          </>
        )}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={!hasPreviousPage}
          onClick={() =>
            onPageChange(page - 1)
          }
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DFE1E8] bg-white px-2.5 text-[11px] font-bold text-[#596077] hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={13} />
          Previous
        </button>

        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#20243A] px-2.5 text-[11px] font-bold text-white">
          {page}
        </span>

        <span className="text-[11px] text-[#858BA0]">
          of {Math.max(totalPages, 1)}
        </span>

        <button
          type="button"
          disabled={!hasNextPage}
          onClick={() =>
            onPageChange(page + 1)
          }
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DFE1E8] bg-white px-2.5 text-[11px] font-bold text-[#596077] hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Expenses() {
  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [vendors, setVendors] =
    useState<Vendor[]>([]);

  const [accounts, setAccounts] =
    useState<Account[]>([]);

  const [bankAccounts, setBankAccounts] =
    useState<BankAccount[]>([]);

  const [pagination, setPagination] =
    useState<ExpensePagination>({
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });

  const [summary, setSummary] =
    useState<ExpenseSummary>({
      totalSpend: 0,
      pending: 0,
      approved: 0,
      posted: 0,
      paid: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [supportingLoading, setSupportingLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [busyId, setBusyId] =
    useState("");

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  /* ---------------------------------------------------------
     TABLE FILTERS
  --------------------------------------------------------- */

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [categoryFilter, setCategoryFilter] =
    useState("ALL");

  const [vendorFilter, setVendorFilter] =
    useState("ALL");

  const [dateFilter, setDateFilter] =
    useState("ALL");

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  /* ---------------------------------------------------------
     FORM
  --------------------------------------------------------- */

  const [showForm, setShowForm] =
    useState(false);

  const [step, setStep] =
    useState(1);

  const [form, setForm] =
    useState<ExpenseForm>(INITIAL_FORM);

  /* ---------------------------------------------------------
     DETAIL
  --------------------------------------------------------- */

  const [selectedExpense, setSelectedExpense] =
    useState<Expense | null>(null);

  /* ---------------------------------------------------------
     PAYMENT
  --------------------------------------------------------- */

  const [showPayment, setShowPayment] =
    useState(false);

  const [paymentDate, setPaymentDate] =
    useState(getToday());

  const [paymentReference, setPaymentReference] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("");

  const [paymentBankAccountId, setPaymentBankAccountId] =
    useState("");

  /* ---------------------------------------------------------
     ANALYSIS
  --------------------------------------------------------- */

  const [categoryBreakdown, setCategoryBreakdown] =
    useState<CategorySummary[]>([]);

  const [analysisPage, setAnalysisPage] =
    useState(1);

  const [approvalQueue, setApprovalQueue] =
    useState<Expense[]>([]);

  const [approvalPagination, setApprovalPagination] =
    useState<ExpensePagination>({
      page: 1,
      pageSize: 5,
      total: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });

  const [approvalLoading, setApprovalLoading] =
    useState(false);

  /* =========================================================
     LOAD EXPENSES
  ========================================================= */

  const loadExpenses = useCallback(
    async (
      requestedPage = page,
      requestedPageSize = pageSize
    ) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        params.set(
          "page",
          String(requestedPage)
        );

        params.set(
          "pageSize",
          String(requestedPageSize)
        );

        if (search.trim()) {
          params.set(
            "search",
            search.trim()
          );
        }

        if (
          statusFilter !== "ALL"
        ) {
          params.set(
            "status",
            statusFilter
          );
        }

        if (
          categoryFilter !== "ALL"
        ) {
          params.set(
            "category",
            categoryFilter
          );
        }

        if (
          vendorFilter !== "ALL"
        ) {
          params.set(
            "vendorId",
            vendorFilter
          );
        }

        const today = new Date();

        if (
          dateFilter === "THIS_MONTH"
        ) {
          const start = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          );

          params.set(
            "startDate",
            start
              .toISOString()
              .slice(0, 10)
          );
        }

        if (
          dateFilter === "LAST_30_DAYS"
        ) {
          const start = new Date(
            today
          );

          start.setDate(
            start.getDate() - 30
          );

          params.set(
            "startDate",
            start
              .toISOString()
              .slice(0, 10)
          );
        }

        if (
          dateFilter === "THIS_YEAR"
        ) {
          params.set(
            "startDate",
            `${today.getFullYear()}-01-01`
          );
        }

        const response =
          await authenticatedFetch(
            `/api/expenses?${params.toString()}`,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const payload =
          (await response.json()) as ExpensesResponse;

        if (!response.ok) {
          throw new Error(
            payload.message ||
              "Failed to load expenses."
          );
        }

        const records =
          Array.isArray(
            payload.expenses
          )
            ? payload.expenses
            : [];

        setExpenses(records);

        if (payload.pagination) {
          setPagination(
            payload.pagination
          );
        } else {
          setPagination({
            page: requestedPage,
            pageSize:
              requestedPageSize,
            total: records.length,
            totalPages: Math.max(
              1,
              Math.ceil(
                records.length /
                  requestedPageSize
              )
            ),
            hasPreviousPage:
              requestedPage > 1,
            hasNextPage: false,
          });
        }

        if (payload.summary) {
          setSummary(
            payload.summary
          );
        }

        if (
          Array.isArray(
            payload.categoryBreakdown
          )
        ) {
          setCategoryBreakdown(
            payload.categoryBreakdown
          );
        } else {
          setCategoryBreakdown([]);
        }

        setPage(requestedPage);
        setPageSize(
          requestedPageSize
        );

        setSelectedExpense(
          (current) => {
            if (!current) {
              return current;
            }

            return (
              records.find(
                (item) =>
                  item.id === current.id
              ) ?? current
            );
          }
        );
      } catch (err) {
        console.error(
          "EXPENSES LOAD ERROR:",
          err
        );

        setError(
          getErrorMessage(
            err,
            "Unable to load the Expenses workspace."
          )
        );

        setExpenses([]);
      } finally {
        setLoading(false);
      }
    },
    [
      categoryFilter,
      dateFilter,
      page,
      pageSize,
      search,
      statusFilter,
      vendorFilter,
    ]
  );

  /* =========================================================
     LOAD APPROVAL QUEUE
  ========================================================= */

  const loadApprovalQueue = useCallback(
    async (requestedPage = 1) => {
      setApprovalLoading(true);

      try {
        const params = new URLSearchParams();

        params.set("page", String(requestedPage));
        params.set("pageSize", "5");
        params.set("status", "PENDING_APPROVAL");

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (categoryFilter !== "ALL") {
          params.set("category", categoryFilter);
        }

        if (vendorFilter !== "ALL") {
          params.set("vendorId", vendorFilter);
        }

        const today = new Date();

        if (dateFilter === "THIS_MONTH") {
          const start = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          );
          params.set(
            "startDate",
            start.toISOString().slice(0, 10)
          );
        }

        if (dateFilter === "LAST_30_DAYS") {
          const start = new Date(today);
          start.setDate(start.getDate() - 30);
          params.set(
            "startDate",
            start.toISOString().slice(0, 10)
          );
        }

        if (dateFilter === "THIS_YEAR") {
          params.set(
            "startDate",
            `${today.getFullYear()}-01-01`
          );
        }

        const response = await authenticatedFetch(
          `/api/expenses?${params.toString()}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        const payload =
          (await response.json()) as ExpensesResponse;

        if (!response.ok) {
          throw new Error(
            payload.message ||
              "Failed to load the approval queue."
          );
        }

        const records = Array.isArray(payload.expenses)
          ? payload.expenses
          : [];

        setApprovalQueue(records);

        if (payload.pagination) {
          setApprovalPagination({
            ...payload.pagination,
            pageSize: 5,
          });
        } else {
          setApprovalPagination({
            page: requestedPage,
            pageSize: 5,
            total: records.length,
            totalPages: Math.max(
              1,
              Math.ceil(records.length / 5)
            ),
            hasPreviousPage: requestedPage > 1,
            hasNextPage: false,
          });
        }
      } catch (err) {
        console.error(
          "APPROVAL QUEUE LOAD ERROR:",
          err
        );

        setApprovalQueue([]);
        setApprovalPagination({
          page: requestedPage,
          pageSize: 5,
          total: 0,
          totalPages: 1,
          hasPreviousPage: requestedPage > 1,
          hasNextPage: false,
        });
      } finally {
        setApprovalLoading(false);
      }
    },
    [
      categoryFilter,
      dateFilter,
      search,
      vendorFilter,
    ]
  );

  /* =========================================================
     LOAD SUPPORTING DATA
  ========================================================= */

  const loadSupportingData =
    useCallback(async () => {
      setSupportingLoading(true);

      try {
        const requests =
          await Promise.allSettled([
            authenticatedFetch(
              "/api/vendors",
              {
                headers: {
                  Accept:
                    "application/json",
                },
              }
            ),

            authenticatedFetch(
              "/api/accounts",
              {
                headers: {
                  Accept:
                    "application/json",
                },
              }
            ),

            authenticatedFetch(
              "/api/bank-accounts",
              {
                headers: {
                  Accept:
                    "application/json",
                },
              }
            ),
          ]);

        const vendorResponse =
          requests[0];

        if (
          vendorResponse.status ===
            "fulfilled" &&
          vendorResponse.value.ok
        ) {
          const data =
            (await vendorResponse.value.json()) as ApiListResponse<Vendor>;

          const list =
            Array.isArray(
              data.vendors
            )
              ? data.vendors
              : Array.isArray(
                    data.data
                  )
                ? data.data
                : [];

          setVendors(
            list.filter(
              (vendor) =>
                !vendor.status ||
                vendor.status.toUpperCase() ===
                  "ACTIVE"
            )
          );
        }

        const accountResponse =
          requests[1];

        if (
          accountResponse.status ===
            "fulfilled" &&
          accountResponse.value.ok
        ) {
          const data =
            (await accountResponse.value.json()) as ApiListResponse<Account>;

          const list =
            Array.isArray(
              data.accounts
            )
              ? data.accounts
              : Array.isArray(
                    data.data
                  )
                ? data.data
                : [];

          setAccounts(list);
        }

        const bankResponse =
          requests[2];

        if (
          bankResponse.status ===
            "fulfilled" &&
          bankResponse.value.ok
        ) {
          const data =
            (await bankResponse.value.json()) as ApiListResponse<BankAccount>;

          const list =
            Array.isArray(
              data.bankAccounts
            )
              ? data.bankAccounts
              : Array.isArray(
                    data.accounts
                  )
                ? data.accounts
                : Array.isArray(
                      data.data
                    )
                  ? data.data
                  : [];

          setBankAccounts(list);
        }
      } catch (err) {
        console.error(
          "SUPPORTING DATA ERROR:",
          err
        );
      } finally {
        setSupportingLoading(false);
      }
    }, []);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    void loadExpenses(1, 25);
    void loadApprovalQueue(1);
    void loadSupportingData();
  }, []);

  /* =========================================================
     FILTER CHANGES
  ========================================================= */

  useEffect(() => {
    if (loading) return;

    const timer =
      window.setTimeout(() => {
        void loadExpenses(
          1,
          pageSize
        );
        void loadApprovalQueue(1);
        setAnalysisPage(1);
      }, 250);

    return () =>
      window.clearTimeout(timer);
  }, [
    search,
    statusFilter,
    categoryFilter,
    vendorFilter,
    dateFilter,
  ]);

  /* =========================================================
     ESCAPE + BODY SCROLL
  ========================================================= */

  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key !== "Escape" ||
        busyId
      ) {
        return;
      }

      if (showPayment) {
        setShowPayment(false);
        return;
      }

      if (showForm && !saving) {
        setShowForm(false);
        return;
      }

      if (selectedExpense) {
        setSelectedExpense(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleEscape
      );
  }, [
    busyId,
    saving,
    selectedExpense,
    showForm,
    showPayment,
  ]);

  useEffect(() => {
    const hasOverlay =
      showForm ||
      showPayment ||
      Boolean(selectedExpense);

    if (!hasOverlay) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    selectedExpense,
    showForm,
    showPayment,
  ]);

  /* =========================================================
     ACCOUNT FILTERS
  ========================================================= */

  const expenseAccounts =
    useMemo(
      () =>
        accounts
          .filter(
            (account) =>
              account.type.toUpperCase() ===
              "EXPENSE"
          )
          .sort((a, b) =>
            a.code.localeCompare(
              b.code
            )
          ),
      [accounts]
    );

  const paymentAccounts =
    useMemo(
      () =>
        accounts
          .filter((account) =>
            [
              "ASSET",
              "LIABILITY",
            ].includes(
              account.type.toUpperCase()
            )
          )
          .sort((a, b) =>
            a.code.localeCompare(
              b.code
            )
          ),
      [accounts]
    );

  /* =========================================================
     CATEGORIES
  ========================================================= */

  const categories =
    useMemo(() => {
      const values = new Set(
        CATEGORIES
      );

      expenses.forEach(
        (expense) => {
          if (expense.category) {
            values.add(
              expense.category
            );
          }
        }
      );

      return [...values].sort();
    }, [expenses]);

  /* =========================================================
     CATEGORY ANALYSIS
  ========================================================= */

  const analysisRows =
    useMemo(() => {
      if (categoryBreakdown.length) {
        return [...categoryBreakdown]
          .map((item) => ({
            ...item,
            amount:
              Number(item.amount) || 0,
            percentage:
              Number(item.percentage) || 0,
          }))
          .sort(
            (a, b) =>
              b.amount - a.amount
          );
      }

      const totals =
        new Map<string, number>();

      expenses.forEach((expense) => {
        const category =
          expense.category || "Other";

        totals.set(
          category,
          (totals.get(category) || 0) +
            (Number(expense.amount) || 0)
        );
      });

      const total = [
        ...totals.values(),
      ].reduce(
        (sum, amount) =>
          sum + amount,
        0
      );

      return [...totals.entries()]
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .map(
          ([category, amount]) => ({
            category,
            amount,
            percentage:
              total > 0
                ? (amount / total) * 100
                : 0,
          })
        );
    }, [
      categoryBreakdown,
      expenses,
    ]);

  const analysisTotalPages =
    Math.max(
      1,
      Math.ceil(
        analysisRows.length /
          ANALYSIS_ROWS
      )
    );

  const analysis =
    useMemo(() => {
      const safePage = Math.min(
        Math.max(analysisPage, 1),
        analysisTotalPages
      );

      const start =
        (safePage - 1) *
        ANALYSIS_ROWS;

      return analysisRows.slice(
        start,
        start + ANALYSIS_ROWS
      );
    }, [
      analysisPage,
      analysisRows,
      analysisTotalPages,
    ]);

  /* =========================================================
     FILTER STATE
  ========================================================= */

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    vendorFilter !== "ALL" ||
    dateFilter !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setVendorFilter("ALL");
    setDateFilter("ALL");
    setPage(1);
  };

  /* =========================================================
     FORM HELPERS
  ========================================================= */

  const updateForm = <
    K extends keyof ExpenseForm
  >(
    key: K,
    value: ExpenseForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openForm = () => {
    setError("");
    setSuccessMessage("");
    setStep(1);

    setForm({
      ...INITIAL_FORM,
      expenseDate: getToday(),
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setStep(1);
    setForm(INITIAL_FORM);
    setError("");
  };

  const handleNext = () => {
    setError("");

    if (step === 1) {
      const amount =
        Number(form.amount);

      if (!form.category) {
        setError(
          "Select an expense category."
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
          "Enter an amount greater than zero."
        );
        return;
      }

      if (!form.expenseDate) {
        setError(
          "Expense date is required."
        );
        return;
      }

      if (
        !form.description.trim()
      ) {
        setError(
          "Add a clear description for the expense."
        );
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (
        !form.expenseAccountId
      ) {
        setError(
          "Select the expense account."
        );
        return;
      }

      setStep(3);
    }
  };

  /* =========================================================
     CREATE EXPENSE
  ========================================================= */

  const handleCreate = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccessMessage("");

    const amount =
      Number(form.amount);

    if (!form.expenseAccountId) {
      setError(
        "Select the expense account before saving."
      );
      setStep(2);
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Amount must be greater than zero."
      );
      setStep(1);
      return;
    }

    try {
      setSaving(true);

      const response =
        await createExpense({
          category:
            form.category,
          description:
            form.description.trim(),
          amount,
          expenseDate:
            form.expenseDate,
          vendorId:
            form.vendorId ||
            undefined,
          expenseAccountId:
            form.expenseAccountId,
          paymentAccountId:
            form.paymentAccountId ||
            undefined,
          bankAccountId:
            form.bankAccountId ||
            undefined,
          paymentMethod:
            form.paymentMethod ||
            undefined,
        });

      setShowForm(false);
      setStep(1);
      setForm(INITIAL_FORM);

      setSuccessMessage(
        `${response.expenseCode} saved as a draft.`
      );

      await loadExpenses(
        1,
        pageSize
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to record the expense."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     SUBMIT / POST
  ========================================================= */

  const runExpenseAction = async (
    expense: Expense,
    action: "submit" | "post"
  ) => {
    if (busyId) return;

    setBusyId(expense.id);
    setError("");
    setSuccessMessage("");

    try {
      if (action === "submit") {
        await submitExpense(
          expense.id
        );

        setSuccessMessage(
          `${expense.expenseCode} submitted for approval.`
        );
      } else {
        await postExpense(
          expense.id
        );

        setSuccessMessage(
          `${expense.expenseCode} posted to the General Ledger.`
        );
      }

      await loadExpenses(
        page,
        pageSize
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          `Unable to ${action} this expense.`
        )
      );
    } finally {
      setBusyId("");
    }
  };

  /* =========================================================
     APPROVE + POST
  ========================================================= */

  const runApproveAndPost =
    async (expense: Expense) => {
      if (
        busyId ||
        !expense.approvalId
      ) {
        return;
      }

      if (
        !expense.expenseAccountId ||
        !expense.paymentAccountId
      ) {
        setError(
          "An expense account and payment account are required before posting to the General Ledger."
        );
        return;
      }

      setBusyId(expense.id);
      setError("");
      setSuccessMessage("");

      try {
        await approveExpense(
          expense.approvalId
        );

        await postExpense(
          expense.id
        );

        setSuccessMessage(
          `${expense.expenseCode} approved and posted to the General Ledger.`
        );

        await loadExpenses(
          page,
          pageSize
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            `Unable to approve and post ${expense.expenseCode}.`
          )
        );

        await loadExpenses(
          page,
          pageSize
        );
      } finally {
        setBusyId("");
      }
    };

  /* =========================================================
     APPROVE PAYMENT
  ========================================================= */

  const runApprovePayment =
    async (expense: Expense) => {
      if (
        busyId ||
        !expense.paymentApprovalId
      ) {
        return;
      }

      setBusyId(expense.id);
      setError("");
      setSuccessMessage("");

      try {
        await approveExpense(
          expense.paymentApprovalId
        );

        setSuccessMessage(
          `${expense.expenseCode} payment approved successfully.`
        );

        await loadExpenses(
          page,
          pageSize
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            `Unable to approve payment for ${expense.expenseCode}.`
          )
        );
      } finally {
        setBusyId("");
      }
    };

  /* =========================================================
     DELETE DRAFT
  ========================================================= */

  const runDelete = async (
    expense: Expense
  ) => {
    if (busyId) return;

    const confirmed =
      window.confirm(
        `Delete draft ${expense.expenseCode}? This action cannot be undone.`
      );

    if (!confirmed) return;

    setBusyId(expense.id);
    setError("");
    setSuccessMessage("");

    try {
      await deleteExpense(
        expense.id
      );

      if (
        selectedExpense?.id ===
        expense.id
      ) {
        setSelectedExpense(null);
      }

      setSuccessMessage(
        `${expense.expenseCode} deleted.`
      );

      await loadExpenses(
        page,
        pageSize
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to delete the draft expense."
        )
      );
    } finally {
      setBusyId("");
    }
  };

  /* =========================================================
     PAYMENT
  ========================================================= */

  const openPayment = (
    expense: Expense
  ) => {
    setSelectedExpense(expense);
    setPaymentDate(getToday());
    setPaymentReference("");
    setPaymentMethod(
      expense.paymentMethod ||
        ""
    );
    setPaymentBankAccountId(
      expense.bankAccountId ||
        ""
    );
    setShowPayment(true);
  };

  const handlePayment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !selectedExpense ||
      busyId
    ) {
      return;
    }

    setError("");

    if (!paymentMethod) {
      setError(
        "Select a payment method."
      );
      return;
    }

    if (
      !paymentReference.trim()
    ) {
      setError(
        "Enter the payment reference."
      );
      return;
    }

    const bankRequired = [
      "BANK",
      "BANK_TRANSFER",
      "CHEQUE",
    ].includes(paymentMethod);

    const effectiveBankAccount =
      paymentBankAccountId ||
      selectedExpense.bankAccountId ||
      "";

    if (
      bankRequired &&
      !effectiveBankAccount
    ) {
      setError(
        "Select the bank account used for this payment."
      );
      return;
    }

    setBusyId(
      selectedExpense.id
    );

    try {
      await recordExpensePayment(
        selectedExpense.id,
        {
          paymentDate,
          paymentReference:
            paymentReference.trim(),
          paymentMethod,
          bankAccountId:
            effectiveBankAccount ||
            undefined,
        }
      );

      setShowPayment(false);

      setSuccessMessage(
        `${selectedExpense.expenseCode} payment submitted for approval.`
      );

      await loadExpenses(
        page,
        pageSize
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to record the payment."
        )
      );
    } finally {
      setBusyId("");
    }
  };

  /* =========================================================
     EXPORT
  ========================================================= */

  const handleExport = () => {
    if (!expenses.length) {
      return;
    }

    const headers = [
      "Expense Code",
      "Category",
      "Description",
      "Vendor",
      "Expense Account",
      "Payment Account",
      "Amount (KES)",
      "Date",
      "Status",
      "Payment Status",
    ];

    const rows =
      expenses.map(
        (expense) => [
          expense.expenseCode,
          expense.category,
          expense.description ||
            "",
          expense.vendor?.name ||
            "",
          accountLabel(
            expense.expenseAccount
          ),
          accountLabel(
            expense.paymentAccount
          ),
          Number(
            expense.amount
          ).toFixed(2),
          formatDate(
            expense.expenseDate
          ),
          statusLabel(
            expense.status
          ),
          expense.paymentStatus ||
            "UNPAID",
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(csvSafe)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `expenses-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);
  };

  /* =========================================================
     SELECTED STATUS
  ========================================================= */

  const selectedStatus =
    selectedExpense
      ? normalizeStatus(
          selectedExpense.status
        )
      : "";

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0 space-y-6 pb-10">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="flex flex-col gap-5 border-b border-[#E9EAF0] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#858BA0]">
            <span>
              Business Operations
            </span>

            <span className="h-1 w-1 rounded-full bg-[#B8BCC8]" />

            <span>Expenses</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#20243A] text-white">
              <Receipt size={20} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-3xl font-bold tracking-[-0.03em] text-[#20243A]">
                Expenses
              </h1>

              <p className="mt-1 text-sm text-[#858BA0]">
                Manage business spending,
                approvals and General Ledger
                posting from one workspace.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={
              !expenses.length ||
              loading
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm font-semibold text-[#596077] transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            onClick={() =>
              void loadExpenses(
                page,
                pageSize
              )
            }
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm font-semibold text-[#596077] transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
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
            onClick={openForm}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B7A70]"
          >
            <Plus size={17} />
            Record expense
          </button>
        </div>
      </header>

      {/* =====================================================
          ALERT
      ===================================================== */}

      {(error ||
        successMessage) && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error ? (
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <CheckCircle2
              size={17}
              className="mt-0.5 shrink-0"
            />
          )}

          <span className="min-w-0 flex-1">
            {error ||
              successMessage}
          </span>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => {
              setError("");
              setSuccessMessage("");
            }}
            className="rounded-lg p-0.5 opacity-70 hover:opacity-100"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total spend"
          value={formatCurrency(
            summary.totalSpend
          )}
          detail={`${pagination.total} recorded expenses`}
          icon={
            <Wallet size={18} />
          }
        />

        <StatCard
          label="Pending"
          value={formatCurrency(
            summary.pending
          )}
          detail="Awaiting approval"
          icon={
            <Clock3 size={18} />
          }
          onClick={() => {
            setStatusFilter(
              "PENDING_APPROVAL"
            );
            setPage(1);
          }}
          active={
            statusFilter ===
            "PENDING_APPROVAL"
          }
        />

        <StatCard
          label="Posted"
          value={formatCurrency(
            summary.posted
          )}
          detail="Connected to the ledger"
          icon={
            <FileText size={18} />
          }
          onClick={() => {
            setStatusFilter(
              "POSTED"
            );
            setPage(1);
          }}
          active={
            statusFilter ===
            "POSTED"
          }
        />

        <StatCard
          label="Paid"
          value={formatCurrency(
            summary.paid
          )}
          detail="Payment completed"
          icon={
            <CreditCard size={18} />
          }
          onClick={() => {
            setStatusFilter(
              "PAID"
            );
            setPage(1);
          }}
          active={
            statusFilter ===
            "PAID"
          }
        />
      </section>

      {/* =====================================================
          EXPENSE LEDGER
      ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-[0_1px_2px_rgba(20,24,39,0.02)]">
        <div className="border-b border-[#E9EBF0] p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* SEARCH */}

            <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-[#DFE1E8] bg-[#FBFCFD] px-3 transition focus-within:border-[#20243A] focus-within:bg-white">
              <Search
                size={17}
                className="shrink-0 text-[#8A90A5]"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search expenses, vendors, codes or descriptions"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="rounded-lg p-1 text-[#7A8097] hover:bg-[#EFF1F5]"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* FILTERS */}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex">
              <div className="relative">
                <Filter
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DFE1E8] bg-white pl-9 pr-8 text-sm font-medium text-[#596077] outline-none focus:border-[#20243A] xl:w-44"
                >
                  <option value="ALL">
                    All statuses
                  </option>

                  <option value="PENDING_APPROVAL">
                    Pending approval
                  </option>

                  <option value="DRAFT">
                    Draft
                  </option>

                  <option value="APPROVED">
                    Approved
                  </option>

                  <option value="POSTED">
                    Posted
                  </option>

                  <option value="PAID">
                    Paid
                  </option>

                  <option value="REJECTED">
                    Rejected
                  </option>
                </select>

                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />
              </div>

              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DFE1E8] bg-white px-3 pr-8 text-sm font-medium text-[#596077] outline-none focus:border-[#20243A] xl:w-48"
                >
                  <option value="ALL">
                    All categories
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />
              </div>

              <div className="relative">
                <select
                  value={vendorFilter}
                  onChange={(event) => {
                    setVendorFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DFE1E8] bg-white px-3 pr-8 text-sm font-medium text-[#596077] outline-none focus:border-[#20243A] xl:w-48"
                >
                  <option value="ALL">
                    All vendors
                  </option>

                  {vendors.map(
                    (vendor) => (
                      <option
                        key={vendor.id}
                        value={vendor.id}
                      >
                        {vendor.name}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />
              </div>

              <div className="relative">
                <CalendarDays
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />

                <select
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DFE1E8] bg-white pl-9 pr-8 text-sm font-medium text-[#596077] outline-none focus:border-[#20243A] xl:w-44"
                >
                  <option value="ALL">
                    All dates
                  </option>

                  <option value="THIS_MONTH">
                    This month
                  </option>

                  <option value="LAST_30_DAYS">
                    Last 30 days
                  </option>

                  <option value="THIS_YEAR">
                    This year
                  </option>
                </select>

                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {statusFilter !==
                "ALL" && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(
                      "ALL"
                    );
                    setPage(1);
                  }}
                  className="rounded-full bg-[#F1F3F6] px-3 py-1.5 text-xs font-semibold text-[#596077]"
                >
                  {statusLabel(
                    statusFilter
                  )}
                  <span className="ml-1.5">
                    ×
                  </span>
                </button>
              )}

              {categoryFilter !==
                "ALL" && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter(
                      "ALL"
                    );
                    setPage(1);
                  }}
                  className="rounded-full bg-[#F1F3F6] px-3 py-1.5 text-xs font-semibold text-[#596077]"
                >
                  {categoryFilter}
                  <span className="ml-1.5">
                    ×
                  </span>
                </button>
              )}

              {vendorFilter !==
                "ALL" && (
                <button
                  type="button"
                  onClick={() => {
                    setVendorFilter(
                      "ALL"
                    );
                    setPage(1);
                  }}
                  className="rounded-full bg-[#F1F3F6] px-3 py-1.5 text-xs font-semibold text-[#596077]"
                >
                  {
                    vendors.find(
                      (vendor) =>
                        vendor.id ===
                        vendorFilter
                    )?.name
                  }
                  <span className="ml-1.5">
                    ×
                  </span>
                </button>
              )}

              {dateFilter !==
                "ALL" && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter(
                      "ALL"
                    );
                    setPage(1);
                  }}
                  className="rounded-full bg-[#F1F3F6] px-3 py-1.5 text-xs font-semibold text-[#596077]"
                >
                  {dateFilter ===
                  "THIS_MONTH"
                    ? "This month"
                    : dateFilter ===
                        "LAST_30_DAYS"
                      ? "Last 30 days"
                      : "This year"}

                  <span className="ml-1.5">
                    ×
                  </span>
                </button>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-bold text-[#0D9488] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            <p className="text-xs text-[#8A90A5]">
              {pagination.total} expense
              {pagination.total ===
              1
                ? ""
                : "s"}
            </p>
          </div>
        </div>

        {/* TABLE */}

        {loading ? (
          <div className="flex min-h-80 flex-col items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin text-[#20243A]"
            />

            <p className="mt-3 text-sm text-[#858BA0]">
              Loading expense ledger...
            </p>
          </div>
        ) : expenses.length ===
          0 ? (
          <EmptyState
            title={
              hasActiveFilters
                ? "No matching expenses"
                : "No expenses recorded"
            }
            detail={
              hasActiveFilters
                ? "Try another search term or remove one of the filters."
                : "Record your first expense to begin building the organization's spending history."
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-10 items-center rounded-xl border border-[#E0E2E8] px-4 text-sm font-semibold text-[#596077] hover:bg-[#F8F9FB]"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openForm}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-bold text-white"
                >
                  <Plus size={16} />
                  Record first expense
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b border-[#E9EBF0] bg-[#FAFBFC]">
                    <th className="w-[250px] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#858BA0]">
                      Expense
                    </th>

                    <th className="w-[150px] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#858BA0]">
                      Category
                    </th>

                    <th className="w-[190px] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#858BA0]">
                      Vendor
                    </th>

                    <th className="w-[220px] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#858BA0]">
                      Account
                    </th>

                    <th className="w-[150px] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-[#858BA0]">
                      Amount
                    </th>

                    <th className="w-[150px] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#858BA0]">
                      Status
                    </th>

                    <th className="w-14 px-3 py-3" />
                  </tr>
                </thead>

                <tbody>
                  {expenses.map(
                    (expense) => (
                      <tr
                        key={expense.id}
                        className="group border-b border-[#F0F1F5] last:border-b-0 hover:bg-[#FCFDFE]"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedExpense(
                                expense
                              )
                            }
                            className="text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F6F9] text-[#20243A]">
                                <Receipt
                                  size={
                                    16
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="font-mono text-[11px] font-bold text-[#20243A]">
                                  {
                                    expense.expenseCode
                                  }
                                </p>

                                <p className="mt-0.5 max-w-[280px] truncate font-semibold text-[#30364C]">
                                  {
                                    expense.description
                                  }
                                </p>

                                <p className="mt-0.5 text-[11px] text-[#9297A9]">
                                  {formatDate(
                                    expense.expenseDate
                                  )}
                                </p>
                              </div>
                            </div>
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex max-w-[140px] rounded-lg bg-[#F6F7F9] px-2.5 py-1.5 text-xs font-medium text-[#596077]">
                            <span className="truncate">
                              {
                                expense.category
                              }
                            </span>
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="max-w-[180px]">
                            <p className="truncate text-sm font-medium text-[#4D5369]">
                              {expense
                                .vendor
                                ?.name ||
                                "No vendor"}
                            </p>

                            {expense.vendor
                              ?.vendorCode && (
                              <p className="mt-0.5 text-[11px] text-[#9297A9]">
                                {
                                  expense
                                    .vendor
                                    .vendorCode
                                }
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="max-w-[210px]">
                            <p className="truncate text-xs font-semibold text-[#4D5369]">
                              {expense
                                .expenseAccount
                                ?.code ||
                                "—"}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-[#858BA0]">
                              {expense
                                .expenseAccount
                                ?.name ||
                                "Not assigned"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <p className="whitespace-nowrap text-sm font-bold text-[#20243A]">
                            {formatCurrency(
                              Number(
                                expense.amount
                              ) || 0
                            )}
                          </p>

                          <p className="mt-0.5 text-[10px] font-medium text-[#9297A9]">
                            {expense.currency ||
                              "KES"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusTone(
                                expense.status
                              )}`}
                            >
                              {statusLabel(
                                expense.status
                              )}
                            </span>

                            <span
                              className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold ${paymentTone(
                                expense.paymentStatus
                              )}`}
                            >
                              {statusLabel(
                                expense.paymentStatus
                              )}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedExpense(
                                expense
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#777D91] opacity-70 transition hover:bg-[#F0F1F5] hover:text-[#20243A] group-hover:opacity-100"
                            aria-label={`Open ${expense.expenseCode}`}
                          >
                            <MoreHorizontal
                              size={17}
                            />
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}

            <div className="divide-y divide-[#F0F1F5] lg:hidden">
              {expenses.map(
                (expense) => (
                  <button
                    key={expense.id}
                    type="button"
                    onClick={() =>
                      setSelectedExpense(
                        expense
                      )
                    }
                    className="block w-full p-4 text-left transition hover:bg-[#FCFDFE]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F6F9] text-[#20243A]">
                          <Receipt
                            size={16}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-bold text-[#20243A]">
                            {
                              expense.expenseCode
                            }
                          </p>

                          <p className="mt-1 truncate text-sm font-semibold text-[#30364C]">
                            {
                              expense.description
                            }
                          </p>

                          <p className="mt-1 text-xs text-[#858BA0]">
                            {
                              expense.category
                            }{" "}
                            ·{" "}
                            {formatDate(
                              expense.expenseDate
                            )}
                          </p>
                        </div>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-[#20243A]">
                        {formatCurrency(
                          Number(
                            expense.amount
                          ) || 0
                        )}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusTone(
                          expense.status
                        )}`}
                      >
                        {statusLabel(
                          expense.status
                        )}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${paymentTone(
                          expense.paymentStatus
                        )}`}
                      >
                        {statusLabel(
                          expense.paymentStatus
                        )}
                      </span>
                    </div>
                  </button>
                )
              )}
            </div>

            <Pagination
              pagination={pagination}
              pageSize={pageSize}
              onPageChange={(nextPage) => {
                setPage(nextPage);

                void loadExpenses(
                  nextPage,
                  pageSize
                );
              }}
              onPageSizeChange={(
                nextSize
              ) => {
                setPageSize(
                  nextSize
                );
                setPage(1);

                void loadExpenses(
                  1,
                  nextSize
                );
              }}
            />
          </>
        )}
      </section>

      {/* =====================================================
          LOWER WORKSPACE
      ===================================================== */}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        {/* SPEND ANALYSIS */}

        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,39,0.02)] sm:p-6">
          <SectionHeader
            eyebrow="Analysis"
            title="Spend analysis"
            detail="Highest expense categories in the current dataset."
          />

          <div className="mt-6 min-w-0">
            {analysis.length === 0 ? (
              <EmptyState
                title="No spend data"
                detail="Category analysis will appear once expenses are recorded."
              />
            ) : (
              <>
                <div className="space-y-5">
                  {analysis.map(
                    (item, index) => {
                      const percentage =
                        Math.min(
                          Math.max(
                            Number(
                              item.percentage
                            ) || 0,
                            0
                          ),
                          100
                        );

                      return (
                        <div
                          key={`${item.category}-${index}`}
                          className="min-w-0"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-semibold leading-5 text-[#30364C]">
                                {item.category}
                              </p>

                              <p className="mt-0.5 text-xs text-[#858BA0]">
                                {percentage.toFixed(
                                  1
                                )}
                                % of analysed spend
                              </p>
                            </div>

                            <p className="max-w-[48%] shrink-0 break-all text-right text-sm font-bold leading-5 text-[#20243A]">
                              {formatCurrency(
                                item.amount
                              )}
                            </p>
                          </div>

                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F0F1F4]">
                            <div
                              className="h-full max-w-full rounded-full bg-[#0D9488] transition-all"
                              style={{
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                <PanelPagination
                  pagination={{
                    page: Math.min(
                      analysisPage,
                      analysisTotalPages
                    ),
                    pageSize:
                      ANALYSIS_ROWS,
                    total:
                      analysisRows.length,
                    totalPages:
                      analysisTotalPages,
                    hasPreviousPage:
                      analysisPage > 1,
                    hasNextPage:
                      analysisPage <
                      analysisTotalPages,
                  }}
                  onPageChange={(nextPage) =>
                    setAnalysisPage(
                      Math.min(
                        Math.max(nextPage, 1),
                        analysisTotalPages
                      )
                    )
                  }
                />
              </>
            )}
          </div>
        </section>

        {/* APPROVAL QUEUE */}

        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,39,0.02)] sm:p-6">
          <SectionHeader
            eyebrow="Workflow"
            title="Approval queue"
            detail="Expenses currently awaiting authorization."
            action={
              summary.pending > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(
                      "PENDING_APPROVAL"
                    );
                    setPage(1);

                    window.scrollTo({
                      top: 0,
                      behavior:
                        "smooth",
                    });
                  }}
                  className="text-xs font-bold text-[#0D9488] hover:underline"
                >
                  View all
                </button>
              ) : undefined
            }
          />

          <div className="mt-5 min-w-0">
            {approvalLoading ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[#DDE0E7] bg-[#FAFBFC]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#858BA0]">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading approval queue...
                </div>
              </div>
            ) : approvalQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DDE0E7] bg-[#FAFBFC] px-4 py-8 text-center">
                <CheckCircle2
                  size={22}
                  className="mx-auto text-emerald-600"
                />

                <p className="mt-3 text-sm font-bold text-[#30364C]">
                  Approval queue is clear
                </p>

                <p className="mt-1 text-xs leading-5 text-[#858BA0]">
                  There are no pending expense approvals matching the current filters.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {approvalQueue.map(
                    (expense) => (
                      <button
                        key={expense.id}
                        type="button"
                        onClick={() =>
                          setSelectedExpense(
                            expense
                          )
                        }
                        className="flex min-w-0 w-full items-start gap-3 overflow-hidden rounded-xl border border-[#ECEEF2] p-3 text-left transition hover:border-[#D9DCE4] hover:bg-[#FAFBFC]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                          <Clock3 size={16} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <p className="min-w-0 break-all font-mono text-[10px] font-bold text-[#20243A]">
                              {expense.expenseCode}
                            </p>

                            <p className="max-w-[52%] shrink-0 break-all text-right text-xs font-bold leading-5 text-[#20243A]">
                              {formatCurrency(
                                Number(
                                  expense.amount
                                ) || 0
                              )}
                            </p>
                          </div>

                          <p className="mt-1 break-words text-xs font-medium leading-5 text-[#596077]">
                            {expense.description}
                          </p>

                          <p className="mt-1 break-words text-[10px] leading-4 text-[#9297A9]">
                            {expense.vendor?.name ||
                              "No vendor"}
                          </p>
                        </div>
                      </button>
                    )
                  )}
                </div>

                <PanelPagination
                  pagination={approvalPagination}
                  onPageChange={(nextPage) =>
                    void loadApprovalQueue(
                      nextPage
                    )
                  }
                />
              </>
            )}
          </div>
        </section>
      </div>

      {/* =====================================================
          CREATE EXPENSE MODAL
      ===================================================== */}

      {showForm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#141827]/45 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeForm();
            }
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-[#E9EBF0] px-5 py-5 sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0D9488]">
                  Expense workflow
                </p>

                <h2 className="mt-1 text-xl font-bold tracking-tight text-[#20243A]">
                  Record expense
                </h2>

                <p className="mt-1 text-xs text-[#858BA0]">
                  Create a draft first. Approval
                  and General Ledger posting happen
                  through the controlled workflow.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close expense form"
                className="rounded-xl p-2 text-[#858BA0] hover:bg-[#F4F5F8]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="border-b border-[#E9EBF0] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex flex-1 items-center gap-2"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          item <= step
                            ? "bg-[#20243A] text-white"
                            : "bg-[#F1F2F5] text-[#8B90A2]"
                        }`}
                      >
                        {item <
                        step ? (
                          <Check
                            size={14}
                          />
                        ) : (
                          item
                        )}
                      </div>

                      <div className="hidden min-w-0 sm:block">
                        <p
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            item <= step
                              ? "text-[#20243A]"
                              : "text-[#9A9FAE]"
                          }`}
                        >
                          {item === 1
                            ? "Details"
                            : item === 2
                              ? "Accounting"
                              : "Review"}
                        </p>
                      </div>

                      {item < 3 && (
                        <div
                          className={`h-px flex-1 ${
                            item < step
                              ? "bg-[#20243A]"
                              : "bg-[#E3E5EA]"
                          }`}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <form
              onSubmit={handleCreate}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <div className="p-5 sm:p-7">
                {step === 1 && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field
                      label="Category"
                      required
                    >
                      <select
                        value={
                          form.category
                        }
                        onChange={(event) =>
                          updateForm(
                            "category",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          saving
                        }
                        className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                      >
                        <option value="">
                          Select category
                        </option>

                        {categories.map(
                          (
                            category
                          ) => (
                            <option
                              key={
                                category
                              }
                              value={
                                category
                              }
                            >
                              {
                                category
                              }
                            </option>
                          )
                        )}
                      </select>
                    </Field>

                    <Field label="Expense date" required>
                      <input
                        type="date"
                        value={
                          form.expenseDate
                        }
                        onChange={(event) =>
                          updateForm(
                            "expenseDate",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          saving
                        }
                        className="h-12 w-full rounded-xl border border-[#DFE1E8] px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                      />
                    </Field>

                    <Field
                      label="Amount"
                      required
                    >
                      <div className="flex h-12 items-center rounded-xl border border-[#DFE1E8] px-4 focus-within:border-[#20243A]">
                        <span className="mr-3 text-xs font-bold text-[#858BA0]">
                          KES
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            form.amount
                          }
                          onChange={(
                            event
                          ) =>
                            updateForm(
                              "amount",
                              event.target
                                .value
                            )
                          }
                          disabled={
                            saving
                          }
                          placeholder="0.00"
                          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#20243A] outline-none"
                        />
                      </div>
                    </Field>

                    <Field label="Vendor">
                      <select
                        value={
                          form.vendorId
                        }
                        onChange={(event) =>
                          updateForm(
                            "vendorId",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          saving ||
                          supportingLoading
                        }
                        className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                      >
                        <option value="">
                          No vendor
                        </option>

                        {vendors.map(
                          (vendor) => (
                            <option
                              key={
                                vendor.id
                              }
                              value={
                                vendor.id
                              }
                            >
                              {vendor.name}
                              {vendor.vendorCode
                                ? ` · ${vendor.vendorCode}`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </Field>

                    <div className="md:col-span-2">
                      <Field
                        label="Description"
                        required
                        hint="Use a clear description that will remain meaningful in the accounting trail."
                      >
                        <textarea
                          value={
                            form.description
                          }
                          onChange={(
                            event
                          ) =>
                            updateForm(
                              "description",
                              event.target
                                .value
                            )
                          }
                          disabled={
                            saving
                          }
                          rows={4}
                          placeholder="e.g. Monthly office internet subscription"
                          className="w-full resize-none rounded-xl border border-[#DFE1E8] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Field
                        label="Expense account"
                        required
                        hint="The expense account is debited when the transaction is posted."
                      >
                        <select
                          value={
                            form.expenseAccountId
                          }
                          onChange={(
                            event
                          ) =>
                            updateForm(
                              "expenseAccountId",
                              event.target
                                .value
                            )
                          }
                          disabled={
                            saving ||
                            supportingLoading
                          }
                          className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                        >
                          <option value="">
                            Select expense account
                          </option>

                          {expenseAccounts.map(
                            (
                              account
                            ) => (
                              <option
                                key={
                                  account.id
                                }
                                value={
                                  account.id
                                }
                              >
                                {
                                  account.code
                                }{" "}
                                ·{" "}
                                {
                                  account.name
                                }
                              </option>
                            )
                          )}
                        </select>
                      </Field>
                    </div>

                    <Field
                      label="Payment / credit account"
                      hint="Required before the expense can be submitted and posted."
                    >
                      <select
                        value={
                          form.paymentAccountId
                        }
                        onChange={(
                          event
                        ) =>
                          updateForm(
                            "paymentAccountId",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          saving ||
                          supportingLoading
                        }
                        className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                      >
                        <option value="">
                          Select payment / credit account
                        </option>

                        {paymentAccounts.map(
                          (
                            account
                          ) => (
                            <option
                              key={
                                account.id
                              }
                              value={
                                account.id
                              }
                            >
                              {
                                account.code
                              }{" "}
                              ·{" "}
                              {
                                account.name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </Field>

                    <Field label="Payment method">
                      <select
                        value={
                          form.paymentMethod
                        }
                        onChange={(
                          event
                        ) =>
                          updateForm(
                            "paymentMethod",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          saving
                        }
                        className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                      >
                        <option value="">
                          Select if known
                        </option>

                        <option value="BANK_TRANSFER">
                          Bank transfer
                        </option>

                        <option value="BANK">
                          Bank
                        </option>

                        <option value="MPESA">
                          M-Pesa
                        </option>

                        <option value="CASH">
                          Cash
                        </option>

                        <option value="CHEQUE">
                          Cheque
                        </option>

                        <option value="OTHER">
                          Other
                        </option>
                      </select>
                    </Field>

                    <Field
                      label="Bank account"
                      hint="Optional during draft creation. Required when a bank-based payment is recorded."
                    >
                      <select
                        value={
                          form.bankAccountId
                        }
                        onChange={(
                          event
                        ) =>
                          updateForm(
                            "bankAccountId",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          saving ||
                          supportingLoading
                        }
                        className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                      >
                        <option value="">
                          Select bank account
                        </option>

                        {bankAccounts.map(
                          (
                            bank
                          ) => (
                            <option
                              key={
                                bank.id
                              }
                              value={
                                bank.id
                              }
                            >
                              {bankLabel(
                                bank
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </Field>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[#E6E8EE] bg-white p-5">
                      <SectionHeader
                        eyebrow="Review"
                        title="Expense details"
                      />

                      <div className="mt-4">
                        <DetailRow
                          label="Category"
                          value={
                            form.category ||
                            "—"
                          }
                        />

                        <DetailRow
                          label="Description"
                          value={
                            form.description ||
                            "—"
                          }
                        />

                        <DetailRow
                          label="Amount"
                          value={formatCurrency(
                            Number(
                              form.amount
                            ) || 0
                          )}
                        />

                        <DetailRow
                          label="Date"
                          value={formatDate(
                            form.expenseDate
                          )}
                        />

                        <DetailRow
                          label="Vendor"
                          value={
                            vendors.find(
                              (
                                vendor
                              ) =>
                                vendor.id ===
                                form.vendorId
                            )?.name ||
                            "No vendor"
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E6E8EE] bg-[#FAFBFC] p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#20243A]">
                          <BarChart3
                            size={18}
                          />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-[#20243A]">
                            Posting preview
                          </p>

                          <p className="text-xs text-[#858BA0]">
                            Double-entry treatment
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2">
                        <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-[#E5E7EC]">
                          <div className="flex justify-between gap-3">
                            <span className="text-xs font-bold text-[#858BA0]">
                              DR
                            </span>

                            <span className="text-right text-xs font-bold text-[#20243A]">
                              {accountLabel(
                                expenseAccounts.find(
                                  (
                                    account
                                  ) =>
                                    account.id ===
                                    form.expenseAccountId
                                )
                              )}
                            </span>
                          </div>

                          <p className="mt-2 text-right text-sm font-bold text-[#20243A]">
                            {formatCurrency(
                              Number(
                                form.amount
                              ) || 0
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-[#E5E7EC]">
                          <div className="flex justify-between gap-3">
                            <span className="text-xs font-bold text-[#858BA0]">
                              CR
                            </span>

                            <span className="text-right text-xs font-bold text-[#20243A]">
                              {accountLabel(
                                paymentAccounts.find(
                                  (
                                    account
                                  ) =>
                                    account.id ===
                                    form.paymentAccountId
                                )
                              )}
                            </span>
                          </div>

                          <p className="mt-2 text-right text-sm font-bold text-[#20243A]">
                            {formatCurrency(
                              Number(
                                form.amount
                              ) || 0
                            )}
                          </p>
                        </div>
                      </div>

                      {!form.paymentAccountId && (
                        <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                          <AlertCircle
                            size={15}
                            className="mt-0.5 shrink-0"
                          />

                          <span>
                            A payment / credit
                            account is not selected.
                            The draft can be saved,
                            but it cannot be submitted
                            until one is assigned.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle
                      size={16}
                      className="mt-0.5 shrink-0"
                    />

                    <span>
                      {error}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E9EBF0] bg-white px-5 py-4 sm:px-7">
                <button
                  type="button"
                  onClick={
                    step === 1
                      ? closeForm
                      : () =>
                          setStep(
                            (current) =>
                              current -
                              1
                          )
                  }
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E0E2E8] px-4 text-sm font-semibold text-[#596077] hover:bg-[#F8F9FB]"
                >
                  <ArrowLeft size={16} />

                  {step === 1
                    ? "Cancel"
                    : "Back"}
                </button>

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={
                      handleNext
                    }
                    disabled={saving}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#20243A] px-5 text-sm font-bold text-white hover:bg-[#171B2D]"
                  >
                    Continue
                    <ArrowRight
                      size={16}
                    />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      saving
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white hover:bg-[#0B7A70] disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Check
                        size={16}
                      />
                    )}

                    {saving
                      ? "Saving draft..."
                      : "Save draft"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          DETAIL DRAWER
      ===================================================== */}

      {selectedExpense &&
        !showPayment && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-[#141827]/35 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setSelectedExpense(
                  null
                );
              }
            }}
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="expense-detail-title"
              className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-start justify-between border-b border-[#E9EBF0] px-5 py-5 sm:px-7">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-[#858BA0]">
                    {
                      selectedExpense.expenseCode
                    }
                  </p>

                  <h2
                    id="expense-detail-title"
                    className="mt-1 truncate text-xl font-bold tracking-tight text-[#20243A]"
                  >
                    {
                      selectedExpense.description
                    }
                  </h2>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusTone(
                        selectedExpense.status
                      )}`}
                    >
                      {statusLabel(
                        selectedExpense.status
                      )}
                    </span>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${paymentTone(
                        selectedExpense.paymentStatus
                      )}`}
                    >
                      {statusLabel(
                        selectedExpense.paymentStatus
                      )}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedExpense(
                      null
                    )
                  }
                  aria-label="Close expense details"
                  className="shrink-0 rounded-xl p-2 text-[#858BA0] hover:bg-[#F4F5F8]"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-7 p-5 sm:p-7">
                  {/* AMOUNT */}

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#858BA0]">
                      Amount
                    </p>

                    <p className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                      {formatCurrency(
                        Number(
                          selectedExpense.amount
                        ) || 0
                      )}
                    </p>

                    <p className="mt-1 text-xs text-[#9297A9]">
                      {formatDate(
                        selectedExpense.expenseDate
                      )}{" "}
                      ·{" "}
                      {
                        selectedExpense.category
                      }
                    </p>
                  </div>

                  <Workflow
                    status={
                      selectedExpense.status
                    }
                    paymentStatus={
                      selectedExpense.paymentStatus ||
                      "UNPAID"
                    }
                  />

                  {/* ACTIONS */}

                  <div className="flex flex-wrap gap-2">
                    {selectedStatus ===
                      "DRAFT" && (
                      <>
                        <button
                          type="button"
                          disabled={
                            busyId ===
                            selectedExpense.id
                          }
                          onClick={() =>
                            void runExpenseAction(
                              selectedExpense,
                              "submit"
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20243A] px-4 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {busyId ===
                          selectedExpense.id ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
                          ) : (
                            <ArrowRight
                              size={15}
                            />
                          )}

                          Submit for approval
                        </button>

                        <button
                          type="button"
                          disabled={
                            busyId ===
                            selectedExpense.id
                          }
                          onClick={() =>
                            void runDelete(
                              selectedExpense
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2
                            size={15}
                          />
                          Delete draft
                        </button>
                      </>
                    )}

                    {(selectedStatus ===
                      "PENDING" ||
                      selectedStatus ===
                        "PENDING_APPROVAL") &&
                      selectedExpense.approvalId && (
                        <button
                          type="button"
                          disabled={
                            busyId ===
                            selectedExpense.id
                          }
                          onClick={() =>
                            void runApproveAndPost(
                              selectedExpense
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-bold text-white hover:bg-[#0B8278] disabled:opacity-60"
                        >
                          {busyId ===
                          selectedExpense.id ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
                          ) : (
                            <Check
                              size={15}
                            />
                          )}

                          Approve & Post
                        </button>
                      )}

                    {selectedStatus ===
                      "APPROVED" && (
                      <button
                        type="button"
                        disabled={
                          busyId ===
                          selectedExpense.id
                        }
                        onClick={() =>
                          void runExpenseAction(
                            selectedExpense,
                            "post"
                          )
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-bold text-white hover:bg-[#0B8278] disabled:opacity-60"
                      >
                        {busyId ===
                        selectedExpense.id ? (
                          <Loader2
                            size={15}
                            className="animate-spin"
                          />
                        ) : (
                          <Check
                            size={15}
                          />
                        )}

                        Post to General Ledger
                      </button>
                    )}

                    {selectedStatus ===
                      "POSTED" &&
                      selectedExpense.paymentStatus?.toUpperCase() ===
                        "PENDING_APPROVAL" &&
                      selectedExpense.paymentApprovalId && (
                        <button
                          type="button"
                          disabled={
                            busyId ===
                            selectedExpense.id
                          }
                          onClick={() =>
                            void runApprovePayment(
                              selectedExpense
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-bold text-white hover:bg-[#0B8278] disabled:opacity-60"
                        >
                          {busyId ===
                          selectedExpense.id ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
                          ) : (
                            <Check
                              size={15}
                            />
                          )}

                          Approve Payment
                        </button>
                      )}

                    {selectedStatus ===
                      "POSTED" &&
                      ![
                        "PAID",
                        "PENDING_APPROVAL",
                      ].includes(
                        selectedExpense.paymentStatus?.toUpperCase() ||
                          ""
                      ) && (
                        <button
                          type="button"
                          onClick={() =>
                            openPayment(
                              selectedExpense
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20243A] px-4 text-sm font-bold text-white"
                        >
                          <CreditCard
                            size={15}
                          />
                          Record payment
                        </button>
                      )}
                  </div>

                  {/* DETAILS */}

                  <section>
                    <SectionHeader
                      eyebrow="Transaction"
                      title="Expense details"
                    />

                    <div className="mt-3 rounded-2xl border border-[#E6E8EE] px-4">
                      <DetailRow
                        label="Vendor"
                        value={
                          selectedExpense
                            .vendor
                            ?.name ||
                          "No vendor"
                        }
                      />

                      <DetailRow
                        label="Category"
                        value={
                          selectedExpense.category
                        }
                      />

                      <DetailRow
                        label="Expense date"
                        value={formatDate(
                          selectedExpense.expenseDate
                        )}
                      />

                      <DetailRow
                        label="Expense account"
                        value={accountLabel(
                          selectedExpense.expenseAccount
                        )}
                      />

                      <DetailRow
                        label="Payment account"
                        value={accountLabel(
                          selectedExpense.paymentAccount
                        )}
                      />

                      <DetailRow
                        label="Bank account"
                        value={bankLabel(
                          selectedExpense.bankAccount
                        )}
                      />

                      <DetailRow
                        label="Payment method"
                        value={
                          selectedExpense.paymentMethod ||
                          "Not recorded"
                        }
                      />

                      <DetailRow
                        label="Payment reference"
                        value={
                          selectedExpense.paymentReference ||
                          "Not recorded"
                        }
                      />
                    </div>
                  </section>

                  {/* GENERAL LEDGER */}

                  <section>
                    <SectionHeader
                      eyebrow="Accounting"
                      title="General Ledger"
                    />

                    <div className="mt-3 rounded-2xl border border-[#E6E8EE] bg-[#FAFBFC] p-4">
                      {selectedExpense.journalEntryId ? (
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <CheckCircle2
                              size={18}
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#20243A]">
                              Journal entry linked
                            </p>

                            <p className="mt-1 text-xs leading-5 text-[#858BA0]">
                              This expense has been
                              posted through the General
                              Ledger.
                            </p>

                            {selectedExpense
                              .journalEntry
                              ?.reference && (
                              <p className="mt-2 font-mono text-xs font-bold text-[#596077]">
                                {
                                  selectedExpense
                                    .journalEntry
                                    .reference
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <Clock3
                              size={18}
                            />
                          </div>

                          <div>
                            <p className="text-sm font-bold text-[#20243A]">
                              Not posted
                            </p>

                            <p className="mt-1 text-xs leading-5 text-[#858BA0]">
                              The transaction does not
                              yet have a General Ledger
                              journal entry.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* APPROVAL */}

                  {selectedExpense.approval && (
                    <section>
                      <SectionHeader
                        eyebrow="Approval"
                        title="Review status"
                      />

                      <div className="mt-3 rounded-2xl border border-[#E6E8EE] px-4">
                        <DetailRow
                          label="Approval status"
                          value={statusLabel(
                            selectedExpense
                              .approval
                              .status
                          )}
                        />

                        <DetailRow
                          label="Approval ID"
                          value={
                            selectedExpense.approvalId ||
                            "—"
                          }
                        />

                        <DetailRow
                          label="Requested by"
                          value={
                            selectedExpense
                              .approval
                              .requestedBy ||
                            "—"
                          }
                        />

                        <DetailRow
                          label="Created"
                          value={formatDate(
                            selectedExpense
                              .approval
                              .createdAt
                          )}
                        />
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

      {/* =====================================================
          PAYMENT MODAL
      ===================================================== */}

      {showPayment &&
        selectedExpense && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#141827]/45 p-3 backdrop-blur-[2px] sm:p-6"
            onMouseDown={(event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !busyId
              ) {
                setShowPayment(false);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-title"
              className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-[#E9EBF0] px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0D9488]">
                    Payment
                  </p>

                  <h2
                    id="payment-title"
                    className="mt-1 text-xl font-bold tracking-tight text-[#20243A]"
                  >
                    Record payment
                  </h2>

                  <p className="mt-1 text-xs text-[#858BA0]">
                    {
                      selectedExpense.expenseCode
                    }{" "}
                    ·{" "}
                    {formatCurrency(
                      Number(
                        selectedExpense.amount
                      ) || 0
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowPayment(
                      false
                    )
                  }
                  disabled={
                    Boolean(busyId)
                  }
                  aria-label="Close payment dialog"
                  className="rounded-xl p-2 text-[#858BA0] hover:bg-[#F4F5F8]"
                >
                  <X size={19} />
                </button>
              </div>

              <form
                onSubmit={
                  handlePayment
                }
                className="p-5 sm:p-6"
              >
                <div className="space-y-5">
                  <Field
                    label="Payment date"
                    required
                  >
                    <input
                      type="date"
                      value={
                        paymentDate
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentDate(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        Boolean(
                          busyId
                        )
                      }
                      className="h-12 w-full rounded-xl border border-[#DFE1E8] px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                    />
                  </Field>

                  <Field
                    label="Payment method"
                    required
                  >
                    <select
                      value={
                        paymentMethod
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentMethod(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        Boolean(
                          busyId
                        )
                      }
                      className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                    >
                      <option value="">
                        Select payment method
                      </option>

                      <option value="BANK_TRANSFER">
                        Bank transfer
                      </option>

                      <option value="BANK">
                        Bank
                      </option>

                      <option value="MPESA">
                        M-Pesa
                      </option>

                      <option value="CASH">
                        Cash
                      </option>

                      <option value="CHEQUE">
                        Cheque
                      </option>

                      <option value="OTHER">
                        Other
                      </option>
                    </select>
                  </Field>

                  <Field
                    label="Payment reference"
                    required
                    hint="Transaction number, cheque number, M-Pesa reference, or other audit reference."
                  >
                    <input
                      type="text"
                      value={
                        paymentReference
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentReference(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        Boolean(
                          busyId
                        )
                      }
                      placeholder="e.g. QWE123456"
                      className="h-12 w-full rounded-xl border border-[#DFE1E8] px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                    />
                  </Field>

                  <Field
                    label="Bank account"
                    hint={
                      [
                        "BANK",
                        "BANK_TRANSFER",
                        "CHEQUE",
                      ].includes(
                        paymentMethod
                      )
                        ? "Required for this payment method."
                        : "Select if applicable."
                    }
                  >
                    <select
                      value={
                        paymentBankAccountId
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentBankAccountId(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        Boolean(
                          busyId
                        )
                      }
                      className="h-12 w-full rounded-xl border border-[#DFE1E8] bg-white px-4 text-sm text-[#20243A] outline-none focus:border-[#20243A]"
                    >
                      <option value="">
                        Select bank account
                      </option>

                      {bankAccounts.map(
                        (
                          bank
                        ) => (
                          <option
                            key={
                              bank.id
                            }
                            value={
                              bank.id
                            }
                          >
                            {bankLabel(
                              bank
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>

                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <AlertCircle
                        size={16}
                        className="mt-0.5 shrink-0"
                      />

                      <span>
                        {error}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#E9EBF0] pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      setShowPayment(
                        false
                      )
                    }
                    disabled={
                      Boolean(
                        busyId
                      )
                    }
                    className="h-10 rounded-xl border border-[#E0E2E8] px-4 text-sm font-semibold text-[#596077] hover:bg-[#F8F9FB]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      Boolean(
                        busyId
                      )
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white hover:bg-[#0B7A70] disabled:opacity-60"
                  >
                    {busyId ? (
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Check
                        size={15}
                      />
                    )}

                    {busyId
                      ? "Submitting..."
                      : "Submit payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}