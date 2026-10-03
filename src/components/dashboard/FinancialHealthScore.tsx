import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { authenticatedFetch } from "../../lib/auth";

/* =========================================================
   API TYPES
========================================================= */

interface IncomeStatementResponse {
  success: boolean;

  totals?: {
    revenue?: number | string;
    expenses?: number | string;
    netProfit?: number | string;
    profitMargin?: number | string;
  };

  message?: string;
}

interface BalanceSheetResponse {
  success: boolean;

  totals?: {
    assets?: number | string;
    liabilities?: number | string;
    equity?: number | string;
    retainedEarnings?: number | string;
    liabilitiesAndEquity?: number | string;
    difference?: number | string;
    balanced?: boolean;
  };

  message?: string;
}

interface CashFlowResponse {
  success: boolean;

  totals?: {
    operating?: number | string;
    investing?: number | string;
    financing?: number | string;
    netIncreaseDecrease?: number | string;
    openingCashBalance?: number | string;
    closingCashBalance?: number | string;
    calculatedClosingCashBalance?: number | string;
    reconciliationDifference?: number | string;
    reconciled?: boolean;
  };

  cashAccounts?: Array<{
    id: string;
    code: string;
    name: string;
  }>;

  message?: string;
}

/* =========================================================
   HEALTH SCORE TYPES
========================================================= */

type HealthStatus =
  | "STRONG"
  | "STABLE"
  | "WATCH"
  | "ATTENTION"
  | "INSUFFICIENT_DATA";

interface HealthMetric {
  key:
    | "profitability"
    | "financialPosition"
    | "cashFlow"
    | "accountingIntegrity";

  label: string;

  shortLabel: string;

  score: number;

  maximum: number;

  available: boolean;

  status: HealthStatus;

  detail: string;
}

interface HealthData {
  score: number | null;

  label: string;

  status: HealthStatus;

  revenue: number;

  expenses: number;

  netProfit: number;

  profitMargin: number | null;

  assets: number;

  liabilities: number;

  equity: number;

  liabilityRatio: number | null;

  netCashFlow: number;

  openingCashBalance: number;

  closingCashBalance: number;

  accountingDifference: number;

  balanced: boolean;

  metrics: HealthMetric[];

  availableMetrics: number;

  totalMetrics: number;
}

/* =========================================================
   CONSTANTS
========================================================= */

/*
 * These weights represent the dashboard's internal
 * management indicator. They are not an IFRS or statutory
 * accounting measurement.
 *
 * Profitability:
 * 35 points
 *
 * Financial position:
 * 25 points
 *
 * Cash flow:
 * 20 points
 *
 * Accounting integrity:
 * 20 points
 *
 * Total:
 * 100 points
 */
const WEIGHTS = {
  profitability: 35,
  financialPosition: 25,
  cashFlow: 20,
  accountingIntegrity: 20,
} as const;

const ACCOUNTING_TOLERANCE = 0.01;

/* =========================================================
   AUTHENTICATED API
========================================================= */

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
      }
    );

  let payload: unknown = null;

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
      typeof payload.message ===
        "string"
        ? payload.message
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

/* =========================================================
   SAFE NUMBER CONVERSION
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
    const normalized =
      value
        .replace(/,/g, "")
        .trim();

    if (!normalized) {
      return 0;
    }

    const parsed =
      Number(normalized);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return 0;
}


/* =========================================================
   DATA AVAILABILITY
========================================================= */



function hasCashFlowData(
  cashFlow: CashFlowResponse
): boolean {
  const totals =
    cashFlow.totals;

  if (!totals) {
    return false;
  }

  const opening =
    toNumber(
      totals.openingCashBalance
    );

  const closing =
    toNumber(
      totals.closingCashBalance
    );

  const netMovement =
    toNumber(
      totals.netIncreaseDecrease
    );

  const hasCashAccounts =
    Array.isArray(
      cashFlow.cashAccounts
    ) &&
    cashFlow.cashAccounts.length >
      0;

  return (
    Math.abs(opening) > 0 ||
    Math.abs(closing) > 0 ||
    Math.abs(netMovement) > 0 ||
    hasCashAccounts
  );
}

