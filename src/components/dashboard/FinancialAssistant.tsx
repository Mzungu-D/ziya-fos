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

interface Insight {
  title: string;
  message: string;
  tone: InsightTone;
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatCompactCurrency(
  value: number
): string {
  const absoluteValue =
    Math.abs(value);

  if (
    absoluteValue >=
    1_000_000_000
  ) {
    return `KES ${(
      value / 1_000_000_000
    ).toFixed(1)}B`;
  }

  if (
    absoluteValue >=
    1_000_000
  ) {
    return `KES ${(
      value / 1_000_000
    ).toFixed(1)}M`;
  }

  if (
    absoluteValue >=
    1_000
  ) {
    return `KES ${(
      value / 1_000
    ).toFixed(1)}K`;
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
          Accept:
            "application/json",
        },
        credentials: "include",
      }
    );

  let payload: unknown =
    null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}.`;

    if (
      typeof payload ===
        "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message ===
        "string"
    ) {
      message =
        payload.message;
    }

    throw new Error(message);
  }

  return payload as T;
}

function getToneClasses(
  tone: InsightTone
) {
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

function buildInsight(
  snapshot: FinancialSnapshot
): Insight {
  const {
    revenue,
    netProfit,
    assets,
    liabilities,
    operatingCashFlow,
    closingCash,
  } = snapshot;

  const hasIncomeData =
    revenue !== 0 ||
    netProfit !== 0;

  const hasBalanceSheetData =
    assets !== 0 ||
    liabilities !== 0;

  const hasCashFlowData =
    operatingCashFlow !== 0 ||
    closingCash !== 0;

  /*
   * Do not generate an artificial insight for a
   * tenant that has no meaningful posted activity.
   */
  if (
    !hasIncomeData &&
    !hasBalanceSheetData &&
    !hasCashFlowData
  ) {
    return {
      title:
        "Financial data is being established",
      message:
        "There is not yet enough posted accounting activity to generate a meaningful financial insight.",
      tone: "neutral",
    };
  }

  /*
   * Profitability is the first priority because
   * it directly reflects whether recorded activity
   * is currently producing a profit or loss.
   */
  if (
    revenue > 0 &&
    netProfit < 0
  ) {
    const loss =
      Math.abs(netProfit);

    return {
      title:
        "Profitability requires attention",
      message:
        `The tenant has recorded ${formatCompactCurrency(
          loss
        )} of net loss against ${formatCompactCurrency(
          revenue
        )} of revenue in the available financial data.`,
      tone: "attention",
    };
  }

  if (
    revenue > 0 &&
    netProfit > 0
  ) {
    const margin =
      (netProfit / revenue) *
      100;

    return {
      title:
        "Profitability is positive",
      message:
        `Recorded revenue is ${formatCompactCurrency(
          revenue
        )}, with net profit of ${formatCompactCurrency(
          netProfit
        )}. The recorded net margin is ${margin.toFixed(
          1
        )}%.`,
      tone: "positive",
    };
  }

  /*
   * A negative closing cash position is surfaced
   * independently when there is no stronger
   * profitability signal.
   */
  if (
    hasCashFlowData &&
    closingCash < 0
  ) {
    return {
      title:
        "Cash position requires attention",
      message:
        `The recorded closing cash position is ${formatCompactCurrency(
          Math.abs(closingCash)
        )} below zero. Review cash movements and outstanding obligations.`,
      tone: "attention",
    };
  }

  /*
   * Flag a balance-sheet condition where liabilities
   * exceed recorded assets.
   */
  if (
    hasBalanceSheetData &&
    assets > 0 &&
    liabilities > assets
  ) {
    return {
      title:
        "Liability exposure requires review",
      message:
        `Recorded liabilities of ${formatCompactCurrency(
          liabilities
        )} exceed total assets of ${formatCompactCurrency(
          assets
        )}. Review the underlying balances and obligations.`,
      tone: "attention",
    };
  }

  /*
   * Positive operating cash flow is a useful
   * operational signal when profitability does not
   * provide a stronger insight.
   */
  if (
    hasCashFlowData &&
    operatingCashFlow > 0
  ) {
    return {
      title:
        "Operating cash generation is positive",
      message:
        `Recorded operating activities generated ${formatCompactCurrency(
          operatingCashFlow
        )}, with closing cash of ${formatCompactCurrency(
          closingCash
        )}.`,
      tone: "positive",
    };
  }

  return {
    title:
      "Financial activity is available",
    message:
      "Posted financial data is available across the organization's accounting records for management review.",
    tone: "neutral",
  };
}

export default function FinancialAssistant() {
  const [
    insight,
    setInsight,
  ] = useState<Insight | null>(
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

  const loadInsight =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(false);

        /*
         * The authenticated backend session determines
         * the current tenant. No organizationId is
         * supplied by the browser.
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

        if (
          !income.success ||
          !balance.success ||
          !cashFlow.success
        ) {
          throw new Error(
            "Financial insight data could not be loaded."
          );
        }

        const snapshot: FinancialSnapshot =
          {
            revenue:
              toNumber(
                income.totals
                  ?.revenue
              ),

            expenses:
              toNumber(
                income.totals
                  ?.expenses
              ),

            netProfit:
              toNumber(
                income.totals
                  ?.netProfit
              ),

            assets:
              toNumber(
                balance.totals
                  ?.assets
              ),

            liabilities:
              toNumber(
                balance.totals
                  ?.liabilities
              ),

            equity:
              toNumber(
                balance.totals
                  ?.equity
              ),

            operatingCashFlow:
              toNumber(
                cashFlow.totals
                  ?.operating
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
          buildInsight(
            snapshot
          )
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
      : getToneClasses(
          "neutral"
        );

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
      {/* Header */}
      <header className="flex min-w-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
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
          title="Refresh financial insight"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2
              size={16}
              className="animate-spin"
            />
          ) : (
            <RefreshCw
              size={16}
            />
          )}
        </button>
      </header>

      {/* Insight body */}
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div
            className={`absolute inset-y-0 left-0 w-1 ${tone.accent}`}
            aria-hidden="true"
          />

          <div className="flex min-w-0 items-start gap-3.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${tone.icon}`}
            >
              <Sparkles
                size={18}
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                  Today's Insight
                </span>

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
                <div
                  className="mt-4 space-y-2.5"
                  aria-label="Loading financial insight"
                >
                  <div className="h-5 w-52 max-w-full animate-pulse rounded bg-slate-200" />

                  <div className="h-3 w-full animate-pulse rounded bg-slate-200" />

                  <div className="h-3 w-5/6 max-w-full animate-pulse rounded bg-slate-200" />
                </div>
              ) : error ? (
                <div className="mt-4">
                  <div className="flex items-start gap-2.5 text-sm text-slate-600">
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0 text-amber-500"
                    />

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">
                        Financial insight is temporarily unavailable.
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          void loadInsight();
                        }}
                        className="mt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
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

        <div className="mt-3 flex min-w-0 items-start gap-2 text-[10px] leading-5 text-slate-400">
          <CircleHelp
            size={13}
            className="mt-0.5 shrink-0"
          />

          <span className="min-w-0">
            Insights are generated from the
            organization's authenticated posted
            accounting data.
          </span>
        </div>
      </div>
    </section>
  );
}