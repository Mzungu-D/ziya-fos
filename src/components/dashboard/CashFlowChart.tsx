import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { authenticatedFetch } from "../../lib/auth";

type CashFlowItem = {
  id: string;
  reference: string;
  description: string;
  transactionDate: string;
  category:
    | "OPERATING"
    | "INVESTING"
    | "FINANCING";
  direction:
    | "INFLOW"
    | "OUTFLOW";
  amount: number;
};

type CashFlowSection = {
  items: CashFlowItem[];
  inflows: number;
  outflows: number;
  netCashFlow: number;
};

type CashFlowResponse = {
  success: boolean;
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  totals: {
    operating: number;
    investing: number;
    financing: number;
    netIncreaseDecrease: number;
    openingCashBalance: number;
    closingCashBalance: number;
    calculatedClosingCashBalance: number;
    reconciliationDifference: number;
    reconciled: boolean;
  };
  pagination?: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  meta: {
    currency: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  message?: string;
};

type ChartPoint = {
  monthKey: string;
  month: string;
  inflow: number;
  outflow: number;
};

const API_URL = import.meta.env.VITE_API_URL || "";

const CASH_FLOW_ENDPOINT =
  `${API_URL}/api/cash-flow`;

const REPORTING_MONTHS = 12;

const PAGE_SIZE = 100;

const getMonthKey = (
  date: Date,
): string =>
  `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;

const getMonthLabel = (
  monthKey: string,
): string => {
  const [
    year,
    month,
  ] = monthKey
    .split("-")
    .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return monthKey;
  }

  return new Date(
    year,
    month - 1,
    1,
  ).toLocaleDateString(
    "en-US",
    {
      month: "short",
    },
  );
};

const formatDateOnly = (
  date: Date,
): string =>
  `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const getReportingRange = (): {
  startDate: string;
  endDate: string;
  monthKeys: string[];
} => {
  const now = new Date();

  const currentMonthStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

  const startMonth =
    new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() -
        (REPORTING_MONTHS - 1),
      1,
    );

  const endMonth =
    new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() + 1,
      0,
    );

  const monthKeys =
    Array.from(
      {
        length:
          REPORTING_MONTHS,
      },
      (_, index) =>
        getMonthKey(
          new Date(
            startMonth.getFullYear(),
            startMonth.getMonth() +
              index,
            1,
          ),
        ),
    );

  return {
    startDate:
      formatDateOnly(
        startMonth,
      ),

    endDate:
      formatDateOnly(
        endMonth,
      ),

    monthKeys,
  };
};

const formatCurrency = (
  value: number,
  currency: string,
): string => {
  const normalizedCurrency =
    /^[A-Z]{3}$/.test(currency)
      ? currency
      : "KES";

  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency:
        normalizedCurrency,
      maximumFractionDigits: 0,
    },
  ).format(
    Number.isFinite(value)
      ? value
      : 0,
  );
};

const formatAxisValue = (
  value: number,
): string => {
  const absoluteValue =
    Math.abs(value);

  if (
    absoluteValue >=
    1_000_000
  ) {
    return `${(
      value / 1_000_000
    ).toFixed(1)}M`;
  }

  if (
    absoluteValue >= 1_000
  ) {
    return `${(
      value / 1_000
    ).toFixed(0)}K`;
  }

  return value.toString();
};

const getItems = (
  response: CashFlowResponse,
): CashFlowItem[] => [
  ...response
    .operatingActivities
    .items,

  ...response
    .investingActivities
    .items,

  ...response
    .financingActivities
    .items,
];

const mergeCashFlowPages = (
  firstPage: CashFlowResponse,
  pages: CashFlowResponse[],
): CashFlowResponse => {
  const allResponses = [
    firstPage,
    ...pages,
  ];

  return {
    ...firstPage,

    operatingActivities: {
      ...firstPage
        .operatingActivities,

      items:
        allResponses.flatMap(
          (response) =>
            response
              .operatingActivities
              .items,
        ),
    },

    investingActivities: {
      ...firstPage
        .investingActivities,

      items:
        allResponses.flatMap(
          (response) =>
            response
              .investingActivities
              .items,
        ),
    },

    financingActivities: {
      ...firstPage
        .financingActivities,

      items:
        allResponses.flatMap(
          (response) =>
            response
              .financingActivities
              .items,
        ),
    },
  };
};