/* =========================================================
   METRIC STATUS
========================================================= */

function getMetricStatus(
  score: number,
  maximum: number
): HealthStatus {
  if (maximum <= 0) {
    return "INSUFFICIENT_DATA";
  }

  const percentage =
    (score / maximum) * 100;

  if (percentage >= 80) {
    return "STRONG";
  }

  if (percentage >= 60) {
    return "STABLE";
  }

  if (percentage >= 40) {
    return "WATCH";
  }

  return "ATTENTION";
}

/* =========================================================
   PROFITABILITY SCORE
========================================================= */

function calculateProfitabilityScore(
  revenue: number,
  netProfit: number
): {
  score: number;
  available: boolean;
  detail: string;
  margin: number | null;
} {
  if (
    revenue <= 0 &&
    netProfit === 0
  ) {
    return {
      score: 0,
      available: false,
      detail:
        "No revenue or profit activity is available for this assessment.",
      margin: null,
    };
  }

  /*
   * Revenue must be positive to calculate a
   * meaningful profit margin.
   */
  if (revenue <= 0) {
    return {
      score: 0,
      available: false,
      detail:
        "Revenue must be greater than zero before profitability can be assessed.",
      margin: null,
    };
  }

  const margin =
    netProfit / revenue;

  let score = 0;

  if (margin >= 0.25) {
    score = WEIGHTS.profitability;
  } else if (margin >= 0.15) {
    score = 29;
  } else if (margin >= 0.10) {
    score = 25;
  } else if (margin >= 0.05) {
    score = 21;
  } else if (margin >= 0) {
    score = 16;
  } else if (margin >= -0.05) {
    score = 9;
  } else if (margin >= -0.15) {
    score = 4;
  } else {
    score = 0;
  }

  const marginPercentage =
    margin * 100;

  const detail =
    netProfit >= 0
      ? `Net profit margin is ${marginPercentage.toFixed(
          1
        )}%.`
      : `Net loss margin is ${Math.abs(
          marginPercentage
        ).toFixed(1)}%.`;

  return {
    score,
    available: true,
    detail,
    margin,
  };
}

/* =========================================================
   FINANCIAL POSITION SCORE
========================================================= */

function calculateFinancialPositionScore(
  assets: number,
  liabilities: number,
  equity: number
): {
  score: number;
  available: boolean;
  detail: string;
  liabilityRatio: number | null;
} {
  if (
    assets <= 0 &&
    liabilities === 0 &&
    equity === 0
  ) {
    return {
      score: 0,
      available: false,
      detail:
        "No balance-sheet position is available for this assessment.",
      liabilityRatio: null,
    };
  }

  if (assets <= 0) {
    return {
      score: 0,
      available: false,
      detail:
        "Total assets must be greater than zero before financial position can be assessed.",
      liabilityRatio: null,
    };
  }

  const liabilityRatio =
    Math.max(
      0,
      liabilities
    ) / assets;

  let score = 0;

  /*
   * Lower liabilities relative to assets
   * produce a stronger financial-position
   * indicator.
   */
  if (liabilityRatio <= 0.30) {
    score =
      WEIGHTS.financialPosition;
  } else if (
    liabilityRatio <= 0.50
  ) {
    score = 22;
  } else if (
    liabilityRatio <= 0.70
  ) {
    score = 18;
  } else if (
    liabilityRatio <= 1.00
  ) {
    score = 12;
  } else if (
    liabilityRatio <= 1.25
  ) {
    score = 6;
  } else {
    score = 0;
  }

  const ratioPercentage =
    liabilityRatio * 100;

  const detail =
    `Liabilities represent ${ratioPercentage.toFixed(
      1
    )}% of total assets.`;

  return {
    score,
    available: true,
    detail,
    liabilityRatio,
  };
}

/* =========================================================
   CASH FLOW SCORE
========================================================= */

