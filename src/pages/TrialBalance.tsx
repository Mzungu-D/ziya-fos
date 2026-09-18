import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

interface TrialBalanceAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface TrialBalanceResponse {
  success: boolean;

  trialBalance: TrialBalanceAccount[];

  totals: {
    debit: number;
    credit: number;
    difference: number;
    balanced: boolean;
  };

  meta?: {
    postedEntries?: number;
    generatedAt?: string;
    asOfDate?: string;
  };

  message?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ACCOUNT_TYPE_ORDER = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
];

export default function TrialBalance() {
  const [accounts, setAccounts] = useState<
    TrialBalanceAccount[]
  >([]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [asOfDate, setAsOfDate] = useState("");

  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [difference, setDifference] = useState(0);
  const [balanced, setBalanced] = useState(true);

  const [postedEntries, setPostedEntries] = useState(0);
  const [generatedAt, setGeneratedAt] = useState("");
  const [reportAsOfDate, setReportAsOfDate] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  /* =========================================================
     FORMATTING
  ========================================================= */

  const formatCurrency = useCallback(
    (amount: number): string => {
      const safeAmount = Number.isFinite(amount)
        ? amount
        : 0;

      return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safeAmount);
    },
    []
  );

  const formatCompactCurrency = useCallback(
    (amount: number): string => {
      const safeAmount = Number.isFinite(amount)
        ? amount
        : 0;

      const absoluteAmount = Math.abs(safeAmount);

      if (absoluteAmount >= 1_000_000_000) {
        return `Ksh ${(safeAmount / 1_000_000_000).toFixed(
          2
        )}B`;
      }

      if (absoluteAmount >= 1_000_000) {
        return `Ksh ${(safeAmount / 1_000_000).toFixed(
          2
        )}M`;
      }

      if (absoluteAmount >= 1_000) {
        return `Ksh ${(safeAmount / 1_000).toFixed(
          2
        )}K`;
      }

      return formatCurrency(safeAmount);
    },
    [formatCurrency]
  );

  const formatReportDate = useCallback(
    (dateValue: string): string => {
      if (!dateValue) {
        return "";
      }

      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return new Intl.DateTimeFormat("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    },
    []
  );

  const formattedGeneratedAt = useMemo(() => {
    if (!generatedAt) {
      return "";
    }

    const date = new Date(generatedAt);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }, [generatedAt]);

  /* =========================================================
     LOAD TRIAL BALANCE
  ========================================================= */

  const loadTrialBalance = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const query = asOfDate
          ? `?asOfDate=${encodeURIComponent(
              asOfDate
            )}`
          : "";

        const response = await authenticatedFetch(
          `/api/trial-balance${query}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data =
          (await response.json()) as TrialBalanceResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to load Trial Balance"
          );
        }

        setAccounts(data.trialBalance ?? []);

        setTotalDebit(
          Number(data.totals?.debit ?? 0)
        );

        setTotalCredit(
          Number(data.totals?.credit ?? 0)
        );

        setDifference(
          Number(data.totals?.difference ?? 0)
        );

        setBalanced(
          data.totals?.balanced ?? false
        );

        setPostedEntries(
          Number(data.meta?.postedEntries ?? 0)
        );

        setGeneratedAt(
          data.meta?.generatedAt ?? ""
        );

        setReportAsOfDate(
          data.meta?.asOfDate ||
            asOfDate ||
            new Date().toISOString()
        );

        setCurrentPage(1);
      } catch (error: unknown) {
        console.error(
          "TRIAL BALANCE ERROR:",
          error
        );

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError(
            "Unable to load Trial Balance"
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [asOfDate]
  );

  useEffect(() => {
    void loadTrialBalance();
  }, [loadTrialBalance]);

  /* =========================================================
     ACCOUNT TYPES
  ========================================================= */

  const accountTypes = useMemo(() => {
    const availableTypes = new Set(
      accounts.map((account) =>
        account.type.toUpperCase()
      )
    );

    const orderedTypes = ACCOUNT_TYPE_ORDER.filter(
      (type) => availableTypes.has(type)
    );

    const additionalTypes = Array.from(
      availableTypes
    )
      .filter(
        (type) =>
          !ACCOUNT_TYPE_ORDER.includes(type)
      )
      .sort();

    return [
      ...orderedTypes,
      ...additionalTypes,
    ];
  }, [accounts]);

  /* =========================================================
     FILTERING
  ========================================================= */

  const filteredAccounts = useMemo(() => {
    const searchTerm = search
      .trim()
      .toLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        !searchTerm ||
        account.code
          .toLowerCase()
          .includes(searchTerm) ||
        account.name
          .toLowerCase()
          .includes(searchTerm) ||
        account.type
          .toLowerCase()
          .includes(searchTerm);

      const normalizedType =
        account.type.toUpperCase();

      const matchesType =
        typeFilter === "All" ||
        normalizedType ===
          typeFilter.toUpperCase();

      return (
        matchesSearch &&
        matchesType
      );
    });
  }, [
    accounts,
    search,
    typeFilter,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    typeFilter,
    pageSize,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAccounts.length /
        pageSize
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedAccounts = useMemo(() => {
    const start =
      (safeCurrentPage - 1) *
      pageSize;

    return filteredAccounts.slice(
      start,
      start + pageSize
    );
  }, [
    filteredAccounts,
    pageSize,
    safeCurrentPage,
  ]);

  const startRow =
    filteredAccounts.length === 0
      ? 0
      : (safeCurrentPage - 1) *
          pageSize +
        1;

  const endRow = Math.min(
    safeCurrentPage * pageSize,
    filteredAccounts.length
  );

  const hasActiveFilters =
    search.trim() !== "" ||
    typeFilter !== "All";

  /* =========================================================
     BALANCE
  ========================================================= */

  const getBalance = (
    account: TrialBalanceAccount
  ) => {
    const debit = Number(account.debit) || 0;
    const credit =
      Number(account.credit) || 0;

    return debit - credit;
  };

  const debitAccountCount = useMemo(
    () =>
      accounts.filter(
        (account) =>
          Number(account.debit) >
          Number(account.credit)
      ).length,
    [accounts]
  );

  const creditAccountCount = useMemo(
    () =>
      accounts.filter(
        (account) =>
          Number(account.credit) >
          Number(account.debit)
      ).length,
    [accounts]
  );

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("All");
  };

  /* =========================================================
     EXPORT
  ========================================================= */

  const handleExport = () => {
    if (
      filteredAccounts.length === 0
    ) {
      return;
    }

    const headers = [
      "Account Code",
      "Account Name",
      "Account Type",
      "Debit",
      "Credit",
      "Balance",
    ];

    const rows = filteredAccounts.map(
      (account) => {
        const balance =
          getBalance(account);

        return [
          account.code,
          account.name,
          account.type,
          Number(account.debit).toFixed(2),
          Number(account.credit).toFixed(2),
          balance.toFixed(2),
        ];
      }
    );

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map(
            (value) =>
              `"${String(value).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
      ),
      "",
      `"Total Debits","","","${totalDebit.toFixed(
        2
      )}","",""`,
      `"Total Credits","","","","${totalCredit.toFixed(
        2
      )}",""`,
      `"Difference","","","","","${difference.toFixed(
        2
      )}"`,
      `"Status","","","","","${
        balanced
          ? "Balanced"
          : "Out of balance"
      }"`,
      `"Report As Of","","","","","${
        reportAsOfDate
          ? formatReportDate(
              reportAsOfDate
            )
          : ""
      }"`,
    ].join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `trial-balance-${
      asOfDate ||
      new Date()
        .toISOString()
        .slice(0, 10)
    }.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =========================================================
     TYPE BADGES
  ========================================================= */

  const getTypeClasses = (
    type: string
  ) => {
    const normalized =
      type.toLowerCase();

    if (normalized === "asset") {
      return "border-sky-200 bg-sky-50 text-sky-700";
    }

    if (
      normalized === "liability"
    ) {
      return "border-violet-200 bg-violet-50 text-violet-700";
    }

    if (
      normalized === "income" ||
      normalized === "revenue"
    ) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (
      normalized === "expense"
    ) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }

    if (
      normalized === "equity"
    ) {
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    }

    return "border-slate-200 bg-slate-50 text-slate-600";
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-full bg-[#F7F8FB]">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {/* =====================================================
            PAGE HEADER
        ====================================================== */}

        <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-[#182033] sm:text-[34px]">
                Trial Balance
              </h1>

              {!loading &&
                !error && (
                  <div
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                      balanced
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {balanced ? (
                      <CheckCircle2
                        size={15}
                      />
                    ) : (
                      <AlertTriangle
                        size={15}
                      />
                    )}

                    {balanced
                      ? "Balanced"
                      : "Out of balance"}
                  </div>
                )}
            </div>

            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#697386]">
              Verify that total debits equal
              total credits across all posted
              and approved journal entries.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[#98A1B2]">
              {reportAsOfDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays
                    size={14}
                  />
                  As of{" "}
                  <span className="text-[#697386]">
                    {formatReportDate(
                      reportAsOfDate
                    )}
                  </span>
                </span>
              )}

              {formattedGeneratedAt && (
                <span>
                  Last calculated ·{" "}
                  <span className="text-[#697386]">
                    {formattedGeneratedAt}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={
                loading ||
                refreshing
              }
              onClick={() =>
                void loadTrialBalance(
                  true
                )
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-sm font-semibold text-[#293246] shadow-sm transition hover:border-[#CBD2DC] hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              onClick={
                handleExport
              }
              disabled={
                loading ||
                !!error ||
                filteredAccounts.length ===
                  0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#109B83] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C8973] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={17} />
              Export CSV
            </button>
          </div>
        </div>

        {/* =====================================================
            REPORT CONTROLS
        ====================================================== */}

        <div className="mb-7 rounded-2xl border border-[#E3E7EE] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="w-full xl:max-w-[230px]">
              <label
                htmlFor="trial-balance-date"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-[#7B8495]"
              >
                Report date
              </label>

              <div className="relative">
                <CalendarDays
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A93A3]"
                />

                <input
                  id="trial-balance-date"
                  type="date"
                  value={asOfDate}
                  onChange={(event) =>
                    setAsOfDate(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#E1E5EC] bg-[#FBFCFD] pl-10 pr-3 text-sm font-medium text-[#344054] outline-none transition focus:border-[#109B83] focus:bg-white focus:ring-2 focus:ring-[#109B83]/10"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <label
                htmlFor="trial-balance-search"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-[#7B8495]"
              >
                Search accounts
              </label>

              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98A1B2]"
                />

                <input
                  id="trial-balance-search"
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search by account code, name or type..."
                  className="h-11 w-full rounded-xl border border-[#E1E5EC] bg-[#FBFCFD] pl-11 pr-10 text-sm text-[#182033] outline-none transition placeholder:text-[#A0A8B6] focus:border-[#109B83] focus:bg-white focus:ring-2 focus:ring-[#109B83]/10"
                />

                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#98A1B2] transition hover:bg-[#F0F2F5] hover:text-[#596579]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="w-full xl:w-[210px]">
              <label
                htmlFor="trial-balance-type"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-[#7B8495]"
              >
                Account type
              </label>

              <div className="relative">
                <SlidersHorizontal
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7D8798]"
                />

                <select
                  id="trial-balance-type"
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-[#E1E5EC] bg-[#FBFCFD] pl-10 pr-10 text-sm font-medium text-[#344054] outline-none transition focus:border-[#109B83] focus:bg-white focus:ring-2 focus:ring-[#109B83]/10"
                >
                  <option value="All">
                    All account types
                  </option>

                  {accountTypes.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#98A1B2]"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E1E5EC] bg-white px-4 text-sm font-semibold text-[#596579] transition hover:bg-[#F8F9FB] hover:text-[#293246]"
              >
                <X size={16} />
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                void loadTrialBalance(
                  true
                )
              }
              disabled={
                refreshing
              }
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#182033] px-5 text-sm font-semibold text-white transition hover:bg-[#101625] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>

        {/* =====================================================
            SUMMARY CARDS
        ====================================================== */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Total Debits */}

          <div className="rounded-2xl border border-[#E3E7EE] bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#697386]">
                  Total Debits
                </p>

                <p className="mt-1 text-xs text-[#98A1B2]">
                  Posted and approved
                  entries
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <span className="text-xs font-bold">
                  DR
                </span>
              </div>
            </div>

            <p className="mt-5 truncate text-[24px] font-semibold tracking-[-0.025em] text-[#087F68]">
              {loading
                ? "—"
                : formatCompactCurrency(
                    totalDebit
                  )}
            </p>
          </div>

          {/* Total Credits */}

          <div className="rounded-2xl border border-[#E3E7EE] bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#697386]">
                  Total Credits
                </p>

                <p className="mt-1 text-xs text-[#98A1B2]">
                  Posted and approved
                  entries
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <span className="text-xs font-bold">
                  CR
                </span>
              </div>
            </div>

            <p className="mt-5 truncate text-[24px] font-semibold tracking-[-0.025em] text-[#344054]">
              {loading
                ? "—"
                : formatCompactCurrency(
                    totalCredit
                  )}
            </p>
          </div>

          {/* Difference */}

          <div className="rounded-2xl border border-[#E3E7EE] bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#697386]">
                  Difference
                </p>

                <p className="mt-1 text-xs text-[#98A1B2]">
                  Debit less credit
                </p>
              </div>

              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  balanced
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600",
                ].join(" ")}
              >
                {balanced ? (
                  <CheckCircle2
                    size={18}
                  />
                ) : (
                  <AlertTriangle
                    size={18}
                  />
                )}
              </div>
            </div>

            <p
              className={[
                "mt-5 truncate text-[24px] font-semibold tracking-[-0.025em]",
                balanced
                  ? "text-[#087F68]"
                  : "text-[#C2415A]",
              ].join(" ")}
            >
              {loading
                ? "—"
                : formatCurrency(
                    difference
                  )}
            </p>
          </div>

          {/* Status */}

          <div className="rounded-2xl border border-[#E3E7EE] bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#697386]">
                  Accounting Status
                </p>

                <p className="mt-1 text-xs text-[#98A1B2]">
                  Double-entry verification
                </p>
              </div>

              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  balanced
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600",
                ].join(" ")}
              >
                {balanced ? (
                  <CheckCircle2
                    size={18}
                  />
                ) : (
                  <AlertTriangle
                    size={18}
                  />
                )}
              </div>
            </div>

            <p
              className={[
                "mt-5 text-[21px] font-semibold tracking-[-0.02em]",
                balanced
                  ? "text-[#087F68]"
                  : "text-[#C2415A]",
              ].join(" ")}
            >
              {loading
                ? "—"
                : balanced
                ? "Balanced"
                : "Out of balance"}
            </p>

            <p className="mt-1 text-xs text-[#98A1B2]">
              {loading
                ? "Checking ledger..."
                : `${postedEntries} ${
                    postedEntries === 1
                      ? "journal entry"
                      : "journal entries"
                  } included`}
            </p>
          </div>
        </div>

        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle
                  size={18}
                />
              </div>

              <div className="min-w-0">
                <p className="font-semibold text-red-800">
                  Unable to load Trial
                  Balance
                </p>

                <p className="mt-1 text-sm leading-5 text-red-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void loadTrialBalance(
                      true
                    )
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                >
                  <RefreshCw
                    size={14}
                  />
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            MAIN ACCOUNT WORKSPACE
        ====================================================== */}

        <div className="overflow-hidden rounded-2xl border border-[#E3E7EE] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          {/* Workspace Header */}

          <div className="border-b border-[#E8EBF0] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#182033]">
                    Account Balances
                  </h2>

                  {!loading &&
                    !error && (
                      <span className="inline-flex items-center rounded-full bg-[#F3F5F8] px-2.5 py-1 text-xs font-semibold text-[#697386]">
                        {filteredAccounts.length}{" "}
                        {filteredAccounts.length ===
                        1
                          ? "account"
                          : "accounts"}
                      </span>
                    )}
                </div>

                <p className="mt-1 text-sm text-[#8A93A3]">
                  Account-level debit and credit
                  balances from the posted
                  ledger.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#8A93A3]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  Debit accounts{" "}
                  <span className="font-semibold text-[#596579]">
                    {debitAccountCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  Credit accounts{" "}
                  <span className="font-semibold text-[#596579]">
                    {creditAccountCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ===================================================
              TABLE
          ==================================================== */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-[#E8EBF0] bg-[#FAFBFC]">
                  <th className="w-[130px] px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Code
                  </th>

                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Account
                  </th>

                  <th className="w-[150px] px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Type
                  </th>

                  <th className="w-[190px] px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Debit
                  </th>

                  <th className="w-[190px] px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Credit
                  </th>

                  <th className="w-[190px] px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Net Balance
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <>
                    {Array.from(
                      { length: 8 },
                      (_, index) => (
                        <tr
                          key={index}
                          className="border-b border-[#EEF0F4]"
                        >
                          <td
                            colSpan={6}
                            className="px-6 py-5"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-4 w-20 animate-pulse rounded bg-[#EEF1F4]" />
                              <div className="h-4 flex-1 animate-pulse rounded bg-[#EEF1F4]" />
                              <div className="h-4 w-28 animate-pulse rounded bg-[#EEF1F4]" />
                              <div className="h-4 w-28 animate-pulse rounded bg-[#EEF1F4]" />
                              <div className="h-4 w-28 animate-pulse rounded bg-[#EEF1F4]" />
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </>
                ) : filteredAccounts.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-20 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3F5F8] text-[#7B8495]">
                          <FileSpreadsheet
                            size={23}
                          />
                        </div>

                        <p className="mt-4 font-semibold text-[#344054]">
                          No accounts found
                        </p>

                        <p className="mt-1 text-sm leading-5 text-[#98A1B2]">
                          {hasActiveFilters
                            ? "Try adjusting your search or account-type filter."
                            : "No posted journal balances are currently available for this report."}
                        </p>

                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={
                              clearFilters
                            }
                            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#E1E5EC] bg-white px-3.5 py-2 text-xs font-semibold text-[#596579] transition hover:bg-[#F8F9FB]"
                          >
                            <X
                              size={14}
                            />
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAccounts.map(
                    (account) => {
                      const balance =
                        getBalance(
                          account
                        );

                      return (
                        <tr
                          key={account.id}
                          className="group border-b border-[#EEF0F4] transition hover:bg-[#FBFCFD]"
                        >
                          {/* Code */}

                          <td className="px-6 py-4 align-middle">
                            <span className="inline-flex rounded-lg bg-[#F5F7FA] px-2.5 py-1 font-mono text-[13px] font-semibold text-[#344054]">
                              {
                                account.code
                              }
                            </span>
                          </td>

                          {/* Account */}

                          <td className="px-6 py-4 align-middle">
                            <div className="min-w-0">
                              <div className="font-medium text-[#182033]">
                                {
                                  account.name
                                }
                              </div>

                              <div className="mt-0.5 text-xs text-[#A0A8B6]">
                                {
                                  account.id
                                }
                              </div>
                            </div>
                          </td>

                          {/* Type */}

                          <td className="px-6 py-4 align-middle">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                getTypeClasses(
                                  account.type
                                ),
                              ].join(
                                " "
                              )}
                            >
                              {account.type.toUpperCase()}
                            </span>
                          </td>

                          {/* Debit */}

                          <td className="px-6 py-4 text-right align-middle">
                            <span
                              className={[
                                "tabular-nums text-[13px]",
                                Number(
                                  account.debit
                                ) > 0
                                  ? "font-semibold text-[#344054]"
                                  : "text-[#B0B7C3]",
                              ].join(
                                " "
                              )}
                            >
                              {Number(
                                account.debit
                              ) > 0
                                ? formatCurrency(
                                    Number(
                                      account.debit
                                    )
                                  )
                                : "—"}
                            </span>
                          </td>

                          {/* Credit */}

                          <td className="px-6 py-4 text-right align-middle">
                            <span
                              className={[
                                "tabular-nums text-[13px]",
                                Number(
                                  account.credit
                                ) > 0
                                  ? "font-semibold text-[#344054]"
                                  : "text-[#B0B7C3]",
                              ].join(
                                " "
                              )}
                            >
                              {Number(
                                account.credit
                              ) > 0
                                ? formatCurrency(
                                    Number(
                                      account.credit
                                    )
                                  )
                                : "—"}
                            </span>
                          </td>

                          {/* Balance */}

                          <td className="px-6 py-4 text-right align-middle">
                            <span
                              className={[
                                "tabular-nums text-[13px] font-semibold",
                                balance > 0
                                  ? "text-[#087F68]"
                                  : balance < 0
                                  ? "text-[#C2415A]"
                                  : "text-[#98A1B2]",
                              ].join(
                                " "
                              )}
                            >
                              {balance !==
                              0
                                ? formatCurrency(
                                    balance
                                  )
                                : "—"}
                            </span>

                            {balance !==
                              0 && (
                              <span
                                className={[
                                  "ml-2 text-[10px] font-bold uppercase tracking-wide",
                                  balance >
                                  0
                                    ? "text-[#087F68]"
                                    : "text-[#C2415A]",
                                ].join(
                                  " "
                                )}
                              >
                                {balance >
                                0
                                  ? "DR"
                                  : "CR"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>

              {/* =================================================
                  TOTAL
              ================================================== */}

              {!loading &&
                !error &&
                filteredAccounts.length >
                  0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[#DDE2EA] bg-[#F7FAF9]">
                      <td
                        colSpan={3}
                        className="px-6 py-4"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#087F68]">
                            Total
                          </p>

                          <p className="mt-0.5 text-xs text-[#7B8495]">
                            {filteredAccounts.length ===
                            accounts.length
                              ? "All accounts"
                              : "Filtered accounts"}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="text-[13px] font-bold tabular-nums text-[#087F68]">
                          {formatCurrency(
                            totalDebit
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="text-[13px] font-bold tabular-nums text-[#344054]">
                          {formatCurrency(
                            totalCredit
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={[
                            "text-[13px] font-bold tabular-nums",
                            balanced
                              ? "text-[#087F68]"
                              : "text-[#C2415A]",
                          ].join(
                            " "
                          )}
                        >
                          {formatCurrency(
                            difference
                          )}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
            </table>
          </div>

          {/* =====================================================
              PAGINATION
          ====================================================== */}

          {!loading &&
            !error &&
            filteredAccounts.length >
              0 && (
              <div className="flex flex-col gap-4 border-t border-[#E8EBF0] px-5 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-[#7B8495]">
                  <span>
                    Showing{" "}
                    <span className="font-semibold text-[#344054]">
                      {startRow}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-[#344054]">
                      {endRow}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#344054]">
                      {
                        filteredAccounts.length
                      }
                    </span>
                  </span>

                  <span className="hidden h-4 w-px bg-[#E1E5EC] sm:block" />

                  <label className="flex items-center gap-2">
                    <span className="text-xs">
                      Rows
                    </span>

                    <select
                      value={
                        pageSize
                      }
                      onChange={(
                        event
                      ) =>
                        setPageSize(
                          Number(
                            event
                              .target
                              .value
                          )
                        )
                      }
                      className="rounded-lg border border-[#E1E5EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#344054] outline-none focus:border-[#109B83]"
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
                            {
                              option
                            }
                            / page
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={
                      safeCurrentPage <=
                      1
                    }
                    onClick={() =>
                      setCurrentPage(
                        (
                          page
                        ) =>
                          Math.max(
                            1,
                            page -
                              1
                          )
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E5EC] bg-white text-[#596579] transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft
                      size={17}
                    />
                  </button>

                  <div className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#182033] px-3 text-xs font-semibold text-white">
                    {
                      safeCurrentPage
                    }
                  </div>

                  <span className="px-1 text-xs text-[#98A1B2]">
                    of{" "}
                    {
                      totalPages
                    }
                  </span>

                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={
                      safeCurrentPage >=
                      totalPages
                    }
                    onClick={() =>
                      setCurrentPage(
                        (
                          page
                        ) =>
                          Math.min(
                            totalPages,
                            page +
                              1
                          )
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E5EC] bg-white text-[#596579] transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight
                      size={17}
                    />
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* =====================================================
            ACCOUNTING VERIFICATION
        ====================================================== */}

        {!loading &&
          !error && (
            <div
              className={[
                "mt-5 overflow-hidden rounded-2xl border",
                balanced
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-red-200 bg-red-50/70",
              ].join(" ")}
            >
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      balanced
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600",
                    ].join(" ")}
                  >
                    {balanced ? (
                      <CheckCircle2
                        size={19}
                      />
                    ) : (
                      <AlertTriangle
                        size={19}
                      />
                    )}
                  </div>

                  <div>
                    <p
                      className={[
                        "text-sm font-semibold",
                        balanced
                          ? "text-emerald-800"
                          : "text-red-800",
                      ].join(" ")}
                    >
                      {balanced
                        ? "Trial balance is balanced"
                        : "Trial balance is out of balance"}
                    </p>

                    <p
                      className={[
                        "mt-1 max-w-2xl text-sm leading-5",
                        balanced
                          ? "text-emerald-700"
                          : "text-red-700",
                      ].join(" ")}
                    >
                      {balanced
                        ? "Total debits equal total credits across the included posted and approved journal entries."
                        : "A difference exists between total debits and credits. Review the underlying posted journal entries before relying on this report."}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <div
                    className={[
                      "rounded-xl border bg-white px-4 py-3",
                      balanced
                        ? "border-emerald-200"
                        : "border-red-200",
                    ].join(" ")}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A1B2]">
                      Difference
                    </p>

                    <p
                      className={[
                        "mt-1 text-lg font-bold tabular-nums",
                        balanced
                          ? "text-emerald-700"
                          : "text-red-700",
                      ].join(" ")}
                    >
                      {formatCurrency(
                        difference
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={[
                  "grid grid-cols-1 border-t sm:grid-cols-3",
                  balanced
                    ? "border-emerald-200"
                    : "border-red-200",
                ].join(" ")}
              >
                <div
                  className={[
                    "px-5 py-3.5 sm:px-6",
                    balanced
                      ? "border-emerald-200 sm:border-r"
                      : "border-red-200 sm:border-r",
                  ].join(" ")}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A93A3]">
                    Journal Entries
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#344054]">
                    {postedEntries}
                  </p>
                </div>

                <div
                  className={[
                    "px-5 py-3.5 sm:px-6",
                    balanced
                      ? "border-emerald-200 sm:border-r"
                      : "border-red-200 sm:border-r",
                  ].join(" ")}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A93A3]">
                    Total Debits
                  </p>

                  <p className="mt-1 text-sm font-semibold tabular-nums text-[#344054]">
                    {formatCurrency(
                      totalDebit
                    )}
                  </p>
                </div>

                <div className="px-5 py-3.5 sm:px-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A93A3]">
                    Total Credits
                  </p>

                  <p className="mt-1 text-sm font-semibold tabular-nums text-[#344054]">
                    {formatCurrency(
                      totalCredit
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
