import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authenticatedFetch } from "../../lib/auth";

/* =========================================================
   TYPES
========================================================= */

interface ExpenseAccount {
  code?: string | null;
  name?: string | null;
  amount?: number | string | null;
}

interface ExpenseAnalysisPagination {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

interface ExpenseAnalysisResponse {
  success: boolean;

  data?: ExpenseAccount[];

  totals?: {
    expenses?: number | string | null;
  };

  controls?: {
    reportAccounts?: number;
    nonZeroAccounts?: number;
    displayedAccounts?: number;
    reportingBasis?: string;
    accountingBasis?: string;
    source?: string;
  };

  pagination?: ExpenseAnalysisPagination;

  meta?: {
    organizationId?: string;
    search?: string | null;
    generatedAt?: string;
    startDate?: string | null;
    endDate?: string | null;
  };

  message?: string;
}

interface ExpenseCategory {
  name: string;
  code: string;
  value: number;
  amount: number;
}

/* =========================================================
   CONSTANTS
========================================================= */

const EXPENSE_ANALYSIS_ENDPOINT =
  "/api/financial-reports/expense-analysis";

/*
 * The financial report endpoint is paginated.
 *
 * Expense accounts are normally a relatively small dataset,
 * but the dashboard must never silently display only the
 * first page.
 */
const PAGE_SIZE = 100;

const MAX_PAGES = 1000;

const COLORS = [
  "#20243A",
  "#16A34A",
  "#F59E0B",
  "#EF4444",
  "#6366F1",
  "#0D9488",
  "#8B5CF6",
  "#94A3B8",
];

/* =========================================================
   GENERAL HELPERS
========================================================= */

function toNumber(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "bigint"
  ) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  if (
    typeof value === "string"
  ) {
    const normalized =
      value
        .replace(/,/g, "")
        .trim();

    if (!normalized) {
      return 0;
    }

    const parsed =
      Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

/**
 * Rounds monetary values consistently
 * with the accounting/reporting layer.
 */
function roundMoney(
  value: number
): number {
  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}

/**
 * Formats a Date as YYYY-MM-DD using
 * the browser's local calendar.
 *
 * We intentionally do not use toISOString()
 * here because UTC conversion can move a
 * local date across a month boundary.
 */
function formatDateOnly(
  date: Date
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Returns the complete current-month
 * reporting period.
 */
function getCurrentMonthRange(): {
  startDate: string;
  endDate: string;
} {
  const now =
    new Date();

  const startDate =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  const endDate =
    new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );

  return {
    startDate:
      formatDateOnly(
        startDate
      ),

    endDate:
      formatDateOnly(
        endDate
      ),
  };
}

/**
 * Used to detect calendar month changes
 * while the dashboard remains open.
 */
function getCurrentMonthKey(): string {
  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

/**
 * Currency formatting for dashboard
 * presentation.
 */
function formatCurrency(
  value: number
): string {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(
    roundMoney(value)
  );
}

/**
 * Safe JSON request helper.
 *
 * authenticatedFetch remains the authentication
 * and tenant-session boundary. No organizationId
 * is accepted from the dashboard component.
 */
async function apiGet<T>(
  endpoint: string
): Promise<T> {
  const response =
    await authenticatedFetch(
      endpoint,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },

        credentials: "include",

        cache: "no-store",
      }
    );

  let payload:
    | unknown
    | null = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload ===
        "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (
        payload as {
          message?: unknown;
        }
      ).message ===
        "string"
        ? (
            payload as {
              message: string;
            }
          ).message
        : `Request failed with status ${response.status}.`;

    throw new Error(
      message
    );
  }

  return payload as T;
}

/* =========================================================
   ACCOUNTING DATA
========================================================= */

/**
 * Fetches one page of the accounting
 * expense-analysis report.
 */
async function fetchExpensePage(
  startDate: string,
  endDate: string,
  page: number
): Promise<ExpenseAnalysisResponse> {
  const params =
    new URLSearchParams({
      startDate,
      endDate,
      page: String(page),
      limit: String(
        PAGE_SIZE
      ),
    });

  return apiGet<ExpenseAnalysisResponse>(
    `${EXPENSE_ANALYSIS_ENDPOINT}?${params.toString()}`
  );
}

/**
 * Fetches all pages for the current
 * reporting period.
 *
 * This prevents a tenant with more than
 * PAGE_SIZE expense accounts from getting
 * an incomplete dashboard breakdown.
 */