function calculateCashFlowScore(
  cashFlow: CashFlowResponse
): {
  score: number;
  available: boolean;
  detail: string;
} {
  if (
    !hasCashFlowData(
      cashFlow
    )
  ) {
    return {
      score: 0,
      available: false,
      detail:
        "No cash-flow activity or cash-account balance is available for this assessment.",
    };
  }

  const totals =
    cashFlow.totals;

  if (!totals) {
    return {
      score: 0,
      available: false,
      detail:
        "Cash-flow totals are unavailable.",
    };
  }

  const netCashFlow =
    toNumber(
      totals.netIncreaseDecrease
    );

  const closingCash =
    toNumber(
      totals.closingCashBalance
    );

  const openingCash =
    toNumber(
      totals.openingCashBalance
    );

  let score = 0;

  /*
   * A positive cash movement is a stronger
   * dashboard signal than a negative movement.
   *
   * We also consider whether the resulting
   * closing cash position is non-negative.
   */
  if (
    netCashFlow > 0 &&
    closingCash >= 0
  ) {
    score =
      WEIGHTS.cashFlow;
  } else if (
    netCashFlow >= 0 &&
    closingCash >= 0
  ) {
    score = 16;
  } else if (
    netCashFlow < 0 &&
    closingCash >= 0
  ) {
    score = 10;
  } else if (
    netCashFlow < 0 &&
    closingCash < 0
  ) {
    score = 2;
  } else {
    score = 6;
  }

  let detail =
    "Cash-flow position is stable.";

  if (
    netCashFlow > 0
  ) {
    detail =
      `Net cash increased by ${formatCurrency(
        netCashFlow
      )}.`;
  } else if (
    netCashFlow < 0
  ) {
    detail =
      `Net cash decreased by ${formatCurrency(
        Math.abs(
          netCashFlow
        )
      )}.`;
  } else {
    detail =
      "Net cash movement is currently zero.";
  }

  if (
    openingCash === 0 &&
    closingCash === 0
  ) {
    detail =
      "Cash accounts are present, but no cash balance movement is currently available.";
  }

  return {
    score,
    available: true,
    detail,
  };
}

/* =========================================================
   ACCOUNTING INTEGRITY SCORE
========================================================= */

function calculateAccountingIntegrityScore(
  balance: BalanceSheetResponse
): {
  score: number;
  available: boolean;
  detail: string;
} {
  const totals =
    balance.totals;

  if (!totals) {
    return {
      score: 0,
      available: false,
      detail:
        "Balance-sheet integrity cannot be assessed because the balance-sheet totals are unavailable.",
    };
  }

  const assets =
    toNumber(
      totals.assets
    );

  const liabilitiesAndEquity =
    toNumber(
      totals.liabilitiesAndEquity
    );

  const difference =
    Math.abs(
      toNumber(
        totals.difference
      )
    );

  /*
   * If there is genuinely no balance-sheet
   * data, do not classify it as a failed
   * accounting control.
   */
  if (
    assets === 0 &&
    liabilitiesAndEquity === 0 &&
    difference === 0 &&
    totals.balanced !== true
  ) {
    return {
      score: 0,
      available: false,
      detail:
        "There is not enough balance-sheet data to assess accounting integrity.",
    };
  }

  const isBalanced =
    totals.balanced === true ||
    difference <=
      ACCOUNTING_TOLERANCE;

  if (isBalanced) {
    return {
      score:
        WEIGHTS.accountingIntegrity,
      available: true,
      detail:
        "The balance sheet is balanced within the configured accounting tolerance.",
    };
  }

  /*
   * A non-zero difference is an accounting
   * control exception. It should materially
   * reduce this component.
   */
  return {
    score: 0,
    available: true,
    detail:
      `The balance sheet has an accounting difference of ${formatCurrency(
        difference
      )}.`,
  };
}

/* =========================================================
   HEALTH SCORE ENGINE
========================================================= */

