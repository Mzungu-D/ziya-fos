import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
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
  deleteExpense,
  fetchExpenses,
  postExpense,
  recordExpensePayment,
  submitExpense,
} from "../services/expenses";
import type {
  Expense,
  ExpenseAccount,
  ExpenseBankAccount,
} from "../services/expenses";
import { authenticatedFetch } from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
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

interface PaymentForm {
  paymentDate: string;
  paymentReference: string;
  paymentMethod: string;
  bankAccountId: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

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

const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "CASH",
  "MPESA",
  "CARD",
  "OTHER",
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

const INITIAL_PAYMENT_FORM: PaymentForm = {
  paymentDate: "",
  paymentReference: "",
  paymentMethod: "",
  bankAccountId: "",
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

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

/* =========================================================
   STATUS
========================================================= */

const statusClasses = (status: string) => {
  switch (status.toUpperCase()) {
    case "DRAFT":
      return "border-slate-300 bg-slate-50 text-slate-600";

    case "PENDING_APPROVAL":
    case "PENDING":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600";

    case "APPROVED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";

    case "REJECTED":
      return "border-red-500/20 bg-red-500/10 text-red-600";

    case "POSTED":
      return "border-blue-500/20 bg-blue-500/10 text-blue-600";

    default:
      return "border-[#ECECF3] bg-[#F8F9FC] text-[#666B84]";
  }
};

const formatStatus = (status: string) => {
  const normalized = status
    .toLowerCase()
    .replace(/_/g, " ");

  return normalized.charAt(0).toUpperCase() +
    normalized.slice(1);
};

/* =========================================================
   SUMMARY CARD
========================================================= */

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
    <div className="min-w-0 rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#666B84]">
            {title}
          </p>

          <p className="mt-1.5 truncate text-2xl font-bold text-[#20243A]">
            {value}
          </p>

          <p className="mt-1 text-xs text-[#666B84]">
            {subtitle}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#20243A]">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenseAccounts, setExpenseAccounts] =
    useState<ExpenseAccount[]>([]);
  const [paymentAccounts, setPaymentAccounts] =
    useState<ExpenseAccount[]>([]);
  const [bankAccounts, setBankAccounts] =
    useState<ExpenseBankAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");
  const [categoryFilter, setCategoryFilter] =
    useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] =
    useState(false);
  const [selectedExpense, setSelectedExpense] =
    useState<Expense | null>(null);

  const [form, setForm] =
    useState<ExpenseForm>({
      ...INITIAL_FORM,
      expenseDate: getToday(),
    });

  const [paymentForm, setPaymentForm] =
    useState<PaymentForm>({
      ...INITIAL_PAYMENT_FORM,
      paymentDate: getToday(),
    });

  /* =======================================================
     LOAD EXPENSES
  ======================================================= */

