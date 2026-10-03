import {
  AlertCircle,
  Bot,
  CircleHelp,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { authenticatedFetch } from "../../lib/auth";

interface IncomeStatementResponse {
  success: boolean;
  totals?: {
    revenue?: number | string;
    expenses?: number | string;
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
  };
  message?: string;
}

interface CashFlowResponse {
  success: boolean;
  totals?: {
    operating?: number | string;
    netIncreaseDecrease?: number | string;
    closingCashBalance?: number | string;
  };
  message?: string;
}

interface FinancialSnapshot {
  revenue: number;
  expenses: number;
  netProfit: number;
  assets: number;
  liabilities: number;
  equity: number;
  operatingCashFlow: number;
  netCashMovement: number;
  closingCash: number;
}

type InsightTone =
  | "positive"
  | "attention"
  | "neutral";

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

function formatCompactCurrency(
  value: number
): string {
  const absolute =
    Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `KES ${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (absolute >= 1_000_000) {
    return `KES ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000) {
    return `KES ${(value / 1_000).toFixed(1)}K`;
  }

  return formatCurrency(value);
}

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

function buildInsight(
  snapshot: FinancialSnapshot
): {
  title: string;
  message: string;
  tone: InsightTone;
} {
  const {
    revenue,
    expenses,
    netProfit,
    assets,
    liabilities,
    operatingCashFlow,
    closingCash,
  } = snapshot;

  const hasIncome =
    revenue > 0 ||
    expenses > 0 ||
    netProfit !== 0;

  const hasBalanceSheet =
    assets > 0 ||
    liabilities !== 0;

  const hasCash =
    closingCash !== 0 ||
    operatingCashFlow !== 0;

  if (!hasIncome && !hasBalanceSheet && !hasCash) {
    return {
      title: "Getting to know your finances",
      message:
        "Posted financial activity is not yet sufficient to generate a meaningful insight.",
      tone: "neutral",
    };
  }

  if (
    revenue > 0 &&
    netProfit < 0
  ) {
    const loss =
      Math.abs(netProfit);

    return {
      title: "Profitability needs attention",
      message:
        `The organization has recorded ${formatCompactCurrency(
          loss
        )} of net loss against ${formatCompactCurrency(
          revenue
        )} of revenue in the current reporting data.`,
      tone: "attention",
    };
  }

  if (
    revenue > 0 &&
    netProfit > 0
  ) {
    const margin =
      (netProfit / revenue) * 100;

    return {
      title: "Positive profitability",
      message:
        `Recorded revenue is ${formatCompactCurrency(
          revenue
        )}, with net profit of ${formatCompactCurrency(
          netProfit
        )}. Current net margin is ${margin.toFixed(
          1
        )}%.`,
      tone: "positive",
    };
  }

  if (
    hasCash &&
    closingCash < 0
  ) {
    return {
      title: "Cash position needs attention",
      message:
        `The recorded closing cash position is ${formatCompactCurrency(
          Math.abs(closingCash)
        )} below zero. Review cash movements and outstanding obligations.`,
      tone: "attention",
    };
  }

  if (
    hasBalanceSheet &&
    assets > 0 &&
    liabilities > assets
  ) {
    return {
      title: "Liability exposure is elevated",
      message:
        `Recorded liabilities of ${formatCompactCurrency(
          liabilities
        )} exceed total assets of ${formatCompactCurrency(
          assets
        )}. Review the underlying balances and obligations.`,
      tone: "attention",
    };
  }

  if (
    hasCash &&
    operatingCashFlow > 0
  ) {
    return {
      title: "Operating cash generation is positive",
      message:
        `Operating activities have generated ${formatCompactCurrency(
          operatingCashFlow
        )} of recorded cash flow, while closing cash is ${formatCompactCurrency(
          closingCash
        )}.`,
      tone: "positive",
    };
  }

  return {
    title: "Financial position available",
    message:
      "The latest posted accounting data is available for review across income, balance-sheet and cash-flow activity.",
    tone: "neutral",
  };
}

