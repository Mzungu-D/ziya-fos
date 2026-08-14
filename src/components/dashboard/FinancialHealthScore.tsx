import {
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

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

interface HealthData {
  score: number;
  label: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  assets: number;
  liabilities: number;
  balanced: boolean;
}

function getAuthToken(): string | null {
  const keys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
  ];

  for (const key of keys) {
    const value =
      localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  return null;
}

async function apiGet<T>(
  endpoint: string
): Promise<T> {
  const token =
    getAuthToken();

  const headers: HeadersInit = {
    Accept:
      "application/json",
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(endpoint, {
      method: "GET",
      headers,
      credentials: "include",
    });

  let payload: unknown = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
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
        value.replace(/,/g, "")
      );

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return 0;
}

function calculateHealthScore(
  income: IncomeStatementResponse,
  balance: BalanceSheetResponse
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

  const balanced =
    balance.totals?.balanced ===
    true;

  /*
   * Profitability component.
   * A profitable organization receives
   * a stronger score than an organization
   * operating at a loss.
   */
  let profitabilityScore = 0;

  if (revenue > 0) {
    const margin =
      netProfit / revenue;

    if (margin >= 0.25) {
      profitabilityScore = 30;
    } else if (margin >= 0.15) {
      profitabilityScore = 25;
    } else if (margin >= 0.05) {
      profitabilityScore = 20;
    } else if (margin >= 0) {
      profitabilityScore = 12;
    } else {
      profitabilityScore = 0;
    }
  }

  /*
   * Liquidity / leverage component.
   */
  let liquidityScore = 0;

  if (assets > 0) {
    const liabilityRatio =
      liabilities / assets;

    if (liabilityRatio <= 0.30) {
      liquidityScore = 25;
    } else if (
      liabilityRatio <= 0.50
    ) {
      liquidityScore = 20;
    } else if (
      liabilityRatio <= 0.70
    ) {
      liquidityScore = 15;
    } else if (
      liabilityRatio <= 1
    ) {
      liquidityScore = 8;
    }
  }

  /*
   * Balance-sheet integrity.
   */
  const accountingIntegrityScore =
    balanced ? 20 : 0;

  /*
   * Expense efficiency.
   */
  let expenseEfficiencyScore = 0;

  if (revenue > 0) {
    const expenseRatio =
      expenses / revenue;

    if (expenseRatio <= 0.50) {
      expenseEfficiencyScore = 25;
    } else if (
      expenseRatio <= 0.65
    ) {
      expenseEfficiencyScore = 20;
    } else if (
      expenseRatio <= 0.80
    ) {
      expenseEfficiencyScore = 15;
    } else if (
      expenseRatio <= 1
    ) {
      expenseEfficiencyScore = 8;
    }
  }

  let score =
    profitabilityScore +
    liquidityScore +
    accountingIntegrityScore +
    expenseEfficiencyScore;

  score = Math.max(
    0,
    Math.min(100, score)
  );

  let label =
    "Needs Attention";

  if (score >= 85) {
    label =
      "Excellent Financial Health";
  } else if (score >= 70) {
    label =
      "Good Financial Health";
  } else if (score >= 50) {
    label =
      "Fair Financial Health";
  }

  return {
    score,
    label,
    revenue,
    expenses,
    netProfit,
    assets,
    liabilities,
    balanced,
  };
}

export default function FinancialHealthScore() {
  const [
    data,
    setData,
  ] = useState<HealthData | null>(
    null
  );

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

          const [
            income,
            balance,
          ] = await Promise.all([
            apiGet<IncomeStatementResponse>(
              "/api/income-statement"
            ),
            apiGet<BalanceSheetResponse>(
              "/api/balance-sheet"
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

          setData(
            calculateHealthScore(
              income,
              balance
            )
          );
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

  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#16A34A]/10">
          <ShieldCheck
            className="text-[#16A34A]"
            size={24}
          />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Financial Health
          </h2>

          <p className="text-sm text-[#666B84]">
            Overall business score
          </p>
        </div>

        {loading && (
          <Loader2
            className="ml-auto animate-spin text-[#666B84]"
            size={18}
          />
        )}
      </div>

      {error ? (
        <div className="flex min-h-[12rem] items-center justify-center">
          <div className="max-w-sm text-center">
            <AlertCircle
              className="mx-auto mb-3 text-red-500"
              size={24}
            />

            <p className="font-medium text-red-700">
              Unable to calculate financial health
            </p>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex min-h-[12rem] items-center justify-center text-sm text-[#666B84]">
          Calculating financial health...
        </div>
      ) : data ? (
        <>
          <div className="text-center">
            <h1
              className={`text-6xl font-bold ${
                data.score >= 70
                  ? "text-[#16A34A]"
                  : data.score >= 50
                    ? "text-[#F59E0B]"
                    : "text-[#EF4444]"
              }`}
            >
              {data.score}%
            </h1>

            <p className="mt-3 text-[#666B84]">
              {data.label}
            </p>
          </div>

          <div className="mt-8">
            <div className="h-3 w-full overflow-hidden rounded-full border border-[#ECECF3] bg-[#F8F9FC]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.score >= 70
                    ? "bg-[#16A34A]"
                    : data.score >= 50
                      ? "bg-[#F59E0B]"
                      : "bg-[#EF4444]"
                }`}
                style={{
                  width: `${data.score}%`,
                }}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}