  const loadExpenses = useCallback(
    async () => {
      try {
        const response = await fetchExpenses();
        setExpenses(
          Array.isArray(response)
            ? response
            : []
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to load expenses."
          )
        );
      }
    },
    []
  );

  /* =======================================================
     LOAD VENDORS
  ======================================================= */

  const loadVendors = useCallback(
    async () => {
      try {
        const response =
          await authenticatedFetch(
            "/api/vendors",
            {
              headers: {
                Accept: "application/json",
              },
            }
          );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        const list: Vendor[] =
          Array.isArray(data?.vendors)
            ? data.vendors.filter(
                (vendor: Vendor) =>
                  !vendor.status ||
                  vendor.status.toUpperCase() ===
                    "ACTIVE"
              )
            : [];

        setVendors(list);
      } catch {
        // Vendor selection is optional.
      }
    },
    []
  );

  /* =======================================================
     LOAD ACCOUNTS
  ======================================================= */

  const loadAccounts = useCallback(
    async () => {
      try {
        const response =
          await authenticatedFetch(
            "/api/accounts",
            {
              headers: {
                Accept: "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to load Chart of Accounts."
          );
        }

        const data = await response.json();

        const accounts: ExpenseAccount[] =
          Array.isArray(data?.accounts)
            ? data.accounts
            : [];

        setExpenseAccounts(
          accounts.filter(
            (account) =>
              account.type?.toUpperCase() ===
              "EXPENSE"
          )
        );

        setPaymentAccounts(
          accounts.filter((account) => {
            const type =
              account.type?.toUpperCase();

            return (
              type === "ASSET" ||
              type === "LIABILITY"
            );
          })
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to load Chart of Accounts."
          )
        );
      }
    },
    []
  );

  /* =======================================================
     LOAD BANK ACCOUNTS
  ======================================================= */

  const loadBankAccounts = useCallback(
    async () => {
      try {
        const response =
          await authenticatedFetch(
            "/api/bank-accounts",
            {
              headers: {
                Accept: "application/json",
              },
            }
          );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        const accounts =
          Array.isArray(data?.bankAccounts)
            ? data.bankAccounts
            : Array.isArray(data?.accounts)
              ? data.accounts
              : [];

        setBankAccounts(accounts);
      } catch {
        // Bank account selection is optional.
      }
    },
    []
  );

  /* =======================================================
     LOAD PAGE
  ======================================================= */

  const loadPage = useCallback(
    async () => {
      setLoading(true);
      setError("");

      await Promise.all([
        loadExpenses(),
        loadVendors(),
        loadAccounts(),
        loadBankAccounts(),
      ]);

      setLoading(false);
    },
    [
      loadExpenses,
      loadVendors,
      loadAccounts,
      loadBankAccounts,
    ]
  );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  /* =======================================================
     CATEGORIES
  ======================================================= */

  const categories = useMemo(
    () =>
      [
        ...new Set(
          expenses
            .map(
              (expense) => expense.category
            )
            .filter(Boolean)
        ),
      ].sort(),
    [expenses]
  );

  /* =======================================================
     FILTERED EXPENSES
  ======================================================= */

  const filtered = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const normalizedStatus =
        expense.status.toUpperCase();

      const matchStatus =
        statusFilter === "ALL" ||
        normalizedStatus ===
          statusFilter;

      const matchCategory =
        categoryFilter === "ALL" ||
        expense.category ===
          categoryFilter;

      const searchable = [
        expense.expenseCode,
        expense.category,
        expense.description,
        expense.vendor?.name,
        expense.vendor?.vendorCode,
        expense.status,
        expense.expenseAccount?.name,
        expense.expenseAccount?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchStatus &&
        matchCategory &&
        (!term ||
          searchable.includes(term))
      );
    });
  }, [
    expenses,
    search,
    statusFilter,
    categoryFilter,
  ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary = useMemo(() => {
    const total = expenses.reduce(
      (sum, expense) =>
        sum +
        (Number(expense.amount) || 0),
      0
    );

    const pending =
      expenses.filter((expense) =>
        [
          "PENDING",
          "PENDING_APPROVAL",
        ].includes(
          expense.status.toUpperCase()
        )
      ).length;

    const posted =
      expenses.filter(
        (expense) =>
          expense.status.toUpperCase() ===
          "POSTED"
      ).length;

    const paid =
      expenses.filter(
        (expense) =>
          expense.paymentStatus?.toUpperCase() ===
          "PAID"
      ).length;

    return {
      total,
      pending,
      posted,
      paid,
    };
  }, [expenses]);

  /* =======================================================
     FORM
  ======================================================= */

  const openForm = () => {
    setError("");
    setSuccessMessage("");

    setForm({
      ...INITIAL_FORM,
      expenseDate: getToday(),
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setForm({
      ...INITIAL_FORM,
      expenseDate: getToday(),
    });
  };

  /* =======================================================
     CREATE EXPENSE
  ======================================================= */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");
    setSuccessMessage("");

    const amount =
      Number(form.amount);

    if (!form.category) {
      setError(
        "Please select an expense category."
      );
      return;
    }

    if (!form.expenseAccountId) {
      setError(
        "Please select the expense account."
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

    if (!form.expenseDate) {
      setError(
        "Expense date is required."
      );
      return;
    }

    if (!form.description.trim()) {
      setError(
        "Expense description is required."
      );
      return;
    }

    try {
      setSaving(true);

      const expense =
        await createExpense({
          category:
            form.category,
          description:
            form.description.trim(),
          amount,
          currency: "KES",
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

      setExpenses((current) => [
        expense,
        ...current,
      ]);

      setShowForm(false);

      setForm({
        ...INITIAL_FORM,
        expenseDate: getToday(),
      });

      setSuccessMessage(
        `${expense.expenseCode} created as a draft.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to create expense."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     SUBMIT FOR APPROVAL
  ======================================================= */

  const handleSubmitForApproval = async (
    expense: Expense
  ) => {
    if (actionId) {
      return;
    }

    try {
      setActionId(expense.id);
      setError("");
      setSuccessMessage("");

      await submitExpense(expense.id);

      await loadExpenses();

      setSuccessMessage(
        `${expense.expenseCode} submitted for approval.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to submit expense."
        )
      );
    } finally {
      setActionId("");
    }
  };

  /* =======================================================
     POST TO GL
  ======================================================= */

  const handlePost = async (
    expense: Expense
  ) => {
    if (actionId) {
      return;
    }

    try {
      setActionId(expense.id);
      setError("");
      setSuccessMessage("");

      await postExpense(expense.id);

      await loadExpenses();

      setSuccessMessage(
        `${expense.expenseCode} posted to the General Ledger.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to post expense."
        )
      );
    } finally {
      setActionId("");
    }
  };

  /* =======================================================
     DELETE DRAFT
  ======================================================= */

  const handleDelete = async (
    expense: Expense
  ) => {
    if (actionId) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete draft ${expense.expenseCode}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionId(expense.id);
      setError("");

      await deleteExpense(
        expense.id
      );

      setExpenses((current) =>
        current.filter(
          (item) =>
            item.id !== expense.id
        )
      );

      setSuccessMessage(
        `${expense.expenseCode} deleted.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to delete expense."
        )
      );
    } finally {
      setActionId("");
    }
  };

  /* =======================================================
     PAYMENT
  ======================================================= */

  const openPayment = (
    expense: Expense
  ) => {
    setSelectedExpense(expense);

    setPaymentForm({
      ...INITIAL_PAYMENT_FORM,
      paymentDate: getToday(),
      paymentMethod:
        expense.paymentMethod ??
        "",
      bankAccountId:
        expense.bankAccountId ??
        "",
    });

    setError("");
    setSuccessMessage("");
    setShowPayment(true);
  };

  const closePayment = () => {
    if (saving) {
      return;
    }

    setShowPayment(false);
    setSelectedExpense(null);
  };

  const handlePayment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      saving ||
      !selectedExpense
    ) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      setSaving(true);

      await recordExpensePayment(
        selectedExpense.id,
        {
          paymentDate:
            paymentForm.paymentDate ||
            undefined,
          paymentReference:
            paymentForm.paymentReference.trim() ||
            undefined,
          paymentMethod:
            paymentForm.paymentMethod ||
            undefined,
          bankAccountId:
            paymentForm.bankAccountId ||
            undefined,
        }
      );

      await loadExpenses();

      setShowPayment(false);
      setSelectedExpense(null);

      setSuccessMessage(
        `${selectedExpense.expenseCode} marked as paid.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to record payment."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     EXPORT
  ======================================================= */

  const handleExport = () => {
    if (filtered.length === 0) {
      return;
    }

    const headers = [
      "Expense Code",
      "Category",
      "Description",
      "Vendor",
      "Expense Account",
      "Payment Account",
      "Amount",
      "Currency",
      "Date",
      "Status",
      "Payment Status",
    ];

    const rows = filtered.map(
      (expense) => [
        expense.expenseCode,
        expense.category,
        expense.description,
        expense.vendor?.name ?? "",
        expense.expenseAccount
          ? `${expense.expenseAccount.code} - ${expense.expenseAccount.name}`
          : "",
        expense.paymentAccount
          ? `${expense.paymentAccount.code} - ${expense.paymentAccount.name}`
          : "",
        Number(expense.amount).toFixed(2),
        expense.currency,
        formatDate(
          expense.expenseDate
        ),
        expense.status,
        expense.paymentStatus,
      ]
    );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(cell).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
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

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-w-0 space-y-6">

      {/* HEADER */}
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#666B84]">
            Business Operations
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
            Expenses
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#666B84] sm:text-base">
            Record, approve, post and track
            organizational expenses.
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:gap-3 xl:w-auto">
          <button
            type="button"
            onClick={handleExport}
            disabled={
              loading ||
              filtered.length === 0
            }
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-3 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4"
          >
            <Download size={17} />
            <span>Export</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void loadPage()
            }
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-3 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4"
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={openForm}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B7A70] sm:w-auto"
          >
            <Plus size={18} />
            New Expense
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && !showForm && !showPayment && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span className="min-w-0 flex-1">
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="shrink-0"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span className="min-w-0 flex-1">
            {successMessage}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
            className="shrink-0"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Expenses"
          value={formatCurrency(
            summary.total
          )}
          subtitle={`${expenses.length} records`}
          icon={
            <FileText size={20} />
          }
        />

        <SummaryCard
          title="Pending Approval"
          value={String(
            summary.pending
          )}
          subtitle="Awaiting review"
          icon={
            <Wallet size={20} />
          }
        />

        <SummaryCard
          title="Posted"
          value={String(
            summary.posted
          )}
          subtitle="Posted to General Ledger"
          icon={
            <CheckCircle2 size={20} />
          }
        />

        <SummaryCard
          title="Paid"
          value={String(
            summary.paid
          )}
          subtitle="Payment recorded"
          icon={
            <Wallet size={20} />
          }
        />
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row">
          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[#ECECF3] px-4 focus-within:border-[#20243A]">
            <Search
              size={18}
              className="shrink-0 text-[#666B84]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search expenses..."
              className="min-w-0 w-full bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-400"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="shrink-0 text-[#666B84]"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Filter
                size={17}
                className="hidden shrink-0 text-[#666B84] sm:block"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="min-h-11 w-full min-w-0 rounded-xl border border-[#ECECF3] bg-white px-3 py-3 text-sm text-[#666B84] outline-none"
              >
                <option value="ALL">
                  All Statuses
                </option>
                <option value="DRAFT">
                  Draft
                </option>
                <option value="PENDING_APPROVAL">
                  Pending Approval
                </option>
                <option value="APPROVED">
                  Approved
                </option>
                <option value="REJECTED">
                  Rejected
                </option>
                <option value="POSTED">
                  Posted
                </option>
              </select>
            </div>

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-xl border border-[#ECECF3] bg-white px-3 py-3 text-sm text-[#666B84] outline-none sm:flex-1 xl:w-56"
            >
              <option value="ALL">
                All Categories
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
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <div className="text-center">
              <Loader2
                size={28}
                className="mx-auto animate-spin text-[#20243A]"
              />
              <p className="mt-3 text-sm text-[#666B84]">
                Loading expenses...
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC]">
              <FileText
                size={26}
                className="text-[#20243A]"
              />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
              {expenses.length === 0
                ? "No expenses recorded"
                : "No matching expenses"}
            </h2>

            <p className="mt-2 max-w-sm text-sm text-[#666B84]">
              {expenses.length === 0
                ? "Create an expense to begin the accounting workflow."
                : "Try another search term or filter."}
            </p>

            {expenses.length === 0 && (
              <button
                type="button"
                onClick={openForm}
                className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white"
              >
                <Plus size={18} />
                Record First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-[#ECECF3] bg-[#F8F9FC]">
                  <th className="p-4 text-left font-semibold text-[#20243A]">
                    Expense
                  </th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">
                    Category
                  </th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">
                    Vendor
                  </th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">
                    Account
                  </th>
                  <th className="p-4 text-right font-semibold text-[#20243A]">
                    Amount
                  </th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">
                    Date
                  </th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">
                    Status
                  </th>
                  <th className="p-4 text-left font-semibold text-[#20243A]">
                    Payment
                  </th>
                  <th className="p-4 text-right font-semibold text-[#20243A]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (expense) => {
                    const status =
                      expense.status.toUpperCase();

                    const canSubmit =
                      status === "DRAFT";

                    const canPost =
                      status === "APPROVED";

                    const canPay =
                      status === "POSTED" &&
                      expense.paymentStatus?.toUpperCase() !==
                        "PAID";

                    const busy =
                      actionId ===
                      expense.id;

                    return (
                      <tr
                        key={expense.id}
                        className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]"
                      >
                        <td className="p-4">
                          <div>
                            <span className="font-mono text-sm font-semibold text-[#20243A]">
                              {expense.expenseCode}
                            </span>

                            <p className="mt-1 max-w-[220px] truncate text-xs text-[#666B84]">
                              {expense.description}
                            </p>
                          </div>
                        </td>

                        <td className="p-4 text-[#20243A]">
                          {expense.category}
                        </td>

                        <td className="p-4 text-[#666B84]">
                          {expense.vendor?.name ??
                            "—"}
                        </td>

                        <td className="p-4">
                          {expense.expenseAccount ? (
                            <div>
                              <p className="font-medium text-[#20243A]">
                                {expense.expenseAccount.name}
                              </p>
                              <p className="mt-0.5 font-mono text-xs text-[#666B84]">
                                {expense.expenseAccount.code}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[#666B84]">
                              —
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap p-4 text-right font-semibold text-[#20243A]">
                          {formatCurrency(
                            Number(
                              expense.amount
                            )
                          )}
                        </td>

                        <td className="whitespace-nowrap p-4 text-[#666B84]">
                          {formatDate(
                            expense.expenseDate
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                              expense.status
                            )}`}
                          >
                            {formatStatus(
                              expense.status
                            )}
                          </span>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
                              expense.paymentStatus?.toUpperCase() ===
                              "PAID"
                                ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-600"
                                : "border-[#ECECF3] bg-[#F8F9FC] text-[#666B84]"
                            }`}
                          >
                            {expense.paymentStatus?.toUpperCase() ===
                            "PAID"
                              ? "Paid"
                              : "Unpaid"}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-end gap-1.5">
                            {canSubmit && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleSubmitForApproval(
                                    expense
                                  )
                                }
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#ECECF3] bg-white px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-50"
                              >
                                {busy ? (
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <ChevronRight
                                    size={14}
                                  />
                                )}
                                Submit
                              </button>
                            )}

                            {canPost && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handlePost(
                                    expense
                                  )
                                }
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0D9488] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B7A70] disabled:opacity-50"
                              >
                                {busy ? (
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <CheckCircle2
                                    size={14}
                                  />
                                )}
                                Post
                              </button>
                            )}

                            {canPay && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  openPayment(
                                    expense
                                  )
                                }
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#ECECF3] bg-white px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-50"
                              >
                                <Wallet
                                  size={14}
                                />
                                Pay
                              </button>
                            )}

                            {status ===
                              "DRAFT" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleDelete(
                                    expense
                                  )
                                }
                                className="inline-flex min-h-9 items-center rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Delete
                              </button>
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

      {/* =================================================
          NEW EXPENSE MODAL
      ================================================= */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-2xl">

            <div className="flex shrink-0 items-start justify-between border-b border-[#ECECF3] px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0D9488]">
                  Expense Management
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                  Record New Expense
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Create a draft that can be
                  submitted for approval.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="min-h-0 overflow-y-auto"
            >
              <div className="space-y-7 p-5 sm:p-6">

                {/* CORE INFORMATION */}
                <section>
                  <h3 className="text-sm font-semibold text-[#20243A]">
                    Expense information
                  </h3>

                  <p className="mt-1 text-xs text-[#666B84]">
                    Enter the transaction details.
                  </p>

                  <div className="mt-4 grid gap-5 sm:grid-cols-2">

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Category *
                      </label>

                      <select
                        value={form.category}
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              category:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        required
                        className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      >
                        <option value="">
                          Select category...
                        </option>

                        {CATEGORIES.map(
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
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Amount *
                      </label>

                      <div className="flex min-h-11 overflow-hidden rounded-xl border border-[#ECECF3] focus-within:border-[#0D9488]">
                        <div className="flex items-center border-r border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm font-medium text-[#666B84]">
                          KES
                        </div>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={form.amount}
                          onChange={(event) =>
                            setForm(
                              (current) => ({
                                ...current,
                                amount:
                                  event.target.value,
                              })
                            )
                          }
                          disabled={saving}
                          required
                          placeholder="0.00"
                          className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Expense Date *
                      </label>

                      <input
                        type="date"
                        value={
                          form.expenseDate
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              expenseDate:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        required
                        className="min-h-11 w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Vendor
                        <span className="ml-1 font-normal text-[#666B84]">
                          (optional)
                        </span>
                      </label>

                      <select
                        value={form.vendorId}
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              vendorId:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      >
                        <option value="">
                          No vendor
                        </option>

                        {vendors.map(
                          (vendor) => (
                            <option
                              key={vendor.id}
                              value={vendor.id}
                            >
                              {vendor.name} (
                              {vendor.vendorCode})
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Description *
                      </label>

                      <textarea
                        rows={3}
                        value={
                          form.description
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              description:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        required
                        placeholder="What was this expense for?"
                        className="w-full resize-none rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      />
                    </div>
                  </div>
                </section>

                {/* ACCOUNTING */}
                <section className="border-t border-[#ECECF3] pt-6">
                  <div>
                    <h3 className="text-sm font-semibold text-[#20243A]">
                      Accounting
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-[#666B84]">
                      These are real Chart of Accounts
                      relationships used when the
                      expense is posted.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-5 sm:grid-cols-2">

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Expense Account *
                      </label>

                      <select
                        value={
                          form.expenseAccountId
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              expenseAccountId:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        required
                        className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      >
                        <option value="">
                          Select expense account...
                        </option>

                        {expenseAccounts.map(
                          (account) => (
                            <option
                              key={account.id}
                              value={account.id}
                            >
                              {account.code} —{" "}
                              {account.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Payment / Credit Account
                        <span className="ml-1 font-normal text-[#666B84]">
                          (required for posting)
                        </span>
                      </label>

                      <select
                        value={
                          form.paymentAccountId
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              paymentAccountId:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      >
                        <option value="">
                          Select payment account...
                        </option>

                        {paymentAccounts.map(
                          (account) => (
                            <option
                              key={account.id}
                              value={account.id}
                            >
                              {account.code} —{" "}
                              {account.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Payment Method
                      </label>

                      <select
                        value={
                          form.paymentMethod
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              paymentMethod:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      >
                        <option value="">
                          Select method...
                        </option>

                        {PAYMENT_METHODS.map(
                          (method) => (
                            <option
                              key={method}
                              value={method}
                            >
                              {method.replace(
                                /_/g,
                                " "
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                        Bank Account
                        <span className="ml-1 font-normal text-[#666B84]">
                          (optional)
                        </span>
                      </label>

                      <select
                        value={
                          form.bankAccountId
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              bankAccountId:
                                event.target.value,
                            })
                          )
                        }
                        disabled={saving}
                        className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                      >
                        <option value="">
                          No bank account
                        </option>

                        {bankAccounts.map(
                          (account) => (
                            <option
                              key={account.id}
                              value={account.id}
                            >
                              {account.bankName} —{" "}
                              {account.accountName}{" "}
                              ({account.accountNumber})
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-4">
                    <div className="flex items-start gap-3">
                      <Wallet
                        size={18}
                        className="mt-0.5 shrink-0 text-[#20243A]"
                      />

                      <div>
                        <p className="text-sm font-semibold text-[#20243A]">
                          Posting effect
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#666B84]">
                          When approved and posted,
                          the system creates a
                          double-entry journal:
                          debit the selected expense
                          account and credit the
                          selected payment account.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ERROR */}
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      {error}
                    </span>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 flex shrink-0 flex-col-reverse gap-3 border-t border-[#ECECF3] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="min-h-11 rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={17} />
                  )}

                  {saving
                    ? "Saving..."
                    : "Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          PAYMENT MODAL
      ================================================= */}

      {showPayment &&
        selectedExpense && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
              <div className="flex items-start justify-between border-b border-[#ECECF3] px-5 py-4 sm:px-6 sm:py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0D9488]">
                    Payment
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                    Record Payment
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    {selectedExpense.expenseCode}
                    {" · "}
                    {formatCurrency(
                      Number(
                        selectedExpense.amount
                      )
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePayment}
                  disabled={saving}
                  className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
                >
                  <X size={22} />
                </button>
              </div>

              <form
                onSubmit={handlePayment}
                className="space-y-5 p-5 sm:p-6"
              >
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Payment Date
                  </label>

                  <input
                    type="date"
                    value={
                      paymentForm.paymentDate
                    }
                    onChange={(event) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          paymentDate:
                            event.target.value,
                        })
                      )
                    }
                    disabled={saving}
                    className="min-h-11 w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Payment Method
                  </label>

                  <select
                    value={
                      paymentForm.paymentMethod
                    }
                    onChange={(event) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          paymentMethod:
                            event.target.value,
                        })
                      )
                    }
                    disabled={saving}
                    className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                  >
                    <option value="">
                      Select method...
                    </option>

                    {PAYMENT_METHODS.map(
                      (method) => (
                        <option
                          key={method}
                          value={method}
                        >
                          {method.replace(
                            /_/g,
                            " "
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Bank Account
                  </label>

                  <select
                    value={
                      paymentForm.bankAccountId
                    }
                    onChange={(event) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          bankAccountId:
                            event.target.value,
                        })
                      )
                    }
                    disabled={saving}
                    className="min-h-11 w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                  >
                    <option value="">
                      No bank account
                    </option>

                    {bankAccounts.map(
                      (account) => (
                        <option
                          key={account.id}
                          value={account.id}
                        >
                          {account.bankName} —{" "}
                          {account.accountName}{" "}
                          ({account.accountNumber})
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Payment Reference
                  </label>

                  <input
                    type="text"
                    value={
                      paymentForm.paymentReference
                    }
                    onChange={(event) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          paymentReference:
                            event.target.value,
                        })
                      )
                    }
                    disabled={saving}
                    placeholder="Transaction / receipt reference"
                    className="min-h-11 w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      {error}
                    </span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closePayment}
                    disabled={saving}
                    className="min-h-11 rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70] disabled:opacity-60"
                  >
                    {saving && (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    )}
                    Mark as Paid
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
