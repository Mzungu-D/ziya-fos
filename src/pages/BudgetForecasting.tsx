import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { authenticatedFetch } from "../lib/auth-session";

/* ============================================================
 * TYPES
 * ============================================================ */

type BudgetAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Budget = {
  id: string;
  name: string;
  department: string;
  amount: number;
  year: number;
  accountId: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  organizationId: string;

  account: BudgetAccount | null;

  actual: number | null;
  committed: number | null;
  available: number | null;
  utilization: number | null;
  calculatedStatus: string;
};

type BudgetPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type BudgetApiResponse = {
  success: boolean;
  data?: Budget[];

  totals?: {
    budget: number;
    actual: number;
    committed: number;
    available: number;
    utilization: number;
    count: number;
  };

  pagination?: BudgetPagination;

  message?: string;
};

type BudgetSummary = {
  year: number;
  totalBudget: number;
  actualSpend: number;
  committedSpend: number;
  availableBudget: number;
  utilization: number;
  variance: number;

  monthlyActuals: Array<{
    month: number;
    amount: number;
  }>;
};

type BudgetSummaryResponse = {
  success: boolean;

  data?: BudgetSummary;

  message?: string;
};

type AccountApiResponse =
  | BudgetAccount[]
  | {
      success?: boolean;
      data?: BudgetAccount[];
      message?: string;
    };

type BudgetForm = {
  name: string;
  department: string;
  amount: string;
  year: string;
  accountId: string;
  status: string;
  startDate: string;
  endDate: string;
};

/* ============================================================
 * CONSTANTS
 * ============================================================ */

const DEFAULT_PAGE_SIZE = 20;

const PAGE_SIZE_OPTIONS = [
  20,
  50,
  100,
];

