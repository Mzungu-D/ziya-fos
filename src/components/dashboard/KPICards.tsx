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

interface FinancialSummary {
  totalRevenue?: number | string;
  totalExpenses?: number | string;
  netProfit?: number | string;
  cashBalance?: number | string;

  revenue?: number | string;
  expenses?: number | string;
  profit?: number | string;
  cash?: number | string;

  revenueChange?: number | string;
  expensesChange?: number | string;
  profitChange?: number | string;
  cashChange?: number | string;

  [key: string]: unknown;
}

interface FinancialSummaryResponse {
  success?: boolean;
  message?: string;
  data?: FinancialSummary;
  summary?: FinancialSummary;
  financialSummary?: FinancialSummary;

  totalRevenue?: number | string;
  totalExpenses?: number | string;
  netProfit?: number | string;
  cashBalance?: number | string;

  revenueChange?: number | string;
  expensesChange?: number | string;
  profitChange?: number | string;
  cashChange?: number | string;

  [key: string]: unknown;
}

/* =========================================================
   API
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ?? "";

/*
 * Keep the existing financial-summary endpoint.
 *
 * The important authentication change is that the request
 * now goes through authenticatedFetch(), which obtains the
 * JWT from either localStorage OR sessionStorage.
 */
const FINANCIAL_SUMMARY_ENDPOINT =
  `${API_URL}/api/financial-summary`;

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
      Number(value);

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
  const absolute =
    Math.abs(value);

  return `${absolute.toFixed(1)}%`;
}

function getChangeValue(
  summary: FinancialSummary,
  primaryKey: string,
  fallbackKey?: string
): number {
  return toNumber(
    summary[primaryKey] ??
      (fallbackKey
        ? summary[fallbackKey]
        : 0)
  );
}

function getSummaryData(
  payload: FinancialSummaryResponse
): FinancialSummary {
  if (
    payload.data &&
    typeof payload.data === "object"
  ) {
    return payload.data;
  }

  if (
    payload.summary &&
    typeof payload.summary === "object"
  ) {
    return payload.summary;
  }

  if (
    payload.financialSummary &&
    typeof payload.financialSummary === "object"
  ) {
    return payload.financialSummary;
  }

  return payload;
}

/* =========================================================
   CARD
========================================================= */

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  iconBackground: string;
  iconColor: string;
  positiveIsGood?: boolean;
}

function KPICard({
  title,
  value,
  change,
  icon,
  iconBackground,
  iconColor,
  positiveIsGood = true,
}: KPICardProps) {
  const isPositive =
    change >= 0;

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
              {formatPercentage(change)}
            </span>

            <span className="text-xs text-[#666B84]">
              vs previous period
            </span>
          </div>
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
  const [summary, setSummary] =
    useState<FinancialSummary | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* ---------------------------------------------------------
     LOAD FINANCIAL SUMMARY
  --------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    const loadFinancialSummary =
      async () => {
        try {
          setLoading(true);
          setError("");

          /*
           * IMPORTANT:
           *
           * Do NOT read localStorage directly here.
           *
           * authenticatedFetch() uses getAuthToken(),
           * which checks both localStorage and sessionStorage.
           */
          const response =
            await authenticatedFetch(
              FINANCIAL_SUMMARY_ENDPOINT,
              {
                method: "GET",
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          let payload:
            | FinancialSummaryResponse
            | null = null;

          try {
            payload =
              (await response.json()) as FinancialSummaryResponse;
          } catch {
            payload = null;
          }

          if (!response.ok) {
            throw new Error(
              payload?.message ??
                `Request failed with status ${response.status}.`
            );
          }

          if (
            payload?.success === false
          ) {
            throw new Error(
              payload.message ??
                "Unable to load financial summary."
            );
          }

          if (!mounted) {
            return;
          }

          setSummary(
            getSummaryData(
              payload ?? {}
            )
          );
        } catch (err) {
          if (!mounted) {
            return;
          }

          console.error(
            "FINANCIAL SUMMARY ERROR:",
            err
          );

          setSummary(null);

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load financial summary."
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void loadFinancialSummary();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------------------------------------------------
     LOADING
  --------------------------------------------------------- */

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

  /* ---------------------------------------------------------
     ERROR
  --------------------------------------------------------- */

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

  /* ---------------------------------------------------------
     VALUES
  --------------------------------------------------------- */

  const totalRevenue =
    toNumber(
      summary?.totalRevenue ??
        summary?.revenue
    );

  const totalExpenses =
    toNumber(
      summary?.totalExpenses ??
        summary?.expenses
    );

  const netProfit =
    toNumber(
      summary?.netProfit ??
        summary?.profit
    );

  const cashBalance =
    toNumber(
      summary?.cashBalance ??
        summary?.cash
    );

  const revenueChange =
    getChangeValue(
      summary ?? {},
      "revenueChange"
    );

  const expensesChange =
    getChangeValue(
      summary ?? {},
      "expensesChange"
    );

  const profitChange =
    getChangeValue(
      summary ?? {},
      "profitChange"
    );

  const cashChange =
    getChangeValue(
      summary ?? {},
      "cashChange"
    );

  /* ---------------------------------------------------------
     RENDER
  --------------------------------------------------------- */

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
        icon={
          <Banknote size={22} />
        }
        iconBackground="bg-blue-50"
        iconColor="text-blue-600"
      />
    </div>
  );
}