async function fetchAllExpenseAccounts(
  startDate: string,
  endDate: string
): Promise<{
  accounts: ExpenseAccount[];
  totalExpenses: number;
}> {
  const firstPage =
    await fetchExpensePage(
      startDate,
      endDate,
      1
    );

  if (
    !firstPage.success
  ) {
    throw new Error(
      firstPage.message ??
        "Unable to generate expense analysis."
    );
  }

  const accounts: ExpenseAccount[] =
    Array.isArray(
      firstPage.data
    )
      ? [...firstPage.data]
      : [];

  let reportedTotal =
    toNumber(
      firstPage.totals
        ?.expenses
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        toNumber(
          firstPage.pagination
            ?.totalPages
        )
      )
    );

  /*
   * If the backend does not provide totalPages,
   * the first response is still valid and we do
   * not make speculative requests.
   */
  if (
    firstPage.pagination
      ?.totalPages ===
    undefined
  ) {
    return {
      accounts,
      totalExpenses:
        reportedTotal,
    };
  }

  /*
   * Safety boundary against a malformed
   * pagination response causing an endless
   * request loop.
   */
  const pagesToFetch =
    Math.min(
      totalPages,
      MAX_PAGES
    );

  for (
    let page = 2;
    page <= pagesToFetch;
    page += 1
  ) {
    const response =
      await fetchExpensePage(
        startDate,
        endDate,
        page
      );

    if (
      !response.success
    ) {
      throw new Error(
        response.message ??
          `Unable to load expense analysis page ${page}.`
      );
    }

    if (
      Array.isArray(
        response.data
      )
    ) {
      accounts.push(
        ...response.data
      );
    }

    /*
     * The backend's total is authoritative.
     * Keep updating it in case a later page
     * carries the same authoritative value.
     */
    if (
      response.totals
        ?.expenses !==
      undefined
    ) {
      reportedTotal =
        toNumber(
          response.totals
            .expenses
        );
    }
  }

  return {
    accounts,
    totalExpenses:
      reportedTotal,
  };
}

/* =========================================================
   BREAKDOWN CALCULATION
========================================================= */

/**
 * Converts accounting expense accounts into
 * the chart model.
 *
 * Each expense account is treated as a
 * dashboard expense category.
 */
