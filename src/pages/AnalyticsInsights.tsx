import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Activity,
  BarChart3,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { authenticatedFetch } from "../lib/auth";

type RevenueResponse = {
  success: boolean;
  totals?: {
    revenue?: number;
  };
  data?: Array<{
    code: string;
    name: string;
    amount: number;
  }>;
  message?: string;
};

type ExpenseResponse = {
  success: boolean;
  totals?: {
    expenses?: number;
  };
  data?: Array<{
    code: string;
    name: string;
    amount: number;
  }>;
  message?: string;
};

type CashResponse = {
  success: boolean;
  totals?: {
    bankBalance?: number;
    mpesaBalance?: number;
    totalLiquidity?: number;
  };
  message?: string;
};

type BudgetResponse = {
  success: boolean;
  totals?: {
    totalBudget?: number;
    totalActual?: number;
    variance?: number;
    utilization?: number;
  };
  message?: string;
};

type AnalyticsData = {
  revenue: number;
  expenses: number;
  cash: number;
  budget: number;
  actualSpend: number;
  budgetUtilization: number;

  revenueAccounts: Array<{
    code: string;
    name: string;
    amount: number;
  }>;

  expenseAccounts: Array<{
    code: string;
    name: string;
    amount: number;
  }>;
};

const emptyAnalytics: AnalyticsData = {
  revenue: 0,
  expenses: 0,
  cash: 0,
  budget: 0,
  actualSpend: 0,
  budgetUtilization: 0,
  revenueAccounts: [],
  expenseAccounts: [],
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export default function AnalyticsInsights() {
  const [analytics, setAnalytics] =
    useState<AnalyticsData>(emptyAnalytics);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError("");

      const currentYear =
        new Date().getFullYear();

      /*
       * IMPORTANT:
       *
       * Do NOT use raw fetch() here.
       *
       * authenticatedFetch() comes from the canonical
       * authentication system and automatically sends:
       *
       * Authorization: Bearer <JWT>
       *
       * The financial-report routes require authentication.
       */

      const [
        revenueResponse,
        expenseResponse,
        cashResponse,
        budgetResponse,
      ] = await Promise.all([
        authenticatedFetch(
          "/api/financial-reports/revenue-analysis",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        ),

        authenticatedFetch(
          "/api/financial-reports/expense-analysis",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        ),

        authenticatedFetch(
          "/api/financial-reports/cash-position",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        ),

        authenticatedFetch(
          `/api/financial-reports/budget-vs-actual?year=${currentYear}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        ),
      ]);

      /*
       * Check HTTP responses before processing the JSON.
       */
      if (
        !revenueResponse.ok ||
        !expenseResponse.ok ||
        !cashResponse.ok ||
        !budgetResponse.ok
      ) {
        const failedResponse =
          !revenueResponse.ok
            ? revenueResponse
            : !expenseResponse.ok
            ? expenseResponse
            : !cashResponse.ok
            ? cashResponse
            : budgetResponse;

        let message =
          `Failed to load financial analytics (${failedResponse.status}).`;

        try {
          const errorData =
            await failedResponse.json();

          if (
            errorData &&
            typeof errorData.message === "string"
          ) {
            message = errorData.message;
          }
        } catch {
          // Keep the default HTTP error message.
        }

        throw new Error(message);
      }

      /*
       * Parse all successful responses.
       */
      const revenueData =
        (await revenueResponse.json()) as RevenueResponse;

      const expenseData =
        (await expenseResponse.json()) as ExpenseResponse;

      const cashData =
        (await cashResponse.json()) as CashResponse;

      const budgetData =
        (await budgetResponse.json()) as BudgetResponse;

      /*
       * Validate application-level success.
       */
      if (!revenueData.success) {
        throw new Error(
          revenueData.message ||
            "Unable to load revenue analytics."
        );
      }

      if (!expenseData.success) {
        throw new Error(
          expenseData.message ||
            "Unable to load expense analytics."
        );
      }

      if (!cashData.success) {
        throw new Error(
          cashData.message ||
            "Unable to load cash analytics."
        );
      }

      if (!budgetData.success) {
        throw new Error(
          budgetData.message ||
            "Unable to load budget analytics."
        );
      }

      /*
       * Extract financial values.
       */
      const revenue =
        Number(
          revenueData.totals?.revenue
        ) || 0;

      const expenses =
        Number(
          expenseData.totals?.expenses
        ) || 0;

      const cash =
        Number(
          cashData.totals?.totalLiquidity
        ) || 0;

      const budget =
        Number(
          budgetData.totals?.totalBudget
        ) || 0;

      const actualSpend =
        Number(
          budgetData.totals?.totalActual
        ) || expenses;

      const budgetUtilization =
        budget > 0
          ? (actualSpend / budget) * 100
          : 0;

      /*
       * Store the real organization-level financial data.
       */
      setAnalytics({
        revenue,
        expenses,
        cash,
        budget,
        actualSpend,
        budgetUtilization,
        revenueAccounts:
          revenueData.data || [],
        expenseAccounts:
          expenseData.data || [],
      });
    } catch (err) {
      console.error(
        "[ANALYTICS UI] Failed to load analytics:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load financial analytics."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  /*
   * Cash-health calculation.
   *
   * This is a UI-derived indicator based on
   * recorded liquidity versus recorded expenses.
   */
  const cashHealth = useMemo(() => {
    if (analytics.expenses <= 0) {
      return analytics.cash > 0 ? 100 : 0;
    }

    const coverage =
      (analytics.cash /
        analytics.expenses) *
      100;

    return Math.min(
      Math.max(coverage, 0),
      100
    );
  }, [
    analytics.cash,
    analytics.expenses,
  ]);

  /*
   * Find the largest expense account.
   */
  const largestExpense = useMemo(() => {
    if (
      analytics.expenseAccounts.length ===
      0
    ) {
      return null;
    }

    return [
      ...analytics.expenseAccounts,
    ].sort(
      (a, b) => b.amount - a.amount
    )[0];
  }, [
    analytics.expenseAccounts,
  ]);

  /*
   * Find the largest revenue account.
   */
  const largestRevenue = useMemo(() => {
    if (
      analytics.revenueAccounts.length ===
      0
    ) {
      return null;
    }

    return [
      ...analytics.revenueAccounts,
    ].sort(
      (a, b) => b.amount - a.amount
    )[0];
  }, [
    analytics.revenueAccounts,
  ]);

  const insights = [
    {
      title: "Revenue",
      value: formatCurrency(
        analytics.revenue
      ),
      trend:
        analytics.revenue >= 0
          ? "positive"
          : "negative",
    },

    {
      title: "Expenses",
      value: formatCurrency(
        analytics.expenses
      ),
      trend:
        analytics.expenses <=
        analytics.revenue
          ? "positive"
          : "negative",
    },

    {
      title: "Cash Flow Health",
      value: formatPercentage(
        cashHealth
      ),
      trend:
        cashHealth >= 70
          ? "positive"
          : "negative",
    },

    {
      title: "Budget Utilization",
      value: formatPercentage(
        analytics.budgetUtilization
      ),
      trend:
        analytics.budgetUtilization <= 100
          ? "positive"
          : "negative",
    },
  ];

  /*
   * Loading state.
   */
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Analytics & Insights
          </h1>

          <p className="text-[#666B84] mt-2">
            Analyze business performance and financial trends.
          </p>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-8">
          <p className="text-[#666B84]">
            Loading financial analytics...
          </p>
        </div>
      </div>
    );
  }

  /*
   * Error state.
   */
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Analytics & Insights
          </h1>

          <p className="text-[#666B84] mt-2">
            Analyze business performance and financial trends.
          </p>
        </div>

        <div className="bg-white border border-red-200 rounded-2xl p-6">
          <p className="font-medium text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => {
              void loadAnalytics();
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-[#20243A] text-white"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#20243A]">
          Analytics & Insights
        </h1>

        <p className="text-[#666B84] mt-2">
          Analyze business performance and financial trends.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {insights.map((item) => (
          <div
            key={item.title}
            className="bg-white border border-[#ECECF3] rounded-2xl p-6"
          >
            <p className="text-[#666B84]">
              {item.title}
            </p>

            <div className="flex items-center justify-between mt-4">
              <h2 className="text-3xl font-bold text-[#20243A]">
                {item.value}
              </h2>

              {item.trend === "positive" ? (
                <TrendingUp className="text-green-400" />
              ) : (
                <TrendingDown className="text-red-400" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue Insight */}
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="text-green-400" />

            <h2 className="text-xl font-semibold text-[#20243A]">
              Revenue Insight
            </h2>
          </div>

          {analytics.revenue > 0 ? (
            <p className="text-[#666B84]">
              The organization has generated{" "}
              <span className="font-semibold text-[#20243A]">
                {formatCurrency(
                  analytics.revenue
                )}
              </span>{" "}
              in recorded revenue.

              {largestRevenue && (
                <>
                  {" "}
                  The largest revenue account is{" "}
                  <span className="font-semibold text-[#20243A]">
                    {largestRevenue.name}
                  </span>{" "}
                  at{" "}
                  {formatCurrency(
                    largestRevenue.amount
                  )}
                  .
                </>
              )}
            </p>
          ) : (
            <p className="text-[#666B84]">
              No posted revenue has been recorded
              for this organization yet.
            </p>
          )}
        </div>

        {/* Expense Insight */}
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <PieChart className="text-[#20243A]" />

            <h2 className="text-xl font-semibold text-[#20243A]">
              Expense Insight
            </h2>
          </div>

          {analytics.expenses > 0 ? (
            <p className="text-[#666B84]">
              Recorded expenses currently total{" "}
              <span className="font-semibold text-[#20243A]">
                {formatCurrency(
                  analytics.expenses
                )}
              </span>
              .

              {largestExpense && (
                <>
                  {" "}
                  The largest expense category is{" "}
                  <span className="font-semibold text-[#20243A]">
                    {largestExpense.name}
                  </span>{" "}
                  at{" "}
                  {formatCurrency(
                    largestExpense.amount
                  )}
                  .
                </>
              )}
            </p>
          ) : (
            <p className="text-[#666B84]">
              No posted expenses have been recorded
              for this organization yet.
            </p>
          )}
        </div>

        {/* Cash Flow Insight */}
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-yellow-400" />

            <h2 className="text-xl font-semibold text-[#20243A]">
              Cash Flow Insight
            </h2>
          </div>

          <p className="text-[#666B84]">
            Current recorded liquidity across bank
            accounts and M-Pesa is{" "}
            <span className="font-semibold text-[#20243A]">
              {formatCurrency(
                analytics.cash
              )}
            </span>
            .

            {analytics.expenses > 0 && (
              <>
                {" "}
                Based on recorded expenses, this
                represents approximately{" "}
                <span className="font-semibold text-[#20243A]">
                  {cashHealth.toFixed(0)}%
                </span>{" "}
                of the current cash-health benchmark.
              </>
            )}
          </p>
        </div>

        {/* Forecast Insight */}
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="text-purple-400" />

            <h2 className="text-xl font-semibold text-[#20243A]">
              Forecast Insight
            </h2>
          </div>

          <p className="text-[#666B84]">
            AI forecasting is not yet active for
            this organization. The FOS is currently
            collecting and analyzing financial data
            that will feed the future predictive
            forecasting engine.
          </p>

          <div className="mt-4 rounded-lg bg-purple-50 px-4 py-3">
            <p className="text-sm text-purple-700">
              XGBoost / LightGBM forecasting will be
              introduced after sufficient historical
              organization-level data is available.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}