function calculateHealthScore(
  income: IncomeStatementResponse,
  balance: BalanceSheetResponse,
  cashFlow: CashFlowResponse
): HealthData {
  const revenue =
    toNumber(
      income.totals?.revenue
    );

  const expenses =
    toNumber(
      income.totals?.expenses
    );

  const netProfit =
    toNumber(
      income.totals?.netProfit
    );

  const assets =
    toNumber(
      balance.totals?.assets
    );

  const liabilities =
    toNumber(
      balance.totals?.liabilities
    );

  const equity =
    toNumber(
      balance.totals?.equity
    );

  const accountingDifference =
    Math.abs(
      toNumber(
        balance.totals?.difference
      )
    );

  const balanced =
    balance.totals?.balanced ===
    true ||
    accountingDifference <=
      ACCOUNTING_TOLERANCE;

  const cashTotals =
    cashFlow.totals;

  const netCashFlow =
    toNumber(
      cashTotals?.netIncreaseDecrease
    );

  const openingCashBalance =
    toNumber(
      cashTotals?.openingCashBalance
    );

  const closingCashBalance =
    toNumber(
      cashTotals?.closingCashBalance
    );

  const profitability =
    calculateProfitabilityScore(
      revenue,
      netProfit
    );

  const financialPosition =
    calculateFinancialPositionScore(
      assets,
      liabilities,
      equity
    );

  const cashFlowScore =
    calculateCashFlowScore(
      cashFlow
    );

  const accountingIntegrity =
    calculateAccountingIntegrityScore(
      balance
    );

  const rawMetrics: HealthMetric[] = [
    {
      key: "profitability",
      label: "Profitability",
      shortLabel: "Profit",
      score:
        profitability.score,
      maximum:
        WEIGHTS.profitability,
      available:
        profitability.available,
      status:
        profitability.available
          ? getMetricStatus(
              profitability.score,
              WEIGHTS.profitability
            )
          : "INSUFFICIENT_DATA",
      detail:
        profitability.detail,
    },

    {
      key: "financialPosition",
      label: "Financial Position",
      shortLabel: "Position",
      score:
        financialPosition.score,
      maximum:
        WEIGHTS.financialPosition,
      available:
        financialPosition.available,
      status:
        financialPosition.available
          ? getMetricStatus(
              financialPosition.score,
              WEIGHTS.financialPosition
            )
          : "INSUFFICIENT_DATA",
      detail:
        financialPosition.detail,
    },

    {
      key: "cashFlow",
      label: "Cash Flow",
      shortLabel: "Cash Flow",
      score:
        cashFlowScore.score,
      maximum:
        WEIGHTS.cashFlow,
      available:
        cashFlowScore.available,
      status:
        cashFlowScore.available
          ? getMetricStatus(
              cashFlowScore.score,
              WEIGHTS.cashFlow
            )
          : "INSUFFICIENT_DATA",
      detail:
        cashFlowScore.detail,
    },

    {
      key: "accountingIntegrity",
      label: "Accounting Integrity",
      shortLabel: "Controls",
      score:
        accountingIntegrity.score,
      maximum:
        WEIGHTS.accountingIntegrity,
      available:
        accountingIntegrity.available,
      status:
        accountingIntegrity.available
          ? getMetricStatus(
              accountingIntegrity.score,
              WEIGHTS.accountingIntegrity
            )
          : "INSUFFICIENT_DATA",
      detail:
        accountingIntegrity.detail,
    },
  ];

  const availableMetrics =
    rawMetrics.filter(
      (metric) =>
        metric.available
    );

  const availableWeight =
    availableMetrics.reduce(
      (
        total,
        metric
      ) =>
        total +
        metric.maximum,
      0
    );

  const weightedScore =
    availableMetrics.reduce(
      (
        total,
        metric
      ) =>
        total +
        metric.score,
      0
    );

  const score =
    availableWeight > 0
      ? Math.round(
          (weightedScore /
            availableWeight) *
            100
        )
      : null;

  let label =
    "Insufficient Data";

  let status:
    | HealthStatus =
    "INSUFFICIENT_DATA";

  if (
    score !== null
  ) {
    if (score >= 80) {
      label =
        "Strong Financial Health";
      status = "STRONG";
    } else if (
      score >= 65
    ) {
      label =
        "Stable Financial Health";
      status = "STABLE";
    } else if (
      score >= 45
    ) {
      label =
        "Financial Health to Watch";
      status = "WATCH";
    } else {
      label =
        "Financial Health Needs Attention";
      status = "ATTENTION";
    }
  }

  return {
    score,
    label,
    status,

    revenue,
    expenses,
    netProfit,

    profitMargin:
      profitability.margin,

    assets,
    liabilities,
    equity,

    liabilityRatio:
      financialPosition.liabilityRatio,

    netCashFlow,
    openingCashBalance,
    closingCashBalance,

    accountingDifference,
    balanced,

    metrics: rawMetrics,

    availableMetrics:
      availableMetrics.length,

    totalMetrics:
      rawMetrics.length,
  };
}

