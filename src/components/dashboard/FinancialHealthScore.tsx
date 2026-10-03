import {
  CircleHelp,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { authenticatedFetch } from "../../lib/auth";

interface IncomeStatementResponse {
  success: boolean;
  totals?: {
    revenue?: number | string;
    netProfit?: number | string;
  };
  message?: string;
}

interface BalanceSheetResponse {
  success: boolean;
  totals?: {
    assets?: number | string;
    liabilities?: number | string;
    equity?: number | string;
    liabilitiesAndEquity?: number | string;
    difference?: number | string;
    balanced?: boolean;
  };
  message?: string;
}

interface CashFlowResponse {
  success: boolean;
  totals?: {
    netIncreaseDecrease?: number | string;
    openingCashBalance?: number | string;
    closingCashBalance?: number | string;
  };
  message?: string;
}

const WEIGHTS = {
  profitability: 35,
  financialPosition: 25,
  cashFlow: 20,
  accountingIntegrity: 20,
} as const;

const ACCOUNTING_TOLERANCE = 0.01;

async function apiGet<T>(
  endpoint: string
): Promise<T> {
  const response =
    await authenticatedFetch(
      endpoint,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      }
    );

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

function toNumber(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(
      value.replace(/,/g, "").trim()
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function calculateProfitability(
  revenue: number,
  netProfit: number
): {
  score: number;
  available: boolean;
} {
  if (revenue <= 0) {
    return {
      score: 0,
      available: false,
    };
  }

  const margin =
    netProfit / revenue;

  if (margin >= 0.25) {
    return {
      score: WEIGHTS.profitability,
      available: true,
    };
  }

  if (margin >= 0.15) {
    return {
      score: 29,
      available: true,
    };
  }

  if (margin >= 0.10) {
    return {
      score: 25,
      available: true,
    };
  }

  if (margin >= 0.05) {
    return {
      score: 21,
      available: true,
    };
  }

  if (margin >= 0) {
    return {
      score: 16,
      available: true,
    };
  }

  if (margin >= -0.05) {
    return {
      score: 9,
      available: true,
    };
  }

  if (margin >= -0.15) {
    return {
      score: 4,
      available: true,
    };
  }

  return {
    score: 0,
    available: true,
  };
}

function calculateFinancialPosition(
  assets: number,
  liabilities: number,
  equity: number
): {
  score: number;
  available: boolean;
} {
  if (
    assets <= 0 &&
    liabilities === 0 &&
    equity === 0
  ) {
    return {
      score: 0,
      available: false,
    };
  }

  if (assets <= 0) {
    return {
      score: 0,
      available: false,
    };
  }

  const liabilityRatio =
    Math.max(0, liabilities) /
    assets;

  if (liabilityRatio <= 0.30) {
    return {
      score: WEIGHTS.financialPosition,
      available: true,
    };
  }

  if (liabilityRatio <= 0.50) {
    return {
      score: 22,
      available: true,
    };
  }

  if (liabilityRatio <= 0.70) {
    return {
      score: 18,
      available: true,
    };
  }

  if (liabilityRatio <= 1.00) {
    return {
      score: 12,
      available: true,
    };
  }

  if (liabilityRatio <= 1.25) {
    return {
      score: 6,
      available: true,
    };
  }

  return {
    score: 0,
    available: true,
  };
}

function calculateCashFlow(
  cashFlow: CashFlowResponse
): {
  score: number;
  available: boolean;
} {
  const totals =
    cashFlow.totals;

  if (!totals) {
    return {
      score: 0,
      available: false,
    };
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

  /*
   * A zero-value cash-flow response is not treated
   * as meaningful financial activity.
   */
  if (
    Math.abs(opening) === 0 &&
    Math.abs(closing) === 0 &&
    Math.abs(netMovement) === 0
  ) {
    return {
      score: 0,
      available: false,
    };
  }

  if (
    netMovement > 0 &&
    closing >= 0
  ) {
    return {
      score: WEIGHTS.cashFlow,
      available: true,
    };
  }

  if (
    netMovement >= 0 &&
    closing >= 0
  ) {
    return {
      score: 16,
      available: true,
    };
  }

  if (
    netMovement < 0 &&
    closing >= 0
  ) {
    return {
      score: 10,
      available: true,
    };
  }

  if (
    netMovement < 0 &&
    closing < 0
  ) {
    return {
      score: 2,
      available: true,
    };
  }

  return {
    score: 6,
    available: true,
  };
}

function calculateAccountingIntegrity(
  balance: BalanceSheetResponse
): {
  score: number;
  available: boolean;
} {
  const totals =
    balance.totals;

  if (!totals) {
    return {
      score: 0,
      available: false,
    };
  }

  const assets =
    toNumber(totals.assets);

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
   * Do not award accounting-integrity points
   * to an empty tenant with zero balances.
   */
  if (
    assets === 0 &&
    liabilitiesAndEquity === 0 &&
    difference === 0
  ) {
    return {
      score: 0,
      available: false,
    };
  }

  const balanced =
    totals.balanced === true ||
    difference <=
      ACCOUNTING_TOLERANCE;

  return {
    score: balanced
      ? WEIGHTS.accountingIntegrity
      : 0,
    available: true,
  };
}

function calculateFinancialHealth(
  income: IncomeStatementResponse,
  balance: BalanceSheetResponse,
  cashFlow: CashFlowResponse
): number | null {
  const revenue =
    toNumber(
      income.totals?.revenue
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

  const profitability =
    calculateProfitability(
      revenue,
      netProfit
    );

  const financialPosition =
    calculateFinancialPosition(
      assets,
      liabilities,
      equity
    );

  const cashFlowScore =
    calculateCashFlow(
      cashFlow
    );

  const accountingIntegrity =
    calculateAccountingIntegrity(
      balance
    );

  const metrics = [
    {
      score: profitability.score,
      maximum: WEIGHTS.profitability,
      available: profitability.available,
    },
    {
      score: financialPosition.score,
      maximum: WEIGHTS.financialPosition,
      available: financialPosition.available,
    },
    {
      score: cashFlowScore.score,
      maximum: WEIGHTS.cashFlow,
      available: cashFlowScore.available,
    },
    {
      score: accountingIntegrity.score,
      maximum: WEIGHTS.accountingIntegrity,
      available: accountingIntegrity.available,
    },
  ].filter(
    (metric) => metric.available
  );

  /*
   * A percentage is shown only when there is enough
   * financial information to make the result meaningful.
   */
  if (metrics.length < 2) {
    return null;
  }

  const maximum =
    metrics.reduce(
      (total, metric) =>
        total + metric.maximum,
      0
    );

  const score =
    metrics.reduce(
      (total, metric) =>
        total + metric.score,
      0
    );

  if (maximum <= 0) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (score / maximum) * 100
      )
    )
  );
}

export default function FinancialHealthScore() {
  const [
    percentage,
    setPercentage,
  ] = useState<number | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(false);

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

        if (
          !income.success ||
          !balance.success ||
          !cashFlow.success
        ) {
          throw new Error(
            "Financial health data could not be loaded."
          );
        }

        const score =
          calculateFinancialHealth(
            income,
            balance,
            cashFlow
          );

        if (!cancelled) {
          setPercentage(score);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setPercentage(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const progress =
    percentage === null
      ? 0
      : Math.max(
          0,
          Math.min(100, percentage)
        );

  const colour =
    percentage === null
      ? {
          text: "text-slate-400",
          stroke: "stroke-slate-200",
        }
      : percentage >= 70
        ? {
            text: "text-emerald-600",
            stroke: "stroke-emerald-500",
          }
        : percentage >= 40
          ? {
              text: "text-amber-600",
              stroke: "stroke-amber-500",
            }
          : {
              text: "text-red-600",
              stroke: "stroke-red-500",
            };

  const radius = 54;
  const circumference =
    2 * Math.PI * radius;

  const dashOffset =
    circumference -
    (progress / 100) *
      circumference;

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-8">
        <div className="flex items-center gap-2">
          <ShieldCheck
            size={19}
            strokeWidth={2.25}
            className="text-emerald-600"
          />

          <h2 className="text-base font-bold tracking-[-0.01em] text-slate-900 sm:text-lg">
            Financial Health
          </h2>

          <CircleHelp
            size={14}
            className="text-slate-400"
          />
        </div>

        {loading ? (
          <div className="mt-7 flex h-44 w-44 items-center justify-center rounded-full border-[10px] border-slate-100">
            <Loader2
              size={25}
              className="animate-spin text-slate-300"
            />
          </div>
        ) : error ? (
          <div className="mt-8 text-center">
            <div className="text-5xl font-extrabold tracking-[-0.05em] text-slate-300">
              —
            </div>
          </div>
        ) : (
          <div className="mt-7">
            <div className="relative h-44 w-44">
              <svg
                viewBox="0 0 128 128"
                className="h-full w-full -rotate-90"
                aria-label={
                  percentage === null
                    ? "Financial health unavailable"
                    : `Financial health ${percentage}%`
                }
                role="img"
              >
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  strokeWidth="10"
                  className="stroke-slate-100"
                />

                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className={`${colour.stroke} transition-all duration-700 ease-out`}
                  strokeDasharray={
                    circumference
                  }
                  strokeDashoffset={
                    dashOffset
                  }
                />
              </svg>

              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={`text-5xl font-extrabold leading-none tracking-[-0.05em] ${colour.text}`}
                >
                  {percentage === null
                    ? "—"
                    : `${percentage}%`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}