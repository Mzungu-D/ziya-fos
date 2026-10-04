import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
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

function getCurrentMonthKey(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
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
  monthlyValue?: string;
  monthlyLabel?: string;
  icon: React.ReactNode;
  iconBackground: string;
  iconColor: string;
}

function KPICard({
  title,
  value,
  monthlyValue,
  monthlyLabel = "This month",
  icon,
  iconBackground,
  iconColor,
}: KPICardProps) {
  return (
    <div
      className="
        flex min-h-[156px] flex-col
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
              whitespace-nowrap
              text-[clamp(1.15rem,1.8vw,1.5rem)]
              font-bold
              leading-tight
              tracking-tight
              tabular-nums
              text-[#20243A]
            "
          >
            {value}
          </p>

          {monthlyValue !== undefined ? (
            <div className="mt-3">
              <span className="text-xs text-[#666B84]">
                {monthlyLabel}
              </span>

              <p className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums text-[#20243A]">
                {monthlyValue}
              </p>
            </div>
          ) : null}
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
    totalKpis,
    setTotalKpis,
  ] =
    useState<FinancialKpiTotals | null>(
      null,
    );

  const [
    monthlyKpis,
    setMonthlyKpis,
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
           *
           * The dashboard displays BOTH:
           *
           * 1. Cumulative totals for the tenant's complete
           *    posted/approved accounting history.
           * 2. Current calendar-month figures.
           */
          const currentPeriod =
            getMonthRange(0);

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

          const monthlyKpiUrl =
            `${FINANCIAL_KPI_ENDPOINT}` +
            `?startDate=${encodeURIComponent(
              currentPeriod.startDate,
            )}` +
            `&endDate=${encodeURIComponent(
              currentPeriod.endDate,
            )}`;

          /*
           * The cumulative request intentionally has NO
           * startDate/endDate. The backend therefore returns
           * the complete accounting history for the active
           * authenticated tenant.
           */
          const [
            totalResponse,
            monthlyResponse,
            cashResponse,
          ] =
            await Promise.all([
              authenticatedFetch(
                FINANCIAL_KPI_ENDPOINT,
                {
                  method: "GET",
                  headers: {
                    Accept:
                      "application/json",
                  },
                  cache: "no-store",
                },
              ),

              authenticatedFetch(
                monthlyKpiUrl,
                {
                  method: "GET",
                  headers: {
                    Accept:
                      "application/json",
                  },
                  cache: "no-store",
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
                  cache: "no-store",
                },
              ),
            ]);

          const [
            totalPayload,
            monthlyPayload,
            cashPayload,
          ] =
            await Promise.all([
              parseJson<FinancialKpiResponse>(
                totalResponse,
              ),

              parseJson<FinancialKpiResponse>(
                monthlyResponse,
              ),

              parseJson<CashPositionResponse>(
                cashResponse,
              ),
            ]);

          if (
            !totalResponse.ok
          ) {
            throw new Error(
              getResponseMessage(
                totalPayload,
                `Total financial KPI request failed with status ${totalResponse.status}.`,
              ),
            );
          }

          if (
            !monthlyResponse.ok
          ) {
            throw new Error(
              getResponseMessage(
                monthlyPayload,
                `Monthly financial KPI request failed with status ${monthlyResponse.status}.`,
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

          if (
            totalPayload?.success === false
          ) {
            throw new Error(
              totalPayload.message ??
                "Unable to load total financial KPIs.",
            );
          }

          if (
            monthlyPayload?.success === false
          ) {
            throw new Error(
              monthlyPayload.message ??
                "Unable to load monthly financial KPIs.",
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

          const nextTotalKpis =
            getKpiTotals(
              totalPayload ?? {},
            );

          const nextMonthlyKpis =
            getKpiTotals(
              monthlyPayload ?? {},
            );

          const cashTotals =
            getCashTotals(
              cashPayload ?? {},
            );

          const nextCashBalance =
            toNumber(
              cashTotals.totalLiquidity,
            );

          setTotalKpis(
            nextTotalKpis,
          );

          setMonthlyKpis(
            nextMonthlyKpis,
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

          /*
           * Preserve the last successfully loaded values while a
           * refresh fails. The dashboard must never blank existing
           * tenant figures because of a transient refresh error.
           */
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

    /*
     * =====================================================
     * AUTOMATIC MONTH ROLLOVER
     * =====================================================
     *
     * Monthly figures are calculated from the current calendar
     * month whenever data is loaded. This timer also refreshes
     * an open dashboard when the calendar month changes.
     */
    const initialMonthKey =
      getCurrentMonthKey();

    const monthRolloverTimer =
      window.setInterval(() => {
        if (
          getCurrentMonthKey() !==
          initialMonthKey
        ) {
          void loadFinancialData();
        }
      }, 60_000);

    return () => {
      /*
       * Invalidate any request that is still in flight.
       */
      requestSequence.current += 1;

      window.clearInterval(
        monthRolloverTimer,
      );

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

  const hasLoadedData =
    totalKpis !== null ||
    monthlyKpis !== null;

  /* =========================================================
     INITIAL LOADING
  ========================================================= */

  /*
   * Only show skeletons during the first load. Once valid figures
   * have been displayed, later tenant/session/month refreshes keep
   * those figures visible until the new response succeeds.
   */
  if (loading && !hasLoadedData) {
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
     FIRST-LOAD ERROR
  ========================================================= */

  if (
    error &&
    !hasLoadedData
  ) {
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

        <button
          type="button"
          onClick={() => {
            void loadFinancialData();
          }}
          className="
            mt-4
            rounded-lg
            bg-[#20243A]
            px-4
            py-2
            text-sm
            font-semibold
            text-white
            transition-opacity
            hover:opacity-90
          "
        >
          Retry
        </button>
      </div>
    );
  }

  /* =========================================================
     DASHBOARD VALUES
  ========================================================== */

  const totalRevenue =
    toNumber(
      totalKpis?.revenue,
    );

  const totalExpenses =
    toNumber(
      totalKpis?.expenses,
    );

  const totalNetProfit =
    toNumber(
      totalKpis?.netProfit,
    );

  const monthlyRevenue =
    toNumber(
      monthlyKpis?.revenue,
    );

  const monthlyExpenses =
    toNumber(
      monthlyKpis?.expenses,
    );

  const monthlyNetProfit =
    toNumber(
      monthlyKpis?.netProfit,
    );

  /* =========================================================
     RENDER
  ========================================================== */

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-busy={loading}
    >

      <KPICard
        title="Total Revenue"
        value={formatCurrency(
          totalRevenue,
        )}
        monthlyValue={formatCurrency(
          monthlyRevenue,
        )}
        monthlyLabel="This month"
        icon={
          <TrendingUp
            size={22}
          />
        }
        iconBackground="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      <KPICard
        title="Total Expenses"
        value={formatCurrency(
          totalExpenses,
        )}
        monthlyValue={formatCurrency(
          monthlyExpenses,
        )}
        monthlyLabel="This month"
        icon={
          <DollarSign
            size={22}
          />
        }
        iconBackground="bg-red-50"
        iconColor="text-red-600"
      />

      <KPICard
        title="Net Profit"
        value={formatCurrency(
          totalNetProfit,
        )}
        monthlyValue={formatCurrency(
          monthlyNetProfit,
        )}
        monthlyLabel="This month"
        icon={
          <TrendingUp
            size={22}
          />
        }
        iconBackground="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      <KPICard
        title="Cash Balance"
        value={formatCurrency(
          cashBalance,
        )}
        monthlyLabel="Current available liquidity"
        icon={
          <Banknote
            size={22}
          />
        }
        iconBackground="bg-blue-50"
        iconColor="text-blue-600"
      />

      {error ? (
        <div
          className="
            col-span-1
            flex items-center justify-between gap-3
            rounded-xl
            border border-amber-200
            bg-amber-50
            px-4
            py-2.5
            text-sm
            sm:col-span-2
            xl:col-span-4
          "
        >
          <p className="min-w-0 text-amber-800">
            <span className="font-semibold">
              Dashboard refresh delayed.
            </span>{" "}
            {error}
          </p>

          <button
            type="button"
            onClick={() => {
              void loadFinancialData();
            }}
            className="
              shrink-0
              rounded-lg
              border
              border-amber-300
              bg-white
              px-3
              py-1.5
              text-xs
              font-semibold
              text-amber-900
              transition-colors
              hover:bg-amber-100
            "
          >
            Refresh
          </button>
        </div>
      ) : null}

    </div>
  );
}