const STATUS_OPTIONS = [
  {
    value: "",
    label: "All statuses",
  },
  {
    value: "DRAFT",
    label: "Draft",
  },
  {
    value: "ACTIVE",
    label: "Active",
  },
  {
    value: "ARCHIVED",
    label: "Archived",
  },
];

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* ============================================================
 * HELPERS
 * ============================================================ */

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function formatCurrency(
  value: number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return `KES ${Number(value).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatCompactCurrency(
  value: number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return `KES ${Number(value).toLocaleString(
    "en-KE",
    {
      maximumFractionDigits: 0,
    }
  )}`;
}

function formatPercentage(
  value: number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return `${Number(value).toFixed(1)}%`;
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-KE",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function toDateInput(
  value: string | null | undefined
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  const year =
    date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getYearStart(
  year: number
): string {
  return `${year}-01-01`;
}

function getYearEnd(
  year: number
): string {
  return `${year}-12-31`;
}

function createEmptyForm(
  year: number
): BudgetForm {
  return {
    name: "Annual Budget",
    department: "",
    amount: "",
    year: String(year),
    accountId: "",
    status: "DRAFT",
    startDate:
      getYearStart(year),
    endDate:
      getYearEnd(year),
  };
}

function getStatusClasses(
  status: string
): string {
  switch (
    status.toUpperCase()
  ) {
    case "OVER BUDGET":
      return "bg-red-50 text-red-700 border-red-200";

    case "NEAR LIMIT":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "UNDER BUDGET":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "DRAFT":
      return "bg-slate-50 text-slate-700 border-slate-200";

    case "ARCHIVED":
      return "bg-gray-100 text-gray-600 border-gray-200";

    case "NO ACTIVITY":
      return "bg-blue-50 text-blue-700 border-blue-200";

    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function getPageNumbers(
  currentPage: number,
  totalPages: number
): number[] {
  if (totalPages <= 5) {
    return Array.from(
      {
        length: totalPages,
      },
      (_, index) =>
        index + 1
    );
  }

  let start =
    currentPage - 2;

  if (start < 1) {
    start = 1;
  }

  if (
    start + 4 >
    totalPages
  ) {
    start =
      totalPages - 4;
  }

  return Array.from(
    {
      length: 5,
    },
    (_, index) =>
      start + index
  );
}

/* ============================================================
 * COMPONENT
 * ============================================================ */

export default function BudgetForecasting() {
  /* ----------------------------------------------------------
   * DATA
   * ---------------------------------------------------------- */

  const [budgets, setBudgets] =
    useState<Budget[]>([]);

  const [accounts, setAccounts] =
    useState<BudgetAccount[]>([]);

  const [
    accountsLoading,
    setAccountsLoading,
  ] = useState(true);

  const [summary, setSummary] =
    useState<BudgetSummary>({
      year: getCurrentYear(),
      totalBudget: 0,
      actualSpend: 0,
      committedSpend: 0,
      availableBudget: 0,
      utilization: 0,
      variance: 0,
      monthlyActuals:
        Array.from(
          { length: 12 },
          (_, index) => ({
            month:
              index + 1,
            amount: 0,
          })
        ),
    });

  /* ----------------------------------------------------------
   * FILTERS
   * ---------------------------------------------------------- */

  const [year, setYear] =
    useState(
      getCurrentYear()
    );

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [search, setSearch] =
    useState("");

  const [
    department,
    setDepartment,
  ] = useState("");

  const [
    accountFilter,
    setAccountFilter,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  /* ----------------------------------------------------------
   * PAGINATION
   * ---------------------------------------------------------- */

  const [page, setPage] =
    useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(
    DEFAULT_PAGE_SIZE
  );

  const [
    pagination,
    setPagination,
  ] =
    useState<BudgetPagination>({
      page: 1,
      pageSize:
        DEFAULT_PAGE_SIZE,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

  /* ----------------------------------------------------------
   * UI STATE
   * ---------------------------------------------------------- */

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    showBudgetForm,
    setShowBudgetForm,
  ] = useState(false);

  const [
    editingBudget,
    setEditingBudget,
  ] =
    useState<Budget | null>(
      null
    );

  const [form, setForm] =
    useState<BudgetForm>(
      createEmptyForm(year)
    );

  const [saving, setSaving] =
    useState(false);

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<string | null>(
      null
    );

  /* ==========================================================
   * YEAR OPTIONS
   * ========================================================== */

  const yearOptions = useMemo(() => {
    const current =
      getCurrentYear();

    return Array.from(
      {
        length: 7,
      },
      (_, index) =>
        current - 3 + index
    );
  }, []);

  /* ==========================================================
   * LOAD ACCOUNTS
   * ========================================================== */

  const loadAccounts =
    useCallback(async () => {
      try {
        setAccountsLoading(
          true
        );

        const response =
          await authenticatedFetch(
            "/api/accounts?pageSize=100",
            {
              credentials:
                "include",
            }
          );

        const data =
          (await response.json()) as AccountApiResponse;

        if (!response.ok) {
          throw new Error(
            !Array.isArray(data)
              ? data.message ||
                  "Unable to load accounts."
              : "Unable to load accounts."
          );
        }

        const accountList =
          Array.isArray(data)
            ? data
            : data.data || [];

        const expenseAccounts =
          accountList.filter(
            (account) =>
              String(
                account.type
              ).toUpperCase() ===
              "EXPENSE"
          );

        setAccounts(
          expenseAccounts
        );
      } catch (err) {
        console.error(
          "[BUDGET UI] Failed to load accounts:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Expense accounts."
        );
      } finally {
        setAccountsLoading(
          false
        );
      }
    }, []);

  /* ==========================================================
   * LOAD BUDGET DATA
   * ========================================================== */

  const loadBudgetData =
    useCallback(
      async (
        showRefreshState = false
      ) => {
        try {
          if (
            showRefreshState
          ) {
            setRefreshing(
              true
            );
          } else {
            setLoading(true);
          }

          setError("");

          const params =
            new URLSearchParams();

          params.set(
            "year",
            String(year)
          );

          params.set(
            "page",
            String(page)
          );

          params.set(
            "pageSize",
            String(pageSize)
          );

          if (search) {
            params.set(
              "search",
              search
            );
          }

          if (department) {
            params.set(
              "department",
              department
            );
          }

          if (accountFilter) {
            params.set(
              "accountId",
              accountFilter
            );
          }

          if (statusFilter) {
            params.set(
              "status",
              statusFilter
            );
          }

          const summaryParams =
            new URLSearchParams();

          summaryParams.set(
            "year",
            String(year)
          );

          const [
            budgetsResponse,
            summaryResponse,
          ] =
            await Promise.all([
              authenticatedFetch(
                `/api/budgets?${params.toString()}`,
                {
                  credentials:
                    "include",
                }
              ),

              authenticatedFetch(
                `/api/budgets/summary?${summaryParams.toString()}`,
                {
                  credentials:
                    "include",
                }
              ),
            ]);

          const budgetsData =
            (await budgetsResponse.json()) as BudgetApiResponse;

          const summaryData =
            (await summaryResponse.json()) as BudgetSummaryResponse;

          if (
            !budgetsResponse.ok ||
            !budgetsData.success
          ) {
            throw new Error(
              budgetsData.message ||
                "Unable to load budgets."
            );
          }

          if (
            !summaryResponse.ok ||
            !summaryData.success
          ) {
            throw new Error(
              summaryData.message ||
                "Unable to load budget summary."
            );
          }

          setBudgets(
            budgetsData.data ||
              []
          );

          setPagination(
            budgetsData.pagination || {
              page,
              pageSize,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage:
                false,
            }
          );

          if (
            summaryData.data
          ) {
            setSummary(
              summaryData.data
            );
          }
        } catch (err) {
          console.error(
            "[BUDGET UI] Failed to load budget data:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load budget information."
          );
        } finally {
          setLoading(false);
          setRefreshing(
            false
          );
        }
      },
      [
        year,
        page,
        pageSize,
        search,
        department,
        accountFilter,
        statusFilter,
      ]
    );

  /* ==========================================================
   * INITIAL LOAD
   * ========================================================== */

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadBudgetData();
  }, [loadBudgetData]);

  /* ==========================================================
   * SEARCH DEBOUNCE
   * ========================================================== */

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        setSearch(
          searchInput.trim()
        );

        setPage(1);
      }, 350);

    return () =>
      window.clearTimeout(
        timer
      );
  }, [searchInput]);

  /* ==========================================================
   * RESET PAGE WHEN FILTERS CHANGE
   * ========================================================== */

  useEffect(() => {
    setPage(1);
  }, [
    year,
    department,
    accountFilter,
    statusFilter,
  ]);

  /* ==========================================================
   * FORM HANDLERS
   * ========================================================== */

  const openCreateForm =
    () => {
      setEditingBudget(
        null
      );

      setForm(
        createEmptyForm(
          year
        )
      );

      setError("");

      setShowBudgetForm(
        true
      );
    };

  const openEditForm =
    (budget: Budget) => {
      setEditingBudget(
        budget
      );

      setForm({
        name:
          budget.name ||
          "Annual Budget",

        department:
          budget.department,

        amount:
          String(
            budget.amount
          ),

        year:
          String(
            budget.year
          ),

        accountId:
          budget.accountId ||
          "",

        status:
          budget.status ||
          "DRAFT",

        startDate:
          toDateInput(
            budget.startDate
          ) ||
          getYearStart(
            budget.year
          ),

        endDate:
          toDateInput(
            budget.endDate
          ) ||
          getYearEnd(
            budget.year
          ),
      });

      setError("");

      setShowBudgetForm(
        true
      );
    };

  const closeBudgetForm =
    () => {
      if (saving) {
        return;
      }

      setShowBudgetForm(
        false
      );

      setEditingBudget(
        null
      );

      setForm(
        createEmptyForm(
          year
        )
      );
    };

  /* ==========================================================
   * FORM SUBMISSION
   * ========================================================== */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const name =
      form.name.trim() ||
      "Annual Budget";

    const departmentValue =
      form.department.trim();

    const amount =
      Number(form.amount);

    const budgetYear =
      Number(form.year);

    const accountId =
      form.accountId.trim();

    const status =
      form.status.trim();

    if (
      !departmentValue
    ) {
      setError(
        "Department is required."
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
        "Budget amount must be greater than zero."
      );
      return;
    }

    if (
      !Number.isInteger(
        budgetYear
      ) ||
      budgetYear < 2000 ||
      budgetYear > 2100
    ) {
      setError(
        "Enter a valid budget year."
      );
      return;
    }

    if (!accountId) {
      setError(
        "Select an Expense account from the Chart of Accounts."
      );
      return;
    }

    if (
      !form.startDate ||
      !form.endDate
    ) {
      setError(
        "Budget start and end dates are required."
      );
      return;
    }

    if (
      form.startDate >
      form.endDate
    ) {
      setError(
        "Budget start date cannot be after the end date."
      );
      return;
    }

    if (
      form.startDate <
        getYearStart(
          budgetYear
        ) ||
      form.startDate >
        getYearEnd(
          budgetYear
        ) ||
      form.endDate <
        getYearStart(
          budgetYear
        ) ||
      form.endDate >
        getYearEnd(
          budgetYear
        )
    ) {
      setError(
        "Budget dates must fall within the selected budget year."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const isEditing =
        editingBudget !== null;

      const endpoint =
        isEditing
          ? `/api/budgets/${editingBudget.id}`
          : "/api/budgets";

      const response =
        await authenticatedFetch(
          endpoint,
          {
            method: isEditing
              ? "PUT"
              : "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name,

              department:
                departmentValue,

              amount,

              year:
                budgetYear,

              accountId,

              status,

              startDate:
                form.startDate,

              endDate:
                form.endDate,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success: boolean;
          data?: Budget;
          message?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            (isEditing
              ? "Failed to update budget."
              : "Failed to create budget.")
        );
      }

      setShowBudgetForm(
        false
      );

      setEditingBudget(
        null
      );

      setForm(
        createEmptyForm(
          budgetYear
        )
      );

      /*
       * If the saved budget belongs to another year,
       * switch the workspace to that year.
       */
      if (
        budgetYear !==
        year
      ) {
        setYear(
          budgetYear
        );

        setPage(1);
      } else if (
        page !== 1
      ) {
        setPage(1);
      } else {
        await loadBudgetData(
          true
        );
      }
    } catch (err) {
      console.error(
        "[BUDGET UI] Failed to save budget:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save budget."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
   * DELETE
   * ========================================================== */

  const handleDelete =
    async (
      budget: Budget
    ) => {
      const confirmed =
        window.confirm(
          `Delete "${budget.name}" for ${budget.department} (${budget.year})? This action cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingId(
          budget.id
        );

        setError("");

        const response =
          await authenticatedFetch(
            `/api/budgets/${budget.id}`,
            {
              method:
                "DELETE",

              credentials:
                "include",
            }
          );

        const data =
          (await response.json()) as {
            success: boolean;
            message?: string;
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Failed to delete budget."
          );
        }

        /*
         * If the last record on the current page was deleted,
         * move to the previous page when possible.
         */
        if (
          budgets.length === 1 &&
          page > 1
        ) {
          setPage(
            page - 1
          );
        } else {
          await loadBudgetData(
            true
          );
        }
      } catch (err) {
        console.error(
          "[BUDGET UI] Failed to delete budget:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to delete budget."
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  /* ==========================================================
   * KEYBOARD HANDLING
   * ========================================================== */

  useEffect(() => {
    if (
      !showBudgetForm
    ) {
      return;
    }

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === "Escape" &&
          !saving
        ) {
          closeBudgetForm();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [
    showBudgetForm,
    saving,
  ]);

  /* ==========================================================
   * DERIVED VALUES
   * ========================================================== */

  const showingFrom =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) *
          pagination.pageSize +
        1;

  const showingTo =
    Math.min(
      pagination.page *
        pagination.pageSize,
      pagination.totalItems
    );

  const pageNumbers =
    getPageNumbers(
      pagination.page,
      pagination.totalPages
    );

  const maximumMonthlySpend =
    Math.max(
      ...summary.monthlyActuals.map(
        (item) =>
          Number(item.amount)
      ),
      0
    );

  const budgetUtilizationWidth =
    Math.min(
      Math.max(
        summary.utilization,
        0
      ),
      100
    );

  const actualSpendRatio =
    summary.totalBudget >
    0
      ? Math.min(
          Math.max(
            (summary.actualSpend /
              summary.totalBudget) *
              100,
            0
          ),
          100
        )
      : 0;

  const committedRatio =
    summary.totalBudget >
    0
      ? Math.min(
          Math.max(
            (summary.committedSpend /
              summary.totalBudget) *
              100,
            0
          ),
          100
        )
      : 0;

  const isOverBudget =
    summary.availableBudget <
    0;

  /* ==========================================================
   * RENDER
   * ========================================================== */

  return (
    <div className="space-y-6 pb-10">
      {/* ======================================================
       * PAGE HEADER
       * ====================================================== */}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#20243A] text-white">
              <Target
                size={22}
              />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#20243A]">
                Budgeting &
                Forecasting
              </h1>

              <p className="mt-1 text-sm text-[#666B84]">
                Plan expenditure,
                monitor commitments
                and track actual
                financial performance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={year}
            onChange={(event) =>
              setYear(
                Number(
                  event.target.value
                )
              )
            }
            className="rounded-xl border border-[#E4E6EF] bg-white px-4 py-3 text-sm font-medium text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
            aria-label="Budget year"
          >
            {yearOptions.map(
              (optionYear) => (
                <option
                  key={
                    optionYear
                  }
                  value={
                    optionYear
                  }
                >
                  FY{" "}
                  {optionYear}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={() =>
              void loadBudgetData(
                true
              )
            }
            disabled={
              refreshing
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[#E4E6EF] bg-white px-4 py-3 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={
              openCreateForm
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F74]"
          >
            <Plus
              size={18}
            />
            New Budget
          </button>
        </div>
      </div>

      {/* ======================================================
       * ERROR
       * ====================================================== */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0">
            <p className="font-semibold">
              Budgeting Error
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="ml-auto rounded-lg p-1 hover:bg-red-100"
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ======================================================
       * KPI CARDS
       * ====================================================== */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {/* Total Budget */}

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Total Budget
          </p>

          <p className="mt-3 text-2xl font-bold text-[#20243A]">
            {loading
              ? "Loading..."
              : formatCompactCurrency(
                  summary.totalBudget
                )}
          </p>

          <p className="mt-2 text-xs text-[#8A8EA3]">
            FY {year}
          </p>
        </div>

        {/* Actual Spend */}

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Actual Spend
          </p>

          <p className="mt-3 text-2xl font-bold text-[#20243A]">
            {loading
              ? "Loading..."
              : formatCompactCurrency(
                  summary.actualSpend
                )}
          </p>

          <p className="mt-2 text-xs text-[#8A8EA3]">
            Posted expenditure
          </p>
        </div>

        {/* Committed */}

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Committed Spend
          </p>

          <p className="mt-3 text-2xl font-bold text-[#20243A]">
            {loading
              ? "Loading..."
              : formatCompactCurrency(
                  summary.committedSpend
                )}
          </p>

          <p className="mt-2 text-xs text-[#8A8EA3]">
            Pending expenditure
          </p>
        </div>

        {/* Available */}

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Available Budget
          </p>

          <p
            className={`mt-3 text-2xl font-bold ${
              summary.availableBudget <
              0
                ? "text-red-600"
                : "text-[#20243A]"
            }`}
          >
            {loading
              ? "Loading..."
              : formatCompactCurrency(
                  summary.availableBudget
                )}
          </p>

          <p
            className={`mt-2 text-xs ${
              summary.availableBudget <
              0
                ? "text-red-600"
                : "text-[#8A8EA3]"
            }`}
          >
            Actual + commitments
          </p>
        </div>

        {/* Utilization */}

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Utilization
          </p>

          <p className="mt-3 text-2xl font-bold text-[#20243A]">
            {loading
              ? "Loading..."
              : formatPercentage(
                  summary.utilization
                )}
          </p>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEF0F5]">
            <div
              className={`h-full rounded-full transition-all ${
                summary.utilization >=
                100
                  ? "bg-red-500"
                  : summary.utilization >=
                    90
                  ? "bg-amber-500"
                  : "bg-[#0D9488]"
              }`}
              style={{
                width: `${budgetUtilizationWidth}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ======================================================
       * PERFORMANCE OVERVIEW
       * ====================================================== */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Budget Position */}

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#20243A]">
                Budget Position
              </h2>

              <p className="mt-1 text-sm text-[#666B84]">
                Actual and committed
                expenditure against
                the approved budget.
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                isOverBudget
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {isOverBudget
                ? "Budget exceeded"
                : "Within budget"}
            </span>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-[#20243A]">
                Budget consumed
              </span>

              <span className="font-semibold text-[#20243A]">
                {formatPercentage(
                  summary.utilization
                )}
              </span>
            </div>

            <div className="h-4 overflow-hidden rounded-full bg-[#EEF0F5]">
              <div
                className={`h-full rounded-full ${
                  summary.utilization >=
                  100
                    ? "bg-red-500"
                    : summary.utilization >=
                      90
                    ? "bg-amber-500"
                    : "bg-[#0D9488]"
                }`}
                style={{
                  width: `${budgetUtilizationWidth}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-[#F8F9FC] p-4">
              <p className="text-xs font-medium text-[#666B84]">
                Approved budget
              </p>

              <p className="mt-2 text-lg font-bold text-[#20243A]">
                {formatCurrency(
                  summary.totalBudget
                )}
              </p>
            </div>

            <div className="rounded-xl bg-[#F8F9FC] p-4">
              <p className="text-xs font-medium text-[#666B84]">
                Actual spend
              </p>

              <p className="mt-2 text-lg font-bold text-[#20243A]">
                {formatCurrency(
                  summary.actualSpend
                )}
              </p>

              <p className="mt-1 text-xs text-[#8A8EA3]">
                {actualSpendRatio.toFixed(
                  1
                )}
                % of budget
              </p>
            </div>

            <div className="rounded-xl bg-[#F8F9FC] p-4">
              <p className="text-xs font-medium text-[#666B84]">
                Committed
              </p>

              <p className="mt-2 text-lg font-bold text-[#20243A]">
                {formatCurrency(
                  summary.committedSpend
                )}
              </p>

              <p className="mt-1 text-xs text-[#8A8EA3]">
                {committedRatio.toFixed(
                  1
                )}
                % of budget
              </p>
            </div>
          </div>
        </div>

        {/* Variance */}

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#20243A]">
            Budget Variance
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Budget remaining after
            posted actual spend.
          </p>

          <div className="mt-7">
            <p
              className={`text-3xl font-bold ${
                summary.variance <
                0
                  ? "text-red-600"
                  : "text-[#20243A]"
              }`}
            >
              {formatCurrency(
                summary.variance
              )}
            </p>

            <p className="mt-2 text-sm text-[#666B84]">
              {summary.variance >=
              0
                ? "Remaining against actual spend"
                : "Actual spend is above the budget"}
            </p>
          </div>

          <div className="mt-7 rounded-xl border border-[#E9EAF1] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
              Available after commitments
            </p>

            <p
              className={`mt-2 text-xl font-bold ${
                summary.availableBudget <
                0
                  ? "text-red-600"
                  : "text-[#20243A]"
              }`}
            >
              {formatCurrency(
                summary.availableBudget
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================
       * MONTHLY ACTUAL SPEND
       * ====================================================== */}

      <div className="rounded-2xl border border-[#E9EAF1] bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#20243A]">
            Monthly Actual Spend
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Posted expenditure by
            month for FY {year}.
          </p>
        </div>

        <div className="mt-7 grid h-64 grid-cols-12 items-end gap-2 sm:gap-3">
          {summary.monthlyActuals.map(
            (item) => {
              const height =
                maximumMonthlySpend >
                0
                  ? Math.max(
                      (Number(
                        item.amount
                      ) /
                        maximumMonthlySpend) *
                        100,
                      item.amount > 0
                        ? 4
                        : 0
                    )
                  : 0;

              return (
                <div
                  key={
                    item.month
                  }
                  className="flex h-full min-w-0 flex-col items-center justify-end"
                >
                  <div className="mb-2 hidden text-center text-[10px] font-medium text-[#666B84] sm:block">
                    {Number(
                      item.amount
                    ) > 0
                      ? formatCompactCurrency(
                          Number(
                            item.amount
                          )
                        )
                      : ""}
                  </div>

                  <div className="flex h-48 w-full items-end justify-center">
                    <div
                      className="w-full max-w-[34px] rounded-t-lg bg-[#0D9488] transition-all"
                      style={{
                        height: `${height}%`,
                        minHeight:
                          item.amount >
                          0
                            ? "4px"
                            : "0px",
                      }}
                      title={`${MONTH_NAMES[item.month - 1]}: ${formatCurrency(
                        Number(
                          item.amount
                        )
                      )}`}
                    />
                  </div>

                  <span className="mt-3 text-[10px] font-medium text-[#666B84] sm:text-xs">
                    {
                      MONTH_NAMES[
                        item.month -
                          1
                      ]
                    }
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* ======================================================
       * FILTERS + BUDGET TABLE
       * ====================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#E9EAF1] bg-white shadow-sm">
        {/* Table Header */}

        <div className="border-b border-[#E9EAF1] p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#20243A]">
                Budget Register
              </h2>

              <p className="mt-1 text-sm text-[#666B84]">
                Manage budget allocations
                and monitor financial
                performance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#F3F4F8] px-3 py-1.5 text-xs font-semibold text-[#666B84]">
                {pagination.totalItems.toLocaleString(
                  "en-KE"
                )}{" "}
                budgets
              </span>
            </div>
          </div>

          {/* Filters */}

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {/* Search */}

            <div className="relative xl:col-span-2">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8EA3]"
              />

              <input
                type="search"
                value={
                  searchInput
                }
                onChange={(
                  event
                ) =>
                  setSearchInput(
                    event.target
                      .value
                  )
                }
                placeholder="Search budget, department or account..."
                className="w-full rounded-xl border border-[#E1E3EB] bg-white py-3 pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#9CA0B1] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />
            </div>

            {/* Department */}

            <input
              type="text"
              value={
                department
              }
              onChange={(
                event
              ) =>
                setDepartment(
                  event.target
                    .value
                )
              }
              placeholder="Department"
              className="rounded-xl border border-[#E1E3EB] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#9CA0B1] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
            />

            {/* Account */}

            <select
              value={
                accountFilter
              }
              onChange={(
                event
              ) =>
                setAccountFilter(
                  event.target
                    .value
                )
              }
              className="rounded-xl border border-[#E1E3EB] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
            >
              <option value="">
                All Expense
                Accounts
              </option>

              {accounts.map(
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

            {/* Status */}

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
              className="rounded-xl border border-[#E1E3EB] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* ====================================================
         * TABLE
         * ==================================================== */}

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw
              size={24}
              className="mx-auto animate-spin text-[#0D9488]"
            />

            <p className="mt-4 text-sm font-medium text-[#20243A]">
              Loading budgets...
            </p>

            <p className="mt-1 text-xs text-[#666B84]">
              Fetching budget and
              accounting data.
            </p>
          </div>
        ) : budgets.length ===
          0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F8]">
              <Target
                size={22}
                className="text-[#666B84]"
              />
            </div>

            <p className="mt-4 font-semibold text-[#20243A]">
              No budgets found
            </p>

            <p className="mx-auto mt-2 max-w-md text-sm text-[#666B84]">
              No budget records match
              the current year and
              filters.
            </p>

            <button
              type="button"
              onClick={
                openCreateForm
              }
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7F74]"
            >
              <Plus
                size={17}
              />
              Create Budget
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px]">
                <thead className="bg-[#FAFAFC]">
                  <tr className="border-b border-[#E9EAF1]">
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Budget
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Account
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Department
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Budget
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Actual
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Committed
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Available
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Utilization
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {budgets.map(
                    (budget) => (
                      <tr
                        key={
                          budget.id
                        }
                        className="border-b border-[#F0F1F5] transition hover:bg-[#FAFBFC]"
                      >
                        {/* Budget */}

                        <td className="px-5 py-5">
                          <div className="max-w-[220px]">
                            <p className="truncate font-semibold text-[#20243A]">
                              {budget.name ||
                                "Annual Budget"}
                            </p>

                            <p className="mt-1 text-xs text-[#8A8EA3]">
                              FY{" "}
                              {
                                budget.year
                              }
                            </p>

                            <p className="mt-1 text-xs text-[#8A8EA3]">
                              {formatDate(
                                budget.startDate
                              )}{" "}
                              —{" "}
                              {formatDate(
                                budget.endDate
                              )}
                            </p>
                          </div>
                        </td>

                        {/* Account */}

                        <td className="px-5 py-5">
                          {budget.account ? (
                            <div>
                              <p className="font-medium text-[#20243A]">
                                {
                                  budget
                                    .account
                                    .name
                                }
                              </p>

                              <p className="mt-1 text-xs text-[#666B84]">
                                {
                                  budget
                                    .account
                                    .code
                                }
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-amber-600">
                              Account not
                              linked
                            </span>
                          )}
                        </td>

                        {/* Department */}

                        <td className="px-5 py-5">
                          <span className="font-medium text-[#20243A]">
                            {
                              budget.department
                            }
                          </span>
                        </td>

                        {/* Budget Amount */}

                        <td className="px-5 py-5 text-right">
                          <span className="font-semibold text-[#20243A]">
                            {formatCurrency(
                              budget.amount
                            )}
                          </span>
                        </td>

                        {/* Actual */}

                        <td className="px-5 py-5 text-right">
                          <span className="text-[#20243A]">
                            {formatCurrency(
                              budget.actual
                            )}
                          </span>
                        </td>

                        {/* Committed */}

                        <td className="px-5 py-5 text-right">
                          <span className="text-[#20243A]">
                            {formatCurrency(
                              budget.committed
                            )}
                          </span>
                        </td>

                        {/* Available */}

                        <td className="px-5 py-5 text-right">
                          <span
                            className={`font-semibold ${
                              Number(
                                budget.available
                              ) <
                              0
                                ? "text-red-600"
                                : "text-[#20243A]"
                            }`}
                          >
                            {formatCurrency(
                              budget.available
                            )}
                          </span>
                        </td>

                        {/* Utilization */}

                        <td className="px-5 py-5 text-right">
                          <span className="font-semibold text-[#20243A]">
                            {formatPercentage(
                              budget.utilization
                            )}
                          </span>
                        </td>

                        {/* Status */}

                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              budget.calculatedStatus
                            )}`}
                          >
                            {
                              budget.calculatedStatus
                            }
                          </span>

                          <p className="mt-1 text-[10px] uppercase tracking-wide text-[#9CA0B1]">
                            Lifecycle:{" "}
                            {
                              budget.status
                            }
                          </p>
                        </td>

                        {/* Actions */}

                        <td className="px-5 py-5">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEditForm(
                                  budget
                                )
                              }
                              className="rounded-lg p-2 text-[#666B84] transition hover:bg-[#F3F4F8] hover:text-[#20243A]"
                              aria-label={`Edit ${budget.name}`}
                            >
                              <Pencil
                                size={17}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  budget
                                )
                              }
                              disabled={
                                deletingId ===
                                budget.id
                              }
                              className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Delete ${budget.name}`}
                            >
                              {deletingId ===
                              budget.id ? (
                                <RefreshCw
                                  size={
                                    17
                                  }
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={
                                    17
                                  }
                                />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* ==================================================
             * PAGINATION
             * ================================================== */}

            <div className="flex flex-col gap-4 border-t border-[#E9EAF1] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#666B84]">
                <span>
                  Showing{" "}
                  <strong className="text-[#20243A]">
                    {showingFrom}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-[#20243A]">
                    {showingTo}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-[#20243A]">
                    {pagination.totalItems.toLocaleString(
                      "en-KE"
                    )}
                  </strong>
                </span>

                <select
                  value={
                    pageSize
                  }
                  onChange={(
                    event
                  ) => {
                    setPageSize(
                      Number(
                        event
                          .target
                          .value
                      )
                    );

                    setPage(
                      1
                    );
                  }}
                  className="rounded-lg border border-[#E1E3EB] bg-white px-3 py-2 text-xs font-medium text-[#20243A] outline-none focus:border-[#0D9488]"
                  aria-label="Rows per page"
                >
                  {PAGE_SIZE_OPTIONS.map(
                    (
                      option
                    ) => (
                      <option
                        key={
                          option
                        }
                        value={
                          option
                        }
                      >
                        {option}{" "}
                        per page
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={
                    !pagination.hasPreviousPage
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          current -
                            1,
                          1
                        )
                    )
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E3EB] text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft
                    size={17}
                  />
                </button>

                {pageNumbers.map(
                  (
                    pageNumber
                  ) => (
                    <button
                      key={
                        pageNumber
                      }
                      type="button"
                      onClick={() =>
                        setPage(
                          pageNumber
                        )
                      }
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition ${
                        pagination.page ===
                        pageNumber
                          ? "bg-[#0D9488] text-white"
                          : "border border-[#E1E3EB] text-[#666B84] hover:bg-[#F8F9FC]"
                      }`}
                    >
                      {
                        pageNumber
                      }
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={
                    !pagination.hasNextPage
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        current +
                        1
                    )
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E3EB] text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ======================================================
       * ACCOUNT DATA NOTE
       * ====================================================== */}

      <div className="rounded-xl border border-[#E4E6EF] bg-[#F8F9FC] px-5 py-4">
        <p className="text-xs leading-5 text-[#666B84]">
          <strong className="text-[#20243A]">
            Accounting scope:
          </strong>{" "}
          actual and committed expenditure
          is calculated from the organization's
          accounting records and Expense account
          activity. Department-level actuals are not
          inferred where the underlying expense record
          does not contain a department dimension.
        </p>
      </div>

      {/* ======================================================
       * AI FORECASTING
       * ====================================================== */}

      <div className="rounded-2xl border border-[#E9EAF1] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3F4F8] text-[#20243A]">
            <Target
              size={22}
            />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#20243A]">
              Forecasting Engine
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#666B84]">
              Forecast values are intentionally not
              fabricated. The forecasting engine should
              calculate projections from sufficient
              historical accounting data before an
              estimated figure is presented here.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-[#D9DBE5] bg-[#FAFAFC] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#20243A]">
                Forecast status
              </p>

              <p className="mt-1 text-sm text-[#666B84]">
                No predictive estimate is displayed
                until the forecasting model has
                sufficient real financial history.
              </p>
            </div>

            <span className="hidden rounded-full border border-[#D9DBE5] bg-white px-3 py-1 text-xs font-semibold text-[#666B84] sm:inline-flex">
              Awaiting model
              data
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================
       * CREATE / EDIT MODAL
       * ====================================================== */}

      {showBudgetForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[#111827]/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-form-title"
        >
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* Modal Header */}

              <div className="flex items-start justify-between border-b border-[#E9EAF1] px-6 py-5">
                <div>
                  <h2
                    id="budget-form-title"
                    className="text-xl font-bold text-[#20243A]"
                  >
                    {editingBudget
                      ? "Edit Budget"
                      : "Create New Budget"}
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    Configure the budget allocation,
                    accounting account and financial
                    period.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeBudgetForm
                  }
                  disabled={
                    saving
                  }
                  className="rounded-lg p-2 text-[#666B84] transition hover:bg-[#F3F4F8] disabled:opacity-50"
                  aria-label="Close budget form"
                >
                  <X
                    size={20}
                  />
                </button>
              </div>

              {/* Modal Form */}

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-5 p-6"
              >
                {/* Budget Name */}

                <div>
                  <label
                    htmlFor="budget-name"
                    className="mb-2 block text-sm font-semibold text-[#20243A]"
                  >
                    Budget Name
                  </label>

                  <input
                    id="budget-name"
                    type="text"
                    value={
                      form.name
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          name: event
                            .target
                            .value,
                        })
                      )
                    }
                    placeholder="e.g. FY 2026 Operating Budget"
                    maxLength={
                      160
                    }
                    disabled={
                      saving
                    }
                    className="w-full rounded-xl border border-[#D9DBE5] px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F8F9FC]"
                  />
                </div>

                {/* Department + Amount */}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="budget-department"
                      className="mb-2 block text-sm font-semibold text-[#20243A]"
                    >
                      Department
                    </label>

                    <input
                      id="budget-department"
                      type="text"
                      value={
                        form.department
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            department:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="e.g. Finance"
                      maxLength={
                        150
                      }
                      disabled={
                        saving
                      }
                      required
                      className="w-full rounded-xl border border-[#D9DBE5] px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F8F9FC]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="budget-amount"
                      className="mb-2 block text-sm font-semibold text-[#20243A]"
                    >
                      Budget Amount
                    </label>

                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#666B84]">
                        KES
                      </span>

                      <input
                        id="budget-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
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
                        placeholder="0.00"
                        disabled={
                          saving
                        }
                        required
                        className="w-full rounded-xl border border-[#D9DBE5] py-3 pl-14 pr-4 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F8F9FC]"
                      />
                    </div>
                  </div>
                </div>

                {/* Account */}

                <div>
                  <label
                    htmlFor="budget-account"
                    className="mb-2 block text-sm font-semibold text-[#20243A]"
                  >
                    Expense Chart of
                    Accounts
                  </label>

                  <select
                    id="budget-account"
                    value={
                      form.accountId
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          accountId:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    disabled={
                      saving ||
                      accountsLoading
                    }
                    required
                    className="w-full rounded-xl border border-[#D9DBE5] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F8F9FC]"
                  >
                    <option value="">
                      {accountsLoading
                        ? "Loading Expense accounts..."
                        : "Select an Expense account"}
                    </option>

                    {accounts.map(
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
                          {
                            account.name
                          }
                        </option>
                      )
                    )}
                  </select>

                  {!accountsLoading &&
                    accounts.length ===
                      0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        No Expense accounts
                        are currently available
                        in the Chart of Accounts.
                      </p>
                    )}
                </div>

                {/* Year + Status */}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="budget-year"
                      className="mb-2 block text-sm font-semibold text-[#20243A]"
                    >
                      Budget Year
                    </label>

                    <select
                      id="budget-year"
                      value={
                        form.year
                      }
                      onChange={(
                        event
                      ) => {
                        const nextYear =
                          Number(
                            event
                              .target
                              .value
                          );

                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            year: String(
                              nextYear
                            ),
                            startDate:
                              getYearStart(
                                nextYear
                              ),
                            endDate:
                              getYearEnd(
                                nextYear
                              ),
                          })
                        );
                      }}
                      disabled={
                        saving
                      }
                      required
                      className="w-full rounded-xl border border-[#D9DBE5] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                    >
                      {yearOptions.map(
                        (
                          optionYear
                        ) => (
                          <option
                            key={
                              optionYear
                            }
                            value={
                              optionYear
                            }
                          >
                            FY{" "}
                            {
                              optionYear
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="budget-status"
                      className="mb-2 block text-sm font-semibold text-[#20243A]"
                    >
                      Lifecycle Status
                    </label>

                    <select
                      id="budget-status"
                      value={
                        form.status
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            status:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      disabled={
                        saving
                      }
                      required
                      className="w-full rounded-xl border border-[#D9DBE5] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                    >
                      <option value="DRAFT">
                        Draft
                      </option>

                      <option value="ACTIVE">
                        Active
                      </option>

                      <option value="ARCHIVED">
                        Archived
                      </option>
                    </select>
                  </div>
                </div>

                {/* Dates */}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="budget-start-date"
                      className="mb-2 block text-sm font-semibold text-[#20243A]"
                    >
                      Start Date
                    </label>

                    <input
                      id="budget-start-date"
                      type="date"
                      value={
                        form.startDate
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            startDate:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      disabled={
                        saving
                      }
                      required
                      className="w-full rounded-xl border border-[#D9DBE5] px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F8F9FC]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="budget-end-date"
                      className="mb-2 block text-sm font-semibold text-[#20243A]"
                    >
                      End Date
                    </label>

                    <input
                      id="budget-end-date"
                      type="date"
                      value={
                        form.endDate
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            endDate:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      disabled={
                        saving
                      }
                      required
                      className="w-full rounded-xl border border-[#D9DBE5] px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F8F9FC]"
                    />
                  </div>
                </div>

                {/* Accounting Note */}

                <div className="rounded-xl border border-[#E4E6EF] bg-[#F8F9FC] p-4">
                  <p className="text-xs leading-5 text-[#666B84]">
                    <strong className="text-[#20243A]">
                      Accounting:
                    </strong>{" "}
                    Actual spend comes from
                    posted Journal Entries against
                    Expense accounts. Committed
                    spend comes from Expense records
                    that have not yet been posted,
                    rejected or cancelled.
                  </p>
                </div>

                {/* Buttons */}

                <div className="flex flex-col-reverse gap-3 border-t border-[#E9EAF1] pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={
                      closeBudgetForm
                    }
                    disabled={
                      saving
                    }
                    className="rounded-xl border border-[#D9DBE5] px-5 py-3 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      accounts.length ===
                        0
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0B7F74] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && (
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />
                    )}

                    {saving
                      ? "Saving..."
                      : editingBudget
                      ? "Save Changes"
                      : "Create Budget"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}