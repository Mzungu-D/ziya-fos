import { useEffect, useState } from "react";
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
}

/* =========================================================
   API
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ?? "";

const FINANCIAL_KPI_ENDPOINT =
  `${API_URL}/api/financial-reports/financial-kpis`;

const CASH_POSITION_ENDPOINT =
  `${API_URL}/api/financial-reports/cash-position`;

/* =========================================================
   HELPERS
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
    typeof value === "string"
  ) {
    const parsed =
      Number(
        value.replace(/,/g, "").trim()
      );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

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
  ).format(value);
}

function formatPercentage(
  value: number
): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

function percentageChange(
  current: number,
  previous: number
): number {
  if (previous === 0) {
    return current === 0
      ? 0
      : 100;
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  );
}

/* =========================================================
   DATE HELPERS
========================================================= */

function formatDateForApi(
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

function getMonthRange(
  monthOffset: number
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
      1
    );

  const end =
    new Date(
      now.getFullYear(),
      now.getMonth() +
        monthOffset +
        1,
      0
    );

  return {
    startDate:
      formatDateForApi(start),

    endDate:
      formatDateForApi(end),
  };
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
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#666B84]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
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
                className={`text-xs font-medium ${
                  changeIsGood
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {formatPercentage(
                  change ?? 0
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
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBackground} ${iconColor}`}
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
      null
    );

  const [
    previousKpis,
    setPreviousKpis,
  ] =
    useState<FinancialKpiTotals | null>(
      null
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

  /* =======================================================
     LOAD TENANT-SCOPED FINANCIAL DATA
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadFinancialData =
      async () => {
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
           * IMPORTANT TENANT ISOLATION RULE
           *
           * organizationId is NEVER supplied by the frontend.
           *
           * authenticatedFetch() sends the authenticated JWT.
           *
           * The backend derives:
           *
           * req.user.organizationId
           *
           * and scopes the financial queries to that
           * organization.
           */

          const currentKpiUrl =
            `${FINANCIAL_KPI_ENDPOINT}` +
            `?startDate=${encodeURIComponent(
              currentPeriod.startDate
            )}` +
            `&endDate=${encodeURIComponent(
              currentPeriod.endDate
            )}`;

          const previousKpiUrl =
            `${FINANCIAL_KPI_ENDPOINT}` +
            `?startDate=${encodeURIComponent(
              previousPeriod.startDate
            )}` +
            `&endDate=${encodeURIComponent(
              previousPeriod.endDate
            )}`;

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
                }
              ),

              authenticatedFetch(
                previousKpiUrl,
                {
                  method: "GET",
                  headers: {
                    Accept:
                      "application/json",
                  },
                }
              ),

              authenticatedFetch(
                CASH_POSITION_ENDPOINT,
                {
                  method: "GET",
                  headers: {
                    Accept:
                      "application/json",
                  },
                }
              ),
            ]);

          /* =================================================
             PARSE RESPONSES
          ================================================= */

          let currentPayload:
            | FinancialKpiResponse
            | null = null;

          let previousPayload:
            | FinancialKpiResponse
            | null = null;

          let cashPayload:
            | CashPositionResponse
            | null = null;

          try {
            currentPayload =
              (await currentResponse.json()) as FinancialKpiResponse;
          } catch {
            currentPayload = null;
          }

          try {
            previousPayload =
              (await previousResponse.json()) as FinancialKpiResponse;
          } catch {
            previousPayload = null;
          }

          try {
            cashPayload =
              (await cashResponse.json()) as CashPositionResponse;
          } catch {
            cashPayload = null;
          }

          /* =================================================
             VALIDATE RESPONSES
          ================================================= */

          if (
            !currentResponse.ok
          ) {
            throw new Error(
              currentPayload?.message ??
                `Current financial KPI request failed with status ${currentResponse.status}.`
            );
          }

          if (
            !previousResponse.ok
          ) {
            throw new Error(
              previousPayload?.message ??
                `Previous financial KPI request failed with status ${previousResponse.status}.`
            );
          }

          if (
            !cashResponse.ok
          ) {
            throw new Error(
              cashPayload?.message ??
                `Cash position request failed with status ${cashResponse.status}.`
            );
          }

          if (
            currentPayload?.success ===
            false
          ) {
            throw new Error(
              currentPayload.message ??
                "Unable to load current financial KPIs."
            );
          }

          if (
            previousPayload?.success ===
            false
          ) {
            throw new Error(
              previousPayload.message ??
                "Unable to load previous financial KPIs."
            );
          }

          if (
            cashPayload?.success ===
            false
          ) {
            throw new Error(
              cashPayload.message ??
                "Unable to load cash position."
            );
          }

          if (!mounted) {
            return;
          }

          /* =================================================
             STORE TENANT-SCOPED RESULTS
          ================================================= */

          setCurrentKpis(
            currentPayload?.totals ??
              {}
          );

          setPreviousKpis(
            previousPayload?.totals ??
              {}
          );

          /*
           * Cash Balance comes from the authoritative
           * Cash Position report.
           *
           * It is NOT calculated from revenue/expenses.
           */
          setCashBalance(
            toNumber(
              cashPayload?.totals
                ?.totalLiquidity
            )
          );
        } catch (err) {
          if (!mounted) {
            return;
          }

          console.error(
            "DASHBOARD KPI ERROR:",
            err
          );

          setCurrentKpis(null);
          setPreviousKpis(null);
          setCashBalance(0);

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load financial dashboard data."
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void loadFinancialData();

    return () => {
      mounted = false;
    };
  }, []);

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
              className="h-32 animate-pulse rounded-2xl border border-[#ECECF3] bg-white"
            />
          )
        )}
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
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
      currentKpis?.revenue
    );

  const totalExpenses =
    toNumber(
      currentKpis?.expenses
    );

  const netProfit =
    toNumber(
      currentKpis?.netProfit
    );

  /* =========================================================
     PREVIOUS PERIOD VALUES
  ========================================================= */

  const previousRevenue =
    toNumber(
      previousKpis?.revenue
    );

  const previousExpenses =
    toNumber(
      previousKpis?.expenses
    );

  const previousNetProfit =
    toNumber(
      previousKpis?.netProfit
    );

  /* =========================================================
     PERIOD CHANGES
  ========================================================= */

  const revenueChange =
    percentageChange(
      totalRevenue,
      previousRevenue
    );

  const expensesChange =
    percentageChange(
      totalExpenses,
      previousExpenses
    );

  const profitChange =
    percentageChange(
      netProfit,
      previousNetProfit
    );

  /*
   * Cash is a point-in-time balance.
   *
   * We do not manufacture a percentage comparison
   * from unrelated monthly P&L data.
   *
   * The Cash Balance card therefore displays the
   * current authoritative liquidity position.
   */
  const cashChange:
    | undefined = undefined;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        title="Total Revenue"
        value={formatCurrency(
          totalRevenue
        )}
        change={revenueChange}
        icon={
          <TrendingUp size={22} />
        }
        iconBackground="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      <KPICard
        title="Total Expenses"
        value={formatCurrency(
          totalExpenses
        )}
        change={expensesChange}
        icon={
          <DollarSign size={22} />
        }
        iconBackground="bg-red-50"
        iconColor="text-red-600"
        positiveIsGood={false}
      />

      <KPICard
        title="Net Profit"
        value={formatCurrency(
          netProfit
        )}
        change={profitChange}
        icon={
          <TrendingUp size={22} />
        }
        iconBackground="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      <KPICard
        title="Cash Balance"
        value={formatCurrency(
          cashBalance
        )}
        change={cashChange}
        changeLabel="Current available liquidity"
        icon={
          <Banknote size={22} />
        }
        iconBackground="bg-blue-50"
        iconColor="text-blue-600"
      />
    </div>
  );
}