/* =========================================================
   FORMATTING
========================================================= */

function formatCurrency(
  value: number
): string {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatPercentage(
  value: number | null
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${(
    value * 100
  ).toFixed(1)}%`;
}

function getStatusClasses(
  status: HealthStatus
): {
  badge: string;
  icon: string;
  bar: string;
} {
  switch (status) {
    case "STRONG":
      return {
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon:
          "text-emerald-600",
        bar:
          "bg-emerald-500",
      };

    case "STABLE":
      return {
        badge:
          "border-blue-200 bg-blue-50 text-blue-700",
        icon:
          "text-blue-600",
        bar:
          "bg-blue-500",
      };

    case "WATCH":
      return {
        badge:
          "border-amber-200 bg-amber-50 text-amber-700",
        icon:
          "text-amber-600",
        bar:
          "bg-amber-500",
      };

    case "ATTENTION":
      return {
        badge:
          "border-red-200 bg-red-50 text-red-700",
        icon:
          "text-red-600",
        bar:
          "bg-red-500",
      };

    default:
      return {
        badge:
          "border-slate-200 bg-slate-50 text-slate-600",
        icon:
          "text-slate-500",
        bar:
          "bg-slate-400",
      };
  }
}

function getStatusLabel(
  status: HealthStatus
): string {
  switch (status) {
    case "STRONG":
      return "Strong";

    case "STABLE":
      return "Stable";

    case "WATCH":
      return "Watch";

    case "ATTENTION":
      return "Attention";

    default:
      return "Insufficient data";
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancialHealthScore() {
  const [
    data,
    setData,
  ] = useState<
    HealthData | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    const loadFinancialHealth =
      async () => {
        try {
          setLoading(true);
          setError(null);

          /*
           * All three requests are authenticated.
           *
           * The backend determines the tenant from
           * the authenticated session. The frontend
           * never sends an organizationId.
           */
          const [
            income,
            balance,
            cashFlow,
          ] = await Promise.all([
            apiGet<IncomeStatementResponse>(
              "/api/income-statement"
            ),

            apiGet<BalanceSheetResponse>(
              "/api/balance-sheet"
            ),

            apiGet<CashFlowResponse>(
              "/api/cash-flow?page=1&limit=100"
            ),
          ]);

          if (cancelled) {
            return;
          }

          if (
            !income.success
          ) {
            throw new Error(
              income.message ??
                "Unable to load income statement."
            );
          }

          if (
            !balance.success
          ) {
            throw new Error(
              balance.message ??
                "Unable to load balance sheet."
            );
          }

          if (
            !cashFlow.success
          ) {
            throw new Error(
              cashFlow.message ??
                "Unable to load cash-flow statement."
            );
          }

          const health =
            calculateHealthScore(
              income,
              balance,
              cashFlow
            );

          if (cancelled) {
            return;
          }

          setData(health);
        } catch (err) {
          if (cancelled) {
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "Unable to calculate financial health."
          );

          setData(null);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void loadFinancialHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  const primaryStatus =
    useMemo(() => {
      if (!data) {
        return "INSUFFICIENT_DATA";
      }

      return data.status;
    }, [data]);

  const primaryStatusClasses =
    getStatusClasses(
      primaryStatus
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="border-b border-[#EEF0F4] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <ShieldCheck
                className="text-emerald-600"
                size={22}
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-bold tracking-[-0.01em] text-[#20243A]">
                  Financial Health
                </h2>

                <CircleHelp
                  size={15}
                  className="shrink-0 text-[#9AA0B2]"
                />
              </div>

              <p className="mt-0.5 text-sm text-[#70768A]">
                Management health indicator
              </p>
            </div>
          </div>

          {loading && (
            <Loader2
              className="mt-1 shrink-0 animate-spin text-[#8A90A3]"
              size={18}
            />
          )}
        </div>
      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error ? (
        <div className="px-6 py-10">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <AlertCircle
                className="text-red-500"
                size={22}
              />
            </div>

            <p className="mt-4 font-semibold text-[#20243A]">
              Unable to calculate financial health
            </p>

            <p className="mt-1 text-sm leading-6 text-[#70768A]">
              {error}
            </p>
          </div>
        </div>
      ) : loading ? (
        /* =================================================
           LOADING
        ================================================= */

        <div className="px-6 py-8">
          <div className="animate-pulse">
            <div className="flex flex-col items-center">
              <div className="h-16 w-28 rounded-xl bg-[#F1F3F7]" />

              <div className="mt-3 h-4 w-40 rounded bg-[#F1F3F7]" />
            </div>

            <div className="mt-8 h-2.5 w-full rounded-full bg-[#F1F3F7]" />

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="h-20 rounded-xl bg-[#F8F9FB]" />
              <div className="h-20 rounded-xl bg-[#F8F9FB]" />
              <div className="h-20 rounded-xl bg-[#F8F9FB]" />
              <div className="h-20 rounded-xl bg-[#F8F9FB]" />
            </div>
          </div>
        </div>
      ) : data ? (
        /* =================================================
           CONTENT
        ================================================= */

        <div className="p-6">
          {/* =============================================
              SCORE SUMMARY
          ============================================= */}

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${primaryStatusClasses.badge}`}
                >
                  {data.status ===
                  "STRONG" ? (
                    <CheckCircle2
                      size={19}
                    />
                  ) : data.status ===
                    "STABLE" ? (
                    <TrendingUp
                      size={19}
                    />
                  ) : data.status ===
                    "WATCH" ? (
                    <TrendingDown
                      size={19}
                    />
                  ) : (
                    <AlertCircle
                      size={19}
                    />
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A90A3]">
                    Current assessment
                  </p>

                  <p className="mt-0.5 font-semibold text-[#20243A]">
                    {data.label}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-end gap-2">
                <span
                  className={`text-5xl font-bold tracking-[-0.04em] ${
                    data.score === null
                      ? "text-[#9AA0B2]"
                      : data.score >=
                          80
                        ? "text-emerald-600"
                        : data.score >=
                            65
                          ? "text-blue-600"
                          : data.score >=
                              45
                            ? "text-amber-500"
                            : "text-red-500"
                  }`}
                >
                  {data.score ===
                  null
                    ? "—"
                    : data.score}
                </span>

                {data.score !==
                  null && (
                  <span className="mb-1.5 text-sm font-medium text-[#8A90A3]">
                    / 100
                  </span>
                )}
              </div>

              <p className="mt-2 max-w-md text-sm leading-6 text-[#70768A]">
                {data.score ===
                null
                  ? "There is not enough posted financial data to calculate a meaningful health indicator yet."
                  : `${data.availableMetrics} of ${data.totalMetrics} financial health dimensions are currently available.`}
              </p>
            </div>

            {/* =========================================
                KEY FINANCIAL SNAPSHOT
            ========================================= */}

            <div className="grid w-full shrink-0 grid-cols-2 gap-3 sm:w-[280px]">
              <div className="rounded-xl border border-[#EEF0F4] bg-[#FAFBFC] p-3.5">
                <p className="text-xs font-medium text-[#8A90A3]">
                  Revenue
                </p>

                <p className="mt-1 truncate text-sm font-bold text-[#20243A]">
                  {formatCurrency(
                    data.revenue
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-[#EEF0F4] bg-[#FAFBFC] p-3.5">
                <p className="text-xs font-medium text-[#8A90A3]">
                  Net Profit
                </p>

                <p
                  className={`mt-1 truncate text-sm font-bold ${
                    data.netProfit >=
                    0
                      ? "text-emerald-600"
                      : "text-red-500"
                  }`}
                >
                  {formatCurrency(
                    data.netProfit
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-[#EEF0F4] bg-[#FAFBFC] p-3.5">
                <p className="text-xs font-medium text-[#8A90A3]">
                  Total Assets
                </p>

                <p className="mt-1 truncate text-sm font-bold text-[#20243A]">
                  {formatCurrency(
                    data.assets
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-[#EEF0F4] bg-[#FAFBFC] p-3.5">
                <p className="text-xs font-medium text-[#8A90A3]">
                  Closing Cash
                </p>

                <p
                  className={`mt-1 truncate text-sm font-bold ${
                    data.closingCashBalance >=
                    0
                      ? "text-[#20243A]"
                      : "text-red-500"
                  }`}
                >
                  {formatCurrency(
                    data.closingCashBalance
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* =============================================
              SCORE BAR
          ============================================= */}

          {data.score !==
            null && (
            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A90A3]">
                  Overall health
                </span>

                <span className="text-xs font-semibold text-[#70768A]">
                  {data.score}/100
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF0F4]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    data.score >= 80
                      ? "bg-emerald-500"
                      : data.score >=
                          65
                        ? "bg-blue-500"
                        : data.score >=
                            45
                          ? "bg-amber-500"
                          : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        data.score
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* =============================================
              HEALTH DIMENSIONS
          ============================================= */}

          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#20243A]">
                  Health dimensions
                </h3>

                <p className="mt-0.5 text-xs text-[#8A90A3]">
                  Based on posted accounting data
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {data.metrics.map(
                (metric) => {
                  const classes =
                    getStatusClasses(
                      metric.status
                    );

                  const percentage =
                    metric.available
                      ? Math.round(
                          (metric.score /
                            metric.maximum) *
                            100
                        )
                      : 0;

                  return (
                    <div
                      key={
                        metric.key
                      }
                      className="rounded-xl border border-[#EEF0F4] bg-white p-4 transition-colors hover:border-[#DDE1E9]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#20243A]">
                            {
                              metric.label
                            }
                          </p>

                          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-[#7B8193]">
                            {
                              metric.detail
                            }
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${classes.badge}`}
                        >
                          {getStatusLabel(
                            metric.status
                          )}
                        </span>
                      </div>

                      {metric.available ? (
                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#70768A]">
                              {
                                metric.score
                              }
                              /
                              {
                                metric.maximum
                              }
                            </span>

                            <span className="text-[11px] font-medium text-[#9AA0B2]">
                              {
                                percentage
                              }
                              %
                            </span>
                          </div>

                          <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F1F5]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${classes.bar}`}
                              style={{
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#9AA0B2]">
                          <CircleHelp
                            size={13}
                          />
                          Data not yet available
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* =============================================
              FINANCIAL DETAIL FOOTER
          ============================================= */}

          <div className="mt-6 grid gap-3 border-t border-[#EEF0F4] pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-[#8A90A3]">
                Profit margin
              </p>

              <p className="mt-1 text-sm font-bold text-[#20243A]">
                {formatPercentage(
                  data.profitMargin
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-[#8A90A3]">
                Liability / assets
              </p>

              <p className="mt-1 text-sm font-bold text-[#20243A]">
                {formatPercentage(
                  data.liabilityRatio
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-[#8A90A3]">
                Balance sheet
              </p>

              <div className="mt-1 flex items-center gap-1.5">
                {data.balanced ? (
                  <>
                    <CheckCircle2
                      size={15}
                      className="text-emerald-600"
                    />

                    <span className="text-sm font-bold text-emerald-600">
                      Balanced
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle
                      size={15}
                      className="text-red-500"
                    />

                    <span className="text-sm font-bold text-red-500">
                      Difference{" "}
                      {formatCurrency(
                        data.accountingDifference
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* =============================================
              DISCLAIMER / METHODOLOGY
          ============================================= */}

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#F8F9FB] px-3.5 py-3">
            <CircleHelp
              size={15}
              className="mt-0.5 shrink-0 text-[#8A90A3]"
            />

            <p className="text-[11px] leading-5 text-[#7B8193]">
              This dashboard score is an internal
              management indicator calculated from
              available posted accounting data. It is
              not a statutory financial ratio, credit
              rating, audit opinion, or IFRS measurement.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}