function buildCategoryData(
  accounts: ExpenseAccount[]
): ExpenseCategory[] {
  const categoryTotals =
    new Map<
      string,
      {
        code: string;
        amount: number;
      }
    >();

  for (
    const account of accounts
  ) {
    const amount =
      roundMoney(
        toNumber(
          account.amount
        )
      );

    /*
     * Expense accounts are debit-normal.
     *
     * The accounting endpoint already calculates
     * their net balance as:
     *
     *     debits - credits
     *
     * Positive values therefore represent
     * actual expense exposure for the period.
     */
    if (
      amount <= 0
    ) {
      continue;
    }

    const name =
      account.name
        ?.trim() ||
      "Other Expenses";

    const code =
      account.code
        ?.trim() ||
      "";

    const existing =
      categoryTotals.get(
        name
      );

    if (existing) {
      existing.amount =
        roundMoney(
          existing.amount +
            amount
        );

      /*
       * If several accounts happen to share
       * the same name, retain a useful code
       * when the first record did not have one.
       */
      if (
        !existing.code &&
        code
      ) {
        existing.code =
          code;
      }
    } else {
      categoryTotals.set(
        name,
        {
          code,
          amount,
        }
      );
    }
  }

  const total =
    Array.from(
      categoryTotals.values()
    ).reduce(
      (sum, item) =>
        sum + item.amount,
      0
    );

  if (
    total <= 0
  ) {
    return [];
  }

  return Array.from(
    categoryTotals.entries()
  )
    .map(
      ([name, item]) => ({
        name,

        code:
          item.code,

        amount:
          roundMoney(
            item.amount
          ),

        value:
          (item.amount /
            total) *
          100,
      })
    )
    .sort(
      (a, b) =>
        b.amount -
        a.amount
    );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ExpenseBreakdown() {
  const [
    expenses,
    setExpenses,
  ] =
    useState<ExpenseAccount[]>(
      []
    );

  const [
    reportedTotal,
    setReportedTotal,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    refreshVersion,
    setRefreshVersion,
  ] =
    useState(0);

  /* =======================================================
     LOAD EXPENSE BREAKDOWN
  ======================================================= */

  const loadExpenses =
    useCallback(
      async () => {
        const {
          startDate,
          endDate,
        } =
          getCurrentMonthRange();

        try {
          /*
           * Do not erase previously successful
           * figures during a refresh.
           */
          setRefreshing(
            true
          );

          setError(
            null
          );

          const result =
            await fetchAllExpenseAccounts(
              startDate,
              endDate
            );

          setExpenses(
            result.accounts
          );

          setReportedTotal(
            result.totalExpenses
          );
        } catch (err) {
          /*
           * Preserve the last successful
           * dashboard figures when a refresh
           * fails.
           */
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load expense breakdown."
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      []
    );

  /* =======================================================
     INITIAL LOAD + REFRESH
  ======================================================= */

  useEffect(() => {
    void loadExpenses();
  }, [
    loadExpenses,
    refreshVersion,
  ]);

  /* =======================================================
     REFRESH WHEN TAB BECOMES VISIBLE
  ======================================================= */

  useEffect(() => {
    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          setRefreshVersion(
            (value) =>
              value + 1
          );
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  /* =======================================================
     MONTH ROLLOVER
  ======================================================= */

  useEffect(() => {
    let active = true;

    let currentMonth =
      getCurrentMonthKey();

    /*
     * Check periodically rather than scheduling
     * only one timeout. This means the component
     * continues working across multiple month
     * changes without requiring a remount.
     */
    const interval =
      window.setInterval(
        () => {
          if (!active) {
            return;
          }

          const nextMonth =
            getCurrentMonthKey();

          if (
            nextMonth !==
            currentMonth
          ) {
            currentMonth =
              nextMonth;

            setRefreshVersion(
              (value) =>
                value + 1
            );
          }
        },
        60_000
      );

    return () => {
      active = false;

      window.clearInterval(
        interval
      );
    };
  }, []);

  /* =======================================================
     BUILD CHART DATA
  ======================================================= */

  const data =
    useMemo(
      () =>
        buildCategoryData(
          expenses
        ),
      [expenses]
    );

  /*
   * The accounting endpoint provides the
   * authoritative current-month total.
   *
   * If it is unavailable or zero, calculate
   * the total from the displayed categories.
   */
  const displayedTotal =
    useMemo(() => {
      const calculated =
        data.reduce(
          (total, item) =>
            total +
            item.amount,
          0
        );

      if (
        reportedTotal >
        0
      ) {
        return roundMoney(
          reportedTotal
        );
      }

      return roundMoney(
        calculated
      );
    }, [
      data,
      reportedTotal,
    ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Expense Breakdown
          </h2>

          <p className="text-sm text-[#666B84]">
            Distribution of current-month expenses
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setRefreshVersion(
              (value) =>
                value + 1
            )
          }
          disabled={
            loading ||
            refreshing
          }
          title="Refresh expense breakdown"
          aria-label="Refresh expense breakdown"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E6E7EE] text-[#666B84] transition hover:bg-[#F7F8FA] hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
        </button>
      </div>

      {/* =================================================
          INITIAL LOADING
      ================================================= */}

      {loading ? (
        <div className="flex min-h-[28rem] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-[#666B84]">
            <Loader2
              className="animate-spin"
              size={18}
            />

            Loading expense breakdown...
          </div>
        </div>
      ) : error &&
        data.length ===
          0 ? (
        /* ===============================================
           COMPLETE FAILURE WITH NO PREVIOUS DATA
        =============================================== */

        <div className="flex min-h-[28rem] items-center justify-center">
          <div className="max-w-sm text-center">
            <AlertCircle
              className="mx-auto mb-3 text-red-500"
              size={24}
            />

            <p className="font-medium text-red-700">
              Unable to load expense breakdown
            </p>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setRefreshVersion(
                  (value) =>
                    value + 1
                )
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#20243A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#171A2B]"
            >
              <RefreshCw
                size={15}
              />

              Retry
            </button>
          </div>
        </div>
      ) : data.length ===
        0 ? (
        /* ===============================================
           NO CURRENT-MONTH EXPENSE ACTIVITY
        =============================================== */

        <div className="flex min-h-[28rem] items-center justify-center">
          <div className="text-center">
            <p className="font-medium text-[#20243A]">
              No expenses this month
            </p>

            <p className="mt-1 max-w-md text-sm leading-6 text-[#666B84]">
              Expense categories will appear here
              when expenses are posted to the
              accounting ledger.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* =============================================
             REFRESH WARNING
          ============================================= */}

          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertCircle
                size={15}
                className="mt-0.5 shrink-0"
              />

              <span>
                Dashboard refresh was
                unsuccessful. Showing the last
                successfully loaded expense
                breakdown.
              </span>
            </div>
          ) : null}

          {/* =============================================
             CHART
          ============================================= */}

          <div className="relative h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive
                >
                  {data.map(
                    (
                      item,
                      index
                    ) => (
                      <Cell
                        key={`${item.code}-${item.name}`}
                        fill={
                          COLORS[
                            index %
                              COLORS.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip
                  formatter={(
                    value,
                    name
                  ) => [
                    `${Number(
                      value
                    ).toFixed(1)}%`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius:
                      "10px",
                    border:
                      "1px solid #ECECF3",
                    boxShadow:
                      "0 8px 24px rgba(32,36,58,0.08)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* =========================================
               CENTER TOTAL
            ========================================= */}

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="max-w-[170px] text-center">
                <p className="text-xs text-[#666B84]">
                  Total
                </p>

                <p className="mt-1 truncate text-lg font-bold tabular-nums text-[#20243A]">
                  {formatCurrency(
                    displayedTotal
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* =============================================
             CATEGORY LEGEND
          ============================================= */}

          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {data.map(
              (
                item,
                index
              ) => (
                <div
                  key={`${item.code}-${item.name}`}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          COLORS[
                            index %
                              COLORS.length
                          ],
                      }}
                    />

                    <div className="min-w-0">
                      <span className="block truncate text-sm text-[#666B84]">
                        {item.name}
                      </span>

                      {item.code ? (
                        <span className="block text-[11px] text-[#9A9EB0]">
                          {item.code}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="whitespace-nowrap text-xs tabular-nums text-[#666B84]">
                      {formatCurrency(
                        item.amount
                      )}
                    </span>

                    <span className="min-w-[48px] text-right text-sm font-semibold tabular-nums text-[#20243A]">
                      {item.value.toFixed(
                        1
                      )}
                      %
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}