const fetchCashFlowPage =
  async (
    url: string,
    signal: AbortSignal,
  ): Promise<CashFlowResponse> => {
    const response =
      await authenticatedFetch(
        url,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },

          signal,
        },
      );

    let data: CashFlowResponse;

    try {
      data =
        (await response.json()) as CashFlowResponse;
    } catch {
      throw new Error(
        "The cash-flow service returned an invalid response.",
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to load cash flow.",
      );
    }

    if (!data.success) {
      throw new Error(
        data.message ||
          "Failed to load cash flow.",
      );
    }

    return data;
  };

export default function CashFlowChart() {
  const [
    cashFlow,
    setCashFlow,
  ] =
    useState<CashFlowResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    refreshVersion,
    setRefreshVersion,
  ] =
    useState(0);

  const loadCashFlow =
    useCallback(
      async (
        signal: AbortSignal,
      ) => {
        const {
          startDate,
          endDate,
        } =
          getReportingRange();

        const firstUrl =
          `${CASH_FLOW_ENDPOINT}` +
          `?startDate=${encodeURIComponent(
            startDate,
          )}` +
          `&endDate=${encodeURIComponent(
            endDate,
          )}` +
          `&page=1` +
          `&limit=${PAGE_SIZE}`;

        const firstPage =
          await fetchCashFlowPage(
            firstUrl,
            signal,
          );

        const totalPages =
          Math.max(
            1,
            firstPage.pagination
              ?.totalPages ?? 1,
          );

        /*
         * The dashboard must not build a
         * 12-month trend from one
         * paginated page.
         *
         * The cash-flow API deliberately
         * paginates detailed records.
         *
         * Therefore the dashboard loads
         * every page in the selected
         * reporting window before
         * aggregating the transactions.
         *
         * No organizationId is supplied
         * by the browser. Tenant context
         * comes from the authenticated
         * session on the server.
         */
        const remainingPages: CashFlowResponse[] =
          [];

        for (
          let page = 2;
          page <= totalPages;
          page += 1
        ) {
          if (
            signal.aborted
          ) {
            return null;
          }

          const pageUrl =
            `${CASH_FLOW_ENDPOINT}` +
            `?startDate=${encodeURIComponent(
              startDate,
            )}` +
            `&endDate=${encodeURIComponent(
              endDate,
            )}` +
            `&page=${page}` +
            `&limit=${PAGE_SIZE}`;

          remainingPages.push(
            await fetchCashFlowPage(
              pageUrl,
              signal,
            ),
          );
        }

        return mergeCashFlowPages(
          firstPage,
          remainingPages,
        );
      },
      [],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    let active = true;

    const load =
      async () => {
        /*
         * Do not clear existing
         * chart data during refresh.
         *
         * This prevents the dashboard
         * from flashing into an empty
         * state while new accounting
         * data is being loaded.
         */
        if (!cashFlow) {
          setLoading(true);
        }

        setError(null);

        try {
          const data =
            await loadCashFlow(
              controller.signal,
            );

          if (
            !active ||
            controller.signal.aborted ||
            !data
          ) {
            return;
          }

          setCashFlow(data);
        } catch (err) {
          if (
            !active ||
            controller.signal.aborted
          ) {
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load cash flow.",
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    loadCashFlow,
    refreshVersion,
  ]);

  /*
   * Refresh when the user returns
   * to the dashboard.
   *
   * Tenant switching in the FOS
   * already navigates back to
   * /dashboard, causing this
   * component to mount under the
   * new authenticated tenant.
   */
  useEffect(() => {
    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          setRefreshVersion(
            (value) =>
              value + 1,
          );
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    /*
     * Schedule a refresh at the
     * beginning of the next calendar
     * month so the chart automatically
     * rolls forward.
     */
    const now =
      new Date();

    const nextMonth =
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        5,
        0,
      );

    const timeoutId =
      window.setTimeout(
        () => {
          setRefreshVersion(
            (value) =>
              value + 1,
          );
        },
        Math.max(
          1_000,
          nextMonth.getTime() -
            now.getTime(),
        ),
      );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.clearTimeout(
        timeoutId,
      );
    };
  }, []);

  const chartData =
    useMemo<ChartPoint[]>(
      () => {
        const {
          monthKeys,
        } =
          getReportingRange();

        const monthly =
          new Map<
            string,
            {
              inflow: number;
              outflow: number;
            }
          >();

        /*
         * Always create the complete
         * 12-month timeline.
         *
         * This means a month with
         * zero activity is represented
         * as zero rather than simply
         * disappearing from the chart.
         */
        for (
          const monthKey of monthKeys
        ) {
          monthly.set(
            monthKey,
            {
              inflow: 0,
              outflow: 0,
            },
          );
        }

        if (!cashFlow) {
          return [];
        }

        for (
          const item of getItems(
            cashFlow,
          )
        ) {
          const parsedDate =
            new Date(
              item.transactionDate,
            );

          if (
            Number.isNaN(
              parsedDate.getTime(),
            )
          ) {
            continue;
          }

          const monthKey =
            getMonthKey(
              parsedDate,
            );

          const existing =
            monthly.get(
              monthKey,
            );

          if (!existing) {
            continue;
          }

          const amount =
            Number(item.amount);

          if (
            !Number.isFinite(
              amount,
            ) ||
            amount <= 0
          ) {
            continue;
          }

          if (
            item.direction ===
            "INFLOW"
          ) {
            existing.inflow +=
              amount;
          } else if (
            item.direction ===
            "OUTFLOW"
          ) {
            existing.outflow +=
              amount;
          }
        }

        return monthKeys.map(
          (monthKey) => {
            const values =
              monthly.get(
                monthKey,
              ) ?? {
                inflow: 0,
                outflow: 0,
              };

            return {
              monthKey,

              month:
                getMonthLabel(
                  monthKey,
                ),

              inflow:
                values.inflow,

              outflow:
                values.outflow,
            };
          },
        );
      },
      [cashFlow],
    );

  const hasCashActivity =
    chartData.some(
      (point) =>
        point.inflow > 0 ||
        point.outflow > 0,
    );

  const currency =
    cashFlow?.meta?.currency ||
    "KES";

  const showInitialLoading =
    loading && !cashFlow;

  const showInitialError =
    !loading &&
    !cashFlow &&
    Boolean(error);

  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Cash Flow Overview
          </h2>

          <p className="text-[#666B84] text-sm">
            Monthly Cash Inflow vs Outflow
          </p>
        </div>

        <span className="shrink-0 text-xs font-medium text-[#666B84] bg-[#F8F9FC] border border-[#ECECF3] px-3 py-1.5 rounded-lg">
          {currency}
        </span>
      </div>

      {showInitialLoading && (
        <div className="h-80 flex items-center justify-center">
          <div className="text-sm text-[#666B84]">
            Loading cash flow...
          </div>
        </div>
      )}

      {showInitialError && (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-sm font-medium text-[#20243A]">
              Unable to load cash flow
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setRefreshVersion(
                  (value) =>
                    value + 1,
                )
              }
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-[#ECECF3] bg-white px-4 py-2 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!showInitialLoading &&
        !showInitialError &&
        !hasCashActivity && (
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-[#20243A]">
                No cash flow data
              </p>

              <p className="text-xs text-[#666B84] mt-1">
                No posted cash activity was recorded in the last{" "}
                {REPORTING_MONTHS} months.
              </p>
            </div>
          </div>
        )}

      {!showInitialLoading &&
        !showInitialError &&
        hasCashActivity && (
          <div className="h-80">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="month"
                  stroke="#94A3B8"
                  tickLine={false}
                  axisLine={{
                    stroke:
                      "#E5E7EB",
                  }}
                />

                <YAxis
                  stroke="#94A3B8"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={
                    formatAxisValue
                  }
                  width={65}
                />

                <Tooltip
                  formatter={(
                    value,
                    name,
                  ) => [
                    formatCurrency(
                      Number(value),
                      currency,
                    ),

                    name ===
                    "inflow"
                      ? "Cash Inflow"
                      : "Cash Outflow",
                  ]}
                  labelFormatter={(
                    label,
                  ) =>
                    `Month: ${label}`
                  }
                  contentStyle={{
                    borderRadius:
                      "12px",

                    border:
                      "1px solid #ECECF3",

                    boxShadow:
                      "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="#22C55E"
                  fill="#22C55E22"
                  strokeWidth={3}
                  name="inflow"
                  dot={false}
                  activeDot={{
                    r: 5,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="outflow"
                  stroke="#EF4444"
                  fill="#EF444422"
                  strokeWidth={3}
                  name="outflow"
                  dot={false}
                  activeDot={{
                    r: 5,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

      {cashFlow &&
        error &&
        !showInitialError && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#FFF7ED] px-3 py-2">
            <p className="text-xs text-[#9A3412]">
              Showing the last successfully loaded cash-flow data.
            </p>

            <button
              type="button"
              onClick={() =>
                setRefreshVersion(
                  (value) =>
                    value + 1,
                )
              }
              className="text-xs font-medium text-[#9A3412] hover:underline"
            >
              Retry
            </button>
          </div>
        )}
    </div>
  );
}