function getToneClasses(
  tone: InsightTone
): {
  icon: string;
  badge: string;
  accent: string;
} {
  switch (tone) {
    case "positive":
      return {
        icon:
          "bg-emerald-50 text-emerald-600 ring-emerald-100",
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        accent:
          "bg-emerald-500",
      };

    case "attention":
      return {
        icon:
          "bg-amber-50 text-amber-600 ring-amber-100",
        badge:
          "border-amber-200 bg-amber-50 text-amber-700",
        accent:
          "bg-amber-500",
      };

    default:
      return {
        icon:
          "bg-slate-50 text-slate-600 ring-slate-200",
        badge:
          "border-slate-200 bg-slate-50 text-slate-600",
        accent:
          "bg-slate-400",
      };
  }
}

export default function AIFinancialAssistant() {
  const [
    insight,
    setInsight,
  ] = useState<{
    title: string;
    message: string;
    tone: InsightTone;
  } | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(false);

  const loadInsight =
    useCallback(async () => {
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
            "Financial insight data could not be loaded."
          );
        }

        const snapshot: FinancialSnapshot = {
          revenue: toNumber(
            income.totals?.revenue
          ),
          expenses: toNumber(
            income.totals?.expenses
          ),
          netProfit: toNumber(
            income.totals?.netProfit
          ),
          assets: toNumber(
            balance.totals?.assets
          ),
          liabilities: toNumber(
            balance.totals?.liabilities
          ),
          equity: toNumber(
            balance.totals?.equity
          ),
          operatingCashFlow:
            toNumber(
              cashFlow.totals?.operating
            ),
          netCashMovement:
            toNumber(
              cashFlow.totals
                ?.netIncreaseDecrease
            ),
          closingCash:
            toNumber(
              cashFlow.totals
                ?.closingCashBalance
            ),
        };

        setInsight(
          buildInsight(snapshot)
        );
      } catch {
        setError(true);
        setInsight(null);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadInsight();
  }, [loadInsight]);

  const tone =
    insight
      ? getToneClasses(
          insight.tone
        )
      : getToneClasses("neutral");

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
      {/* Header */}
      <header className="flex min-w-0 items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-100">
            <Bot
              size={22}
              strokeWidth={2}
              className="text-cyan-700"
            />
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-bold tracking-[-0.01em] text-slate-900 sm:text-lg">
                AI Financial Assistant
              </h2>

              <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-violet-700">
                AI
              </span>
            </div>

            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Smart insights from your financial data
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadInsight();
          }}
          disabled={loading}
          aria-label="Refresh financial insight"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2
              size={16}
              className="animate-spin"
            />
          ) : (
            <RefreshCw size={16} />
          )}
        </button>
      </header>

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div
            className={`absolute left-0 top-0 h-full w-1 ${tone.accent}`}
            aria-hidden="true"
          />

          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${tone.icon}`}
            >
              <Sparkles
                size={18}
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                  Today's insight
                </p>

                {!loading &&
                  insight && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${tone.badge}`}
                    >
                      Based on posted data
                    </span>
                  )}
              </div>

              {loading ? (
                <div className="mt-3 space-y-2">
                  <div className="h-4 w-44 max-w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                </div>
              ) : error ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <AlertCircle
                    size={16}
                    className="shrink-0 text-amber-500"
                  />
                  <span>
                    Financial insight is temporarily unavailable.
                  </span>
                </div>
              ) : insight ? (
                <>
                  <h3 className="mt-2 text-base font-bold leading-6 text-slate-900 sm:text-lg">
                    {insight.title}
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                    {insight.message}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-slate-400">
          <CircleHelp
            size={13}
            className="mt-0.5 shrink-0"
          />
          <span>
            Insights are generated from the
            organization's authenticated posted
            accounting data.
          </span>
        </div>
      </div>
    </section>
  );
}
