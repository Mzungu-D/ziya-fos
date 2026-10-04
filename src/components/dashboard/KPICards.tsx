import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  DollarSign,
  TrendingUp,
} from "lucide-react";

import { authenticatedFetch } from "../../lib/auth";

/* =========================================================
   TYPES
========================================================= */

interface FinancialKpiTotals {
  revenue?: number | string;
  expenses?: number | string;
  netProfit?: number | string;
  assets?: number | string;
  liabilities?: number | string;
  equity?: number | string;
}

interface FinancialKpiResponse {
  success?: boolean;
  message?: string;
  totals?: FinancialKpiTotals;
  meta?: {
    organizationId?: string;
    [key: string]: unknown;
  };
  data?: {
    totals?: FinancialKpiTotals;
    meta?: {
      organizationId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CashPositionTotals {
  bankBalance?: number | string;
  mpesaBalance?: number | string;
  totalLiquidity?: number | string;
}

interface CashPositionResponse {
  success?: boolean;
  message?: string;
  totals?: CashPositionTotals;
  meta?: {
    organizationId?: string;
    [key: string]: unknown;
  };
  data?: {
    totals?: CashPositionTotals;
    meta?: {
      organizationId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/* =========================================================
   API
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ?? "";

/*
 * IMPORTANT TENANT ISOLATION RULE
 *
 * Never send organizationId from the browser.
 *
 * The authenticated backend session determines:
 *
 *     req.user.organizationId
 *
 * and the backend must use that value when querying
 * accounts, journal entries, bank accounts and M-Pesa data.
 */
const FINANCIAL_KPI_ENDPOINT =
  `${API_URL}/api/financial-reports/financial-kpis`;

const CASH_POSITION_ENDPOINT =
  `${API_URL}/api/financial-reports/cash-position`;

/* =========================================================
   REFRESH EVENTS
========================================================= */

/*
 * Organization switchers in the application should dispatch:
 *
 * window.dispatchEvent(
 *   new CustomEvent("ziya:organization-changed")
 * );
 *
 * after successfully changing the active tenant/session.
 *
 * We also listen for "storage" because authentication/session
 * state may be changed in another browser context.
 */
const ORGANIZATION_CHANGED_EVENT =
  "ziya:organization-changed";

/* =========================================================
   HELPERS
========================================================= */

function toNumber(
  value: unknown,
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const normalized =
      value
        .replace(/,/g, "")
        .trim();

    const parsed =
      Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatPercentage(
  value: number,
): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

function percentageChange(
  current: number,
  previous: number,
): number {
  /*
   * If the previous period was zero:
   *
   * 0 -> 0      = 0%
   * 0 -> value  = 100%
   *
   * We deliberately avoid Infinity/NaN because those are
   * not meaningful dashboard values.
   */
  if (previous === 0) {
    return current === 0
      ? 0
      : 100;
  }

  return (
    (
      (current - previous) /
      Math.abs(previous)
    ) * 100
  );
}

/* =========================================================
   DATE HELPERS
========================================================= */

function formatDateForApi(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthRange(
  monthOffset: number,
): {
  startDate: string;
  endDate: string;
} {
  const now =
    new Date();

  const start =
    new Date(
      now.getFullYear(),
      now.getMonth() +
        monthOffset,
      1,
    );

  const end =
    new Date(
      now.getFullYear(),
      now.getMonth() +
        monthOffset +
        1,
      0,
    );

  return {
    startDate:
      formatDateForApi(start),

    endDate:
      formatDateForApi(end),
  };
}

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function getKpiTotals(
  payload: FinancialKpiResponse,
): FinancialKpiTotals {
  /*
   * Primary production response:
   *
   * {
   *   success: true,
   *   totals: {...}
   * }
   */

  if (
    payload.totals &&
    typeof payload.totals === "object"
  ) {
    return payload.totals;
  }

  /*
   * Compatibility with a nested response envelope.
   */
  if (
    payload.data?.totals &&
    typeof payload.data.totals === "object"
  ) {
    return payload.data.totals;
  }

  return {};
}

function getCashTotals(
  payload: CashPositionResponse,
): CashPositionTotals {
  if (
    payload.totals &&
    typeof payload.totals === "object"
  ) {
    return payload.totals;
  }

  if (
    payload.data?.totals &&
    typeof payload.data.totals === "object"
  ) {
    return payload.data.totals;
  }

  return {};
}

/* =========================================================
   HTTP RESPONSE HANDLING
========================================================= */

async function parseJson<T>(
  response: Response,
): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getResponseMessage(
  payload:
    | FinancialKpiResponse
    | CashPositionResponse
    | null,
  fallback: string,
): string {
  if (
    payload &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  return fallback;
}

/* =========================================================
   CARD
========================================================= */

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconBackground: string;
  iconColor: string;
  positiveIsGood?: boolean;
}

function KPICard({
  title,
  value,
  change,
  changeLabel =
    "vs previous period",
  icon,
  iconBackground,
  iconColor,
  positiveIsGood = true,
}: KPICardProps) {
  const hasChange =
    typeof change === "number" &&
    Number.isFinite(change);

  const isPositive =
    (change ?? 0) >= 0;

  const changeIsGood =
    positiveIsGood
      ? isPositive
      : !isPositive;

  return (
    <div
      className="
        rounded-2xl
        border
        border-[#ECECF3]
        bg-white
        p-5
        shadow-sm
        transition-shadow
        duration-200
        hover:shadow-md
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#666B84]">
            {title}
          </p>

          <p
            className="
              mt-2
              text-2xl
              font-bold
              tracking-tight
              text-[#20243A]
            "
          >
            {value}
          </p>

          {hasChange ? (
            <div className="mt-2 flex items-center gap-1.5">
              {isPositive ? (
                <ArrowUpRight
                  size={14}
                  className={
                    changeIsGood
                      ? "text-emerald-600"
                      : "text-red-500"
                  }
                />
              ) : (
                <ArrowDownRight
                  size={14}
                  className={
                    changeIsGood
                      ? "text-emerald-600"
                      : "text-red-500"
                  }
                />
              )}

              <span
                className={
                  `text-xs font-medium ${
                    changeIsGood
                      ? "text-emerald-600"
                      : "text-red-500"
                  }`
                }
              >
                {formatPercentage(
                  change ?? 0,
                )}
              </span>

              <span className="text-xs text-[#666B84]">
                {changeLabel}
              </span>
            </div>
          ) : (
            <div className="mt-2">
              <span className="text-xs text-[#666B84]">
                {changeLabel}
              </span>
            </div>
          )}
        </div>

        <div
          className={
            `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBackground} ${iconColor}`
          }
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function KPICards() {
  const [
    currentKpis,
    setCurrentKpis,
  ] =
    useState<FinancialKpiTotals | null>(
      null,
    );

  const [
    previousKpis,
    setPreviousKpis,
  ] =
    useState<FinancialKpiTotals | null>(
      null,
    );

  const [
    cashBalance,
    setCashBalance,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * Every request gets a sequence number.
   *
   * This prevents this race condition:
   *
   * Demo Company request starts
   *        ↓
   * user switches to Afro Marine
   *        ↓
   * Afro Marine request starts
   *        ↓
   * Demo response arrives late
   *        ↓
   * OLD Demo figures overwrite Afro Marine
   *
   * Only the latest request is allowed to update state.
   */
  const requestSequence =
    useRef(0);

  /* =======================================================
     LOAD TENANT-SCOPED FINANCIAL DATA
  ======================================================= */

  const loadFinancialData =
    useCallback(
      async () => {
        const sequence =
          ++requestSequence.current;

        try {
          setLoading(true);
          setError("");

          /*
           * Current calendar month.
           */
          const currentPeriod =
            getMonthRange(0);

          /*
           * Previous calendar month.
           */
          const previousPeriod =
            getMonthRange(-1);

          /*
           * =================================================
           * TENANT ISOLATION
           * =================================================
           *
           * There is intentionally NO organizationId here.
           *
           * The browser cannot select which organization's
           * accounting data these endpoints return.
           *
           * authenticatedFetch() sends the authenticated
           * access token.
           *
           * The server derives:
           *
           *     req.user.organizationId
           *
           * and the financial controllers query only that
           * organization.
           */

          const currentKpiUrl =
            `${FINANCIAL_KPI_ENDPOINT}` +
            `?startDate=${encodeURIComponent(
              currentPeriod.startDate,
            )}` +
            `&endDate=${encodeURIComponent(
              currentPeriod.endDate,
            )}`;

          const previousKpiUrl =
            `${FINANCIAL_KPI_ENDPOINT}` +
            `?startDate=${encodeURIComponent(
              previousPeriod.startDate,
            )}` +
            `&endDate=${encodeURIComponent(
              previousPeriod.endDate,
            )}`;

          /*
           * All three requests use the same authenticated
           * tenant session.
           */
          const [
            currentResponse,
            previousResponse,
            cashResponse,
          ] =
            await Promise.all([
              authenticatedFetch(
                currentKpiUrl,
                {
                  method: "GET",
                  headers: {
                    Accept:
                      "application/json",
                  },
                },
              ),

              authenticatedFetch(
                previousKpiUrl,
                {
                  method: "GET",
                  headers: {
                    Accept:
                      "application/json",
                  },
                },
              ),

              authenticatedFetch(
                CASH_POSITION_ENDPOINT,
                {
                  method: "GET",
                  headers: {
                    Accept:
                      "application/json",
                  },
                },
              ),
            ]);

          /*
           * =================================================
           * PARSE RESPONSES
           * =================================================
           */

          const [
            currentPayload,
            previousPayload,
            cashPayload,
          ] =
            await Promise.all([
              parseJson<FinancialKpiResponse>(
                currentResponse,
              ),

              parseJson<FinancialKpiResponse>(
                previousResponse,
              ),

              parseJson<CashPositionResponse>(
                cashResponse,
              ),
            ]);

          /*
           * =================================================
           * VALIDATE HTTP RESPONSES
           * =================================================
           */

          if (
            !currentResponse.ok
          ) {
            throw new Error(
              getResponseMessage(
                currentPayload,
                `Current financial KPI request failed with status ${currentResponse.status}.`,
              ),
            );
          }

          if (
            !previousResponse.ok
          ) {
            throw new Error(
              getResponseMessage(
                previousPayload,
                `Previous financial KPI request failed with status ${previousResponse.status}.`,
              ),
            );
          }

          if (
            !cashResponse.ok
          ) {
            throw new Error(
              getResponseMessage(
                cashPayload,
                `Cash position request failed with status ${cashResponse.status}.`,
              ),
            );
          }

          /*
           * =================================================
           * VALIDATE APPLICATION RESPONSES
           * =================================================
           */

          if (
            currentPayload?.success === false
          ) {
            throw new Error(
              currentPayload.message ??
                "Unable to load current financial KPIs.",
            );
          }

          if (
            previousPayload?.success === false
          ) {
            throw new Error(
              previousPayload.message ??
                "Unable to load previous financial KPIs.",
            );
          }

          if (
            cashPayload?.success === false
          ) {
            throw new Error(
              cashPayload.message ??
                "Unable to load cash position.",
            );
          }

          /*
           * =================================================
           * STALE REQUEST PROTECTION
           * =================================================
           *
           * If the user switched tenant while these requests
           * were running, this response is no longer allowed
           * to update the dashboard.
           */
          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          /*
           * =================================================
           * STORE TENANT-SCOPED RESULTS
           * =================================================
           */

          const nextCurrentKpis =
            getKpiTotals(
              currentPayload ?? {},
            );

          const nextPreviousKpis =
            getKpiTotals(
              previousPayload ?? {},
            );

          const cashTotals =
            getCashTotals(
              cashPayload ?? {},
            );

          /*
           * Cash Balance is authoritative from the Cash
           * Position endpoint.
           *
           * It is NOT derived from:
           *
           *     revenue - expenses
           *
           * because that would not represent actual liquidity.
           */
          const nextCashBalance =
            toNumber(
              cashTotals.totalLiquidity,
            );

          setCurrentKpis(
            nextCurrentKpis,
          );

          setPreviousKpis(
            nextPreviousKpis,
          );

          setCashBalance(
            nextCashBalance,
          );
        } catch (err) {
          /*
           * Do not let an old request display an error after
           * the user has already switched organizations.
           */
          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          console.error(
            "DASHBOARD KPI ERROR:",
            err,
          );

          setCurrentKpis(null);
          setPreviousKpis(null);
          setCashBalance(0);

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load financial dashboard data.",
          );
        } finally {
          if (
            sequence ===
            requestSequence.current
          ) {
            setLoading(false);
          }
        }
      },
      [],
    );

  /* =======================================================
     INITIAL LOAD + ORGANIZATION SWITCH REFRESH
  ======================================================= */

  useEffect(() => {
    /*
     * Initial dashboard load.
     */
    void loadFinancialData();

    /*
     * =====================================================
     * ORGANIZATION SWITCH
     * =====================================================
     *
     * The organization switcher must dispatch:
     *
     * window.dispatchEvent(
     *   new CustomEvent(
     *     "ziya:organization-changed"
     *   )
     * );
     *
     * after the active tenant/session has successfully
     * changed.
     */
    const handleOrganizationChanged =
      () => {
        void loadFinancialData();
      };

    window.addEventListener(
      ORGANIZATION_CHANGED_EVENT,
      handleOrganizationChanged,
    );

    /*
     * =====================================================
     * STORAGE EVENT
     * =====================================================
     *
     * Useful when authentication state changes in another
     * browser tab/window.
     */
    const handleStorage =
      () => {
        void loadFinancialData();
      };

    window.addEventListener(
      "storage",
      handleStorage,
    );

    /*
     * =====================================================
     * VISIBILITY CHANGE
     * =====================================================
     *
     * When the user returns to the dashboard after changing
     * organization/session state elsewhere, refresh the data.
     */
    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadFinancialData();
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      /*
       * Invalidate any request that is still in flight.
       */
      requestSequence.current += 1;

      window.removeEventListener(
        ORGANIZATION_CHANGED_EVENT,
        handleOrganizationChanged,
      );

      window.removeEventListener(
        "storage",
        handleStorage,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [
    loadFinancialData,
  ]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(
          (item) => (
            <div
              key={item}
              className="
                h-32
                animate-pulse
                rounded-2xl
                border
                border-[#ECECF3]
                bg-white
              "
            />
          ),
        )}
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-red-200
          bg-red-50
          p-5
        "
      >
        <p className="font-semibold text-red-700">
          Unable to load financial summary
        </p>

        <p className="mt-1 text-sm text-red-600">
          {error}
        </p>
      </div>
    );
  }

  /* =========================================================
     CURRENT PERIOD VALUES
  ========================================================= */

  const totalRevenue =
    toNumber(
      currentKpis?.revenue,
    );

  const totalExpenses =
    toNumber(
      currentKpis?.expenses,
    );

  const netProfit =
    toNumber(
      currentKpis?.netProfit,
    );

  /* =========================================================
     PREVIOUS PERIOD VALUES
  ========================================================= */

  const previousRevenue =
    toNumber(
      previousKpis?.revenue,
    );

  const previousExpenses =
    toNumber(
      previousKpis?.expenses,
    );

  const previousNetProfit =
    toNumber(
      previousKpis?.netProfit,
    );

  /* =========================================================
     PERIOD CHANGES
  ========================================================= */

  const revenueChange =
    percentageChange(
      totalRevenue,
      previousRevenue,
    );

  const expensesChange =
    percentageChange(
      totalExpenses,
      previousExpenses,
    );

  const profitChange =
    percentageChange(
      netProfit,
      previousNetProfit,
    );

  /*
   * Cash is a point-in-time balance.
   *
   * We deliberately do not manufacture a monthly percentage
   * comparison because the cash endpoint provides the current
   * liquidity position, not a comparable historical month-end
   * value.
   */
  const cashChange:
    | undefined =
    undefined;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

      {/* =====================================================
          TOTAL REVENUE
      ====================================================== */}

      <KPICard
        title="Total Revenue"
        value={formatCurrency(
          totalRevenue,
        )}
        change={revenueChange}
        icon={
          <TrendingUp
            size={22}
          />
        }
        iconBackground="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      {/* =====================================================
          TOTAL EXPENSES
      ====================================================== */}

      <KPICard
        title="Total Expenses"
        value={formatCurrency(
          totalExpenses,
        )}
        change={expensesChange}
        icon={
          <DollarSign
            size={22}
          />
        }
        iconBackground="bg-red-50"
        iconColor="text-red-600"
        positiveIsGood={false}
      />

      {/* =====================================================
          NET PROFIT
      ====================================================== */}

      <KPICard
        title="Net Profit"
        value={formatCurrency(
          netProfit,
        )}
        change={profitChange}
        icon={
          <TrendingUp
            size={22}
          />
        }
        iconBackground="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      {/* =====================================================
          CASH BALANCE
      ====================================================== */}

      <KPICard
        title="Cash Balance"
        value={formatCurrency(
          cashBalance,
        )}
        change={cashChange}
        changeLabel="Current available liquidity"
        icon={
          <Banknote
            size={22}
          />
        }
        iconBackground="bg-blue-50"
        iconColor="text-blue-600"
      />

    </div>
  );
}