import { useCallback, useEffect, useMemo, useState } from "react";
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

  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [difference, setDifference] = useState(0);
  const [balanced, setBalanced] = useState(true);
  const [postedEntries, setPostedEntries] = useState(0);
  const [generatedAt, setGeneratedAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [accountType, setAccountType] = useState("All");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showFilters, setShowFilters] = useState(false);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  const formatDateTime = (value: string): string => {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleString("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

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
    ).sort();

    return ["All", ...types];
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
        accountType === "All" ||
        account.type === accountType;

      return matchesSearch && matchesType;
    });
  }, [accounts, search, accountType]);

  useEffect(() => {
    setPage(1);
  }, [search, accountType, pageSize]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAccounts.length / pageSize)
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredAccounts.slice(
      start,
      start + pageSize
    );
  }, [filteredAccounts, currentPage, pageSize]);

  const visibleStart =
    filteredAccounts.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const visibleEnd =
    filteredAccounts.length === 0
      ? 0
      : Math.min(
          currentPage * pageSize,
          filteredAccounts.length
        );

  const clearFilters = () => {
    setSearch("");
    setAccountType("All");
    setPage(1);
  };

  const exportTrialBalance = () => {
    if (filteredAccounts.length === 0) {
      window.alert(
        "There are no Trial Balance accounts to export."
      );
      return;
    }

    const headers = [
      "Account Code",
      "Account",
      "Type",
      "Debit",
      "Credit",
    ];

    const rows = filteredAccounts.map((account) => [
      account.code,
      account.name,
      account.type,
      account.debit,
      account.credit,
    ]);

    const csv = [
      headers,
      ...rows,
      [],
      [
        "TOTAL",
        "",
        "",
        totalDebit,
        totalCredit,
      ],
      [
        "DIFFERENCE",
        "",
        "",
        "",
        difference,
      ],
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `ziya-trial-balance-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const debitCardValue = formatCurrency(totalDebit);
  const creditCardValue = formatCurrency(totalCredit);
  const differenceCardValue = formatCurrency(
    Math.abs(difference)
  );

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#20243A]">
              Trial Balance
            </h1>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                balanced
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {balanced ? (
                <CheckCircle2 size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}

              {balanced ? "Balanced" : "Unbalanced"}
            </span>
          </div>

          <p className="mt-2 text-sm text-[#666B84]">
            Verify that total posted debits equal total posted
            credits across all accounts.
          </p>

          {generatedAt && (
            <p className="mt-1 text-xs text-[#8A8FA3]">
              Last calculated: {formatDateTime(generatedAt)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadTrialBalance(true)}
            className="flex items-center gap-2 rounded-xl border border-[#E7E9F0] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] shadow-sm transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "animate-spin" : ""
              }
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={exportTrialBalance}
            disabled={loading || filteredAccounts.length === 0}
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={17} />
            Export
          </button>
        </div>
      </div>

      {/* =====================================================
          KPI CARDS
      ====================================================== */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Accounts */}

        <div className="rounded-2xl border border-[#E7E9F0] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Total Accounts
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
                {loading ? "—" : accounts.length}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                Accounts with posted balances
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-600">
              <SlidersHorizontal size={19} />
            </div>
          </div>
        </div>

        {/* Debits */}

        <div className="rounded-2xl border border-[#E7E9F0] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Total Debits
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                {loading ? "—" : debitCardValue}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                Debit-side balances
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <span className="text-lg font-bold">DR</span>
            </div>
          </div>
        </div>

        {/* Credits */}

        <div className="rounded-2xl border border-[#E7E9F0] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Total Credits
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
                {loading ? "—" : creditCardValue}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                Credit-side balances
              </p>
            </div>

            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
              <span className="text-lg font-bold">CR</span>
            </div>
          </div>
        </div>

        {/* Difference */}

        <div className="rounded-2xl border border-[#E7E9F0] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Difference
              </p>

              <p
                className={`mt-2 text-2xl font-bold tracking-tight ${
                  balanced
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {loading ? "—" : differenceCardValue}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                {balanced
                  ? "Debits and credits agree"
                  : "Ledger requires investigation"}
              </p>
            </div>

            <div
              className={`rounded-xl p-2.5 ${
                balanced
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {balanced ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          FILTER / SEARCH PANEL
      ====================================================== */}

      <div className="rounded-2xl border border-[#E7E9F0] bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
          <div className="flex min-h-[44px] flex-1 items-center rounded-xl border border-[#E7E9F0] bg-[#FAFBFC] px-3">
            <Search
              size={18}
              className="shrink-0 text-[#8A8FA3]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search account code, account name or type..."
              className="w-full bg-transparent px-3 py-2.5 text-sm text-[#20243A] outline-none placeholder:text-[#9A9EAE]"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setShowFilters((current) => !current)
            }
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              showFilters
                ? "border-[#0D9488]/30 bg-[#0D9488]/5 text-[#0D9488]"
                : "border-[#E7E9F0] bg-white text-[#20243A] hover:bg-[#F8F9FC]"
            }`}
          >
            <SlidersHorizontal size={17} />
            Filters
          </button>

          {(search || accountType !== "All") && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-[#0D9488] hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="border-t border-[#E7E9F0] px-4 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Account Type
                </label>

                <select
                  value={accountType}
                  onChange={(event) =>
                    setAccountType(event.target.value)
                  }
                  className="w-full rounded-xl border border-[#E7E9F0] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                >
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "All"
                        ? "All account types"
                        : type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <div className="rounded-xl bg-[#F8F9FC] px-4 py-3 text-sm text-[#666B84]">
                  Showing{" "}
                  <span className="font-semibold text-[#20243A]">
                    {filteredAccounts.length}
                  </span>{" "}
                  matching account
                  {filteredAccounts.length === 1
                    ? ""
                    : "s"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-rose-600"
            />

            <div>
              <p className="font-semibold text-rose-700">
                Unable to load Trial Balance
              </p>

              <p className="mt-1 text-sm text-rose-600">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          TABLE
      ====================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#E7E9F0] bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#E7E9F0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#20243A]">
              Account Balances
            </h2>

            <p className="mt-0.5 text-xs text-[#8A8FA3]">
              Trial balance by chart-of-accounts entry
            </p>
          </div>

          <div className="text-xs text-[#666B84]">
            {postedEntries > 0 && (
              <>
                Based on{" "}
                <span className="font-semibold text-[#20243A]">
                  {postedEntries}
                </span>{" "}
                posted journal{" "}
                {postedEntries === 1
                  ? "entry"
                  : "entries"}
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-[#E7E9F0] bg-[#FAFBFC] text-left">
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Account Code
                </th>

                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Account
                </th>

                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Type
                </th>

                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Debit
                </th>

                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Credit
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-16 text-center"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <RefreshCw
                        size={22}
                        className="animate-spin text-[#0D9488]"
                      />

                      <p className="mt-3 text-sm font-medium text-[#20243A]">
                        Loading Trial Balance...
                      </p>

                      <p className="mt-1 text-xs text-[#8A8FA3]">
                        Calculating account balances
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-16 text-center"
                  >
                    <p className="text-sm font-medium text-[#20243A]">
                      {search || accountType !== "All"
                        ? "No matching accounts found."
                        : "No posted journal balances available."}
                    </p>

                    {(search ||
                      accountType !== "All") && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 text-sm font-medium text-[#0D9488] hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-[#F0F1F5] transition hover:bg-[#FAFBFC]"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-semibold text-[#20243A]">
                        {account.code}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-[#20243A]">
                        {account.name}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full border border-[#E7E9F0] bg-[#F8F9FC] px-2.5 py-1 text-xs font-medium text-[#666B84]">
                        {account.type}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-sm font-medium text-emerald-600">
                        {account.debit > 0
                          ? formatCurrency(account.debit)
                          : "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-sm font-medium text-rose-600">
                        {account.credit > 0
                          ? formatCurrency(account.credit)
                          : "—"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading &&
              !error &&
              filteredAccounts.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#DDE0E8] bg-[#FAFBFC]">
                    <td
                      colSpan={3}
                      className="px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#20243A]"
                    >
                      Total
                    </td>

                    <td className="px-5 py-4 text-right font-mono text-sm font-bold text-emerald-600">
                      {formatCurrency(totalDebit)}
                    </td>

                    <td className="px-5 py-4 text-right font-mono text-sm font-bold text-rose-600">
                      {formatCurrency(totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              )}
          </table>
        </div>

        {/* =================================================
            PAGINATION
        ================================================== */}

        {!loading && filteredAccounts.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-[#E7E9F0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-[#666B84]">
              Showing{" "}
              <span className="font-semibold text-[#20243A]">
                {visibleStart}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-[#20243A]">
                {visibleEnd}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#20243A]">
                {filteredAccounts.length}
              </span>{" "}
              accounts
            </div>

            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(event) =>
                  setPageSize(Number(event.target.value))
                }
                className="rounded-lg border border-[#E7E9F0] bg-white px-2.5 py-2 text-xs text-[#20243A] outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                  className="rounded-lg border border-[#E7E9F0] bg-white p-2 text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="min-w-[70px] text-center text-xs font-medium text-[#20243A]">
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        totalPages,
                        current + 1
                      )
                    )
                  }
                  className="rounded-lg border border-[#E7E9F0] bg-white p-2 text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          VERIFICATION FOOTER
      ====================================================== */}

      {!loading && !error && (
        <div
          className={`rounded-2xl border p-4 ${
            balanced
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-rose-200 bg-rose-50/60"
          }`}
        >
          <div className="flex items-start gap-3">
            {balanced ? (
              <CheckCircle2
                size={21}
                className="mt-0.5 shrink-0 text-emerald-600"
              />
            ) : (
              <AlertTriangle
                size={21}
                className="mt-0.5 shrink-0 text-rose-600"
              />
            )}

            <div>
              <p
                className={`font-semibold ${
                  balanced
                    ? "text-emerald-700"
                    : "text-rose-700"
                }`}
              >
                {balanced
                  ? "Trial Balance is Balanced"
                  : "Trial Balance is Out of Balance"}
              </p>

              <p className="mt-1 text-sm text-[#666B84]">
                {balanced
                  ? `Total debits equal total credits${
                      postedEntries > 0
                        ? ` across ${postedEntries} posted journal ${
                            postedEntries === 1
                              ? "entry"
                              : "entries"
                          }.`
                        : "."
                    }`
                  : `The Trial Balance has a difference of ${formatCurrency(
                      difference
                    )}. Review the underlying posted journal entries.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}