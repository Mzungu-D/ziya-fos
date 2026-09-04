import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
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
  };

  message?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TrialBalance() {
  const [accounts, setAccounts] = useState<TrialBalanceAccount[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [difference, setDifference] = useState(0);
  const [balanced, setBalanced] = useState(true);
  const [postedEntries, setPostedEntries] = useState(0);
  const [generatedAt, setGeneratedAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  const formatCompactCurrency = useCallback(
    (amount: number): string => {
      if (Math.abs(amount) >= 1_000_000_000) {
        return `Ksh ${(amount / 1_000_000_000).toFixed(2)}B`;
      }

      if (Math.abs(amount) >= 1_000_000) {
        return `Ksh ${(amount / 1_000_000).toFixed(2)}M`;
      }

      if (Math.abs(amount) >= 1_000) {
        return `Ksh ${(amount / 1_000).toFixed(2)}K`;
      }

      return formatCurrency(amount);
    },
    [formatCurrency]
  );

  const loadTrialBalance = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await authenticatedFetch(
          "/api/trial-balance",
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
            data.message || "Failed to load Trial Balance"
          );
        }

        setAccounts(data.trialBalance ?? []);

        setTotalDebit(data.totals?.debit ?? 0);
        setTotalCredit(data.totals?.credit ?? 0);
        setDifference(data.totals?.difference ?? 0);
        setBalanced(data.totals?.balanced ?? false);

        setPostedEntries(data.meta?.postedEntries ?? 0);
        setGeneratedAt(data.meta?.generatedAt ?? "");
      } catch (error: unknown) {
        console.error("TRIAL BALANCE ERROR:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Unable to load Trial Balance");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadTrialBalance();
  }, [loadTrialBalance]);

  const accountTypes = useMemo(() => {
    const types = Array.from(
      new Set(accounts.map((account) => account.type))
    );

    return types.sort();
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        !searchTerm ||
        account.code.toLowerCase().includes(searchTerm) ||
        account.name.toLowerCase().includes(searchTerm) ||
        account.type.toLowerCase().includes(searchTerm);

      const matchesType =
        typeFilter === "All" || account.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [accounts, search, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, pageSize]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAccounts.length / pageSize)
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedAccounts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;

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
      : (safeCurrentPage - 1) * pageSize + 1;

  const endRow = Math.min(
    safeCurrentPage * pageSize,
    filteredAccounts.length
  );

  const handleExport = () => {
    if (filteredAccounts.length === 0) {
      return;
    }

    const headers = [
      "Account Code",
      "Account Name",
      "Type",
      "Debit",
      "Credit",
      "Balance",
    ];

    const rows = filteredAccounts.map((account) => {
      const balance =
        account.debit - account.credit;

      return [
        account.code,
        account.name,
        account.type,
        account.debit.toFixed(2),
        account.credit.toFixed(2),
        balance.toFixed(2),
      ];
    });

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((value) =>
            `"${String(value).replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "trial-balance.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

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

  const getTypeClasses = (type: string) => {
    const normalized = type.toLowerCase();

    if (normalized === "asset") {
      return "border-sky-200 bg-sky-50 text-sky-700";
    }

    if (normalized === "liability") {
      return "border-violet-200 bg-violet-50 text-violet-700";
    }

    if (
      normalized === "revenue" ||
      normalized === "income"
    ) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (normalized === "expense") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }

    if (normalized === "equity") {
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    }

    return "border-slate-200 bg-slate-50 text-slate-600";
  };

  const getBalance = (account: TrialBalanceAccount) =>
    account.debit - account.credit;

  return (
    <div className="min-h-full bg-[#F7F8FB]">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {/* =========================================================
            HEADER
        ========================================================== */}

        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[#182033] sm:text-[34px]">
                Trial Balance
              </h1>

              {!loading && !error && (
                <div
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                    balanced
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700",
                  ].join(" ")}
                >
                  {balanced ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <AlertTriangle size={15} />
                  )}

                  {balanced
                    ? "Balanced"
                    : "Out of balance"}
                </div>
              )}
            </div>

            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#697386]">
              Verify that total posted debits equal total
              posted credits across all accounts.
            </p>

            {formattedGeneratedAt && (
              <p className="mt-2 text-xs font-medium text-[#98A1B2]">
                Last calculated · {formattedGeneratedAt}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={refreshing}
              onClick={() =>
                void loadTrialBalance(true)
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E1E5EC] bg-white px-4 text-sm font-semibold text-[#293246] shadow-sm transition hover:border-[#D5DAE3] hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={
                loading ||
                !!error ||
                filteredAccounts.length === 0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#109B83] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C8973] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={17} />
              Export
            </button>
          </div>
        </div>

        {/* =========================================================
            KPI CARDS
        ========================================================== */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Total Accounts */}
          <div className="rounded-2xl border border-[#E5E8EF] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#697386]">
                Total Accounts
              </p>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F6F9] text-[#5C667A]">
                <SlidersHorizontal size={17} />
              </div>
            </div>

            <p className="mt-4 text-[25px] font-semibold tracking-[-0.02em] text-[#182033]">
              {loading ? "—" : accounts.length}
            </p>

            <p className="mt-1 text-xs text-[#98A1B2]">
              Accounts with posted balances
            </p>
          </div>

          {/* Total Debits */}
          <div className="rounded-2xl border border-[#E5E8EF] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#697386]">
                Total Debits
              </p>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <span className="text-xs font-bold">
                  DR
                </span>
              </div>
            </div>

            <p className="mt-4 text-[23px] font-semibold tracking-[-0.02em] text-[#087F68]">
              {loading
                ? "—"
                : formatCompactCurrency(totalDebit)}
            </p>

            <p className="mt-1 text-xs text-[#98A1B2]">
              Debit-side balances
            </p>
          </div>

          {/* Total Credits */}
          <div className="rounded-2xl border border-[#E5E8EF] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#697386]">
                Total Credits
              </p>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <span className="text-xs font-bold">
                  CR
                </span>
              </div>
            </div>

            <p className="mt-4 text-[23px] font-semibold tracking-[-0.02em] text-[#344054]">
              {loading
                ? "—"
                : formatCompactCurrency(totalCredit)}
            </p>

            <p className="mt-1 text-xs text-[#98A1B2]">
              Credit-side balances
            </p>
          </div>

          {/* Difference */}
          <div className="rounded-2xl border border-[#E5E8EF] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#697386]">
                Difference
              </p>

              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  balanced
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600",
                ].join(" ")}
              >
                {balanced ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertTriangle size={17} />
                )}
              </div>
            </div>

            <p
              className={[
                "mt-4 text-[23px] font-semibold tracking-[-0.02em]",
                balanced
                  ? "text-[#087F68]"
                  : "text-[#C2415A]",
              ].join(" ")}
            >
              {loading
                ? "—"
                : formatCurrency(difference)}
            </p>

            <p className="mt-1 text-xs text-[#98A1B2]">
              {balanced
                ? "Debits and credits agree"
                : "Review posting imbalance"}
            </p>
          </div>
        </div>

        {/* =========================================================
            ERROR
        ========================================================== */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle size={18} />
              </div>

              <div>
                <p className="font-semibold text-red-800">
                  Unable to load Trial Balance
                </p>

                <p className="mt-1 text-sm leading-5 text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            MAIN TABLE CARD
        ========================================================== */}

        <div className="overflow-hidden rounded-2xl border border-[#E3E7EE] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          {/* Table header */}
          <div className="border-b border-[#E8EBF0] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-[#182033]">
                  Account Balances
                </h2>

                <p className="mt-1 text-sm text-[#8A93A3]">
                  Trial balance by chart-of-accounts
                  entry
                </p>
              </div>

              <div className="text-sm text-[#8A93A3]">
                Based on{" "}
                <span className="font-semibold text-[#4B5568]">
                  {postedEntries}
                </span>{" "}
                posted{" "}
                {postedEntries === 1
                  ? "journal entry"
                  : "journal entries"}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-5 flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98A1B2]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search account code, name or type..."
                  className="h-11 w-full rounded-xl border border-[#E1E5EC] bg-[#FBFCFD] pl-11 pr-4 text-sm text-[#182033] outline-none transition placeholder:text-[#A0A8B6] focus:border-[#109B83] focus:bg-white focus:ring-2 focus:ring-[#109B83]/10"
                />
              </div>

              <div className="relative min-w-[190px]">
                <SlidersHorizontal
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7D8798]"
                />

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-[#E1E5EC] bg-[#FBFCFD] pl-11 pr-9 text-sm font-medium text-[#344054] outline-none transition focus:border-[#109B83] focus:bg-white focus:ring-2 focus:ring-[#109B83]/10"
                >
                  <option value="All">
                    All account types
                  </option>

                  {accountTypes.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ))}
                </select>

                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#98A1B2]">
                  ▾
                </span>
              </div>
            </div>
          </div>

          {/* =======================================================
              TABLE
          ======================================================== */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[#E8EBF0] bg-[#FAFBFC]">
                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Account Code
                  </th>

                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Account
                  </th>

                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Type
                  </th>

                  <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Debit
                  </th>

                  <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Credit
                  </th>

                  <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7B8495]">
                    Balance
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <>
                    {[1, 2, 3, 4, 5].map(
                      (row) => (
                        <tr
                          key={row}
                          className="border-b border-[#EEF0F4]"
                        >
                          <td
                            colSpan={6}
                            className="px-6 py-5"
                          >
                            <div className="h-5 w-full animate-pulse rounded-md bg-[#F0F2F5]" />
                          </td>
                        </tr>
                      )
                    )}
                  </>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F5F8] text-[#7B8495]">
                          <Search size={20} />
                        </div>

                        <p className="mt-4 font-semibold text-[#344054]">
                          No accounts found
                        </p>

                        <p className="mt-1 text-sm text-[#98A1B2]">
                          {search || typeFilter !== "All"
                            ? "Try adjusting your search or filters."
                            : "No posted journal balances are currently available."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAccounts.map(
                    (account) => {
                      const balance =
                        getBalance(account);

                      return (
                        <tr
                          key={account.id}
                          className="group border-b border-[#EEF0F4] transition hover:bg-[#FBFCFD]"
                        >
                          {/* Code */}
                          <td className="px-6 py-4">
                            <span className="font-mono text-[13px] font-semibold text-[#344054]">
                              {account.code}
                            </span>
                          </td>

                          {/* Account */}
                          <td className="px-6 py-4">
                            <div className="font-medium text-[#182033]">
                              {account.name}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-6 py-4">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                                getTypeClasses(
                                  account.type
                                ),
                              ].join(" ")}
                            >
                              {account.type}
                            </span>
                          </td>

                          {/* Debit */}
                          <td className="px-6 py-4 text-right">
                            <span
                              className={
                                account.debit > 0
                                  ? "font-medium tabular-nums text-[#344054]"
                                  : "tabular-nums text-[#B0B7C3]"
                              }
                            >
                              {account.debit > 0
                                ? formatCurrency(
                                    account.debit
                                  )
                                : "—"}
                            </span>
                          </td>

                          {/* Credit */}
                          <td className="px-6 py-4 text-right">
                            <span
                              className={
                                account.credit > 0
                                  ? "font-medium tabular-nums text-[#344054]"
                                  : "tabular-nums text-[#B0B7C3]"
                              }
                            >
                              {account.credit > 0
                                ? formatCurrency(
                                    account.credit
                                  )
                                : "—"}
                            </span>
                          </td>

                          {/* Balance */}
                          <td className="px-6 py-4 text-right">
                            <span
                              className={[
                                "font-medium tabular-nums",
                                balance > 0
                                  ? "text-[#087F68]"
                                  : balance < 0
                                  ? "text-[#C2415A]"
                                  : "text-[#98A1B2]",
                              ].join(" ")}
                            >
                              {balance !== 0
                                ? formatCurrency(
                                    balance
                                  )
                                : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}

                {/* TOTAL */}
                {!loading &&
                  !error &&
                  filteredAccounts.length > 0 && (
                    <tr className="bg-[#F0FAF7]">
                      <td
                        colSpan={3}
                        className="px-6 py-4"
                      >
                        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#087F68]">
                          Total
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold tabular-nums text-[#087F68]">
                          {formatCurrency(totalDebit)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold tabular-nums text-[#087F68]">
                          {formatCurrency(totalCredit)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold tabular-nums text-[#087F68]">
                          {formatCurrency(difference)}
                        </span>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          {/* =======================================================
              PAGINATION
          ======================================================== */}

          {!loading &&
            filteredAccounts.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-[#E8EBF0] px-5 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 text-sm text-[#7B8495]">
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
                      {filteredAccounts.length}
                    </span>
                  </span>

                  <select
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(
                        Number(event.target.value)
                      )
                    }
                    className="rounded-lg border border-[#E1E5EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#344054] outline-none focus:border-[#109B83]"
                  >
                    {PAGE_SIZE_OPTIONS.map(
                      (option) => (
                        <option
                          key={option}
                          value={option}
                        >
                          {option} / page
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.max(1, page - 1)
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E5EC] bg-white text-[#596579] transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <div className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#182033] px-3 text-xs font-semibold text-white">
                    {safeCurrentPage}
                  </div>

                  <span className="px-1 text-xs text-[#98A1B2]">
                    of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      safeCurrentPage >= totalPages
                    }
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.min(
                            totalPages,
                            page + 1
                          )
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E5EC] bg-white text-[#596579] transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* =========================================================
            BALANCE VERIFICATION
        ========================================================== */}

        {!loading && !error && (
          <div
            className={[
              "mt-5 flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
              balanced
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-red-200 bg-red-50/70",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  balanced
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600",
                ].join(" ")}
              >
                {balanced ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertTriangle size={18} />
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
                    "mt-0.5 text-sm",
                    balanced
                      ? "text-emerald-700"
                      : "text-red-700",
                  ].join(" ")}
                >
                  {balanced
                    ? "Total debits equal total credits across all posted journal entries."
                    : "There is a difference between total debits and total credits. Review the posted journal entries."}
                </p>
              </div>
            </div>

            <div
              className={[
                "text-sm font-semibold",
                balanced
                  ? "text-emerald-800"
                  : "text-red-800",
              ].join(" ")}
            >
              Difference:{" "}
              {formatCurrency(difference)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}