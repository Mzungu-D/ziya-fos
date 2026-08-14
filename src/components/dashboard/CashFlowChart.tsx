import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type CashFlowItem = {
  id: string;
  reference: string;
  description: string;
  transactionDate: string;
  category: "OPERATING" | "INVESTING" | "FINANCING";
  direction: "INFLOW" | "OUTFLOW";
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
  meta: {
    currency: string;
  };
};

type ChartPoint = {
  month: string;
  inflow: number;
  outflow: number;
};

const API_URL = import.meta.env.VITE_API_URL || "";

const getToken = (): string | null => {
  const possibleKeys = [
    "token",
    "accessToken",
    "authToken",
    "jwt",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value?.trim()) {
      return value.trim();
    }
  }

  return null;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatAxisValue = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }

  return value.toString();
};

const getMonthKey = (date: string): string => {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1
  ).padStart(2, "0")}`;
};

const getMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    1
  );

  return date.toLocaleDateString("en-US", {
    month: "short",
  });
};

export default function CashFlowChart() {
  const [cashFlow, setCashFlow] =
    useState<CashFlowResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCashFlow = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = getToken();

        if (!token) {
          throw new Error(
            "Authentication required."
          );
        }

        const response = await fetch(
          `${API_URL}/api/cash-flow`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data =
          (await response.json()) as CashFlowResponse & {
            message?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load cash flow."
          );
        }

        if (!data.success) {
          throw new Error(
            data.message ||
              "Failed to load cash flow."
          );
        }

        if (!cancelled) {
          setCashFlow(data);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load cash flow."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadCashFlow();

    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!cashFlow) {
      return [];
    }

    const allItems: CashFlowItem[] = [
      ...cashFlow.operatingActivities.items,
      ...cashFlow.investingActivities.items,
      ...cashFlow.financingActivities.items,
    ];

    const monthly = new Map<
      string,
      {
        inflow: number;
        outflow: number;
      }
    >();

    for (const item of allItems) {
      const monthKey =
        getMonthKey(
          item.transactionDate
        );

      if (!monthKey) {
        continue;
      }

      const existing =
        monthly.get(monthKey) ?? {
          inflow: 0,
          outflow: 0,
        };

      if (
        item.direction === "INFLOW"
      ) {
        existing.inflow += Number(
          item.amount
        );
      } else {
        existing.outflow += Number(
          item.amount
        );
      }

      monthly.set(
        monthKey,
        existing
      );
    }

    return Array.from(monthly.entries())
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([month, values]) => ({
        month: getMonthLabel(month),
        inflow: values.inflow,
        outflow: values.outflow,
      }));
  }, [cashFlow]);

  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Cash Flow Overview
          </h2>

          <p className="text-[#666B84] text-sm">
            Monthly Cash Inflow vs Outflow
          </p>
        </div>

        {cashFlow?.meta?.currency && (
          <span className="text-xs font-medium text-[#666B84] bg-[#F8F9FC] border border-[#ECECF3] px-3 py-1.5 rounded-lg">
            {cashFlow.meta.currency}
          </span>
        )}
      </div>

      {loading && (
        <div className="h-80 flex items-center justify-center">
          <div className="text-sm text-[#666B84]">
            Loading cash flow...
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-[#EF4444]">
              Unable to load cash flow
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      {!loading &&
        !error &&
        chartData.length === 0 && (
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-[#20243A]">
                No cash flow data
              </p>

              <p className="text-xs text-[#666B84] mt-1">
                Posted cash transactions will appear here.
              </p>
            </div>
          </div>
        )}

      {!loading &&
        !error &&
        chartData.length > 0 && (
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
                    stroke: "#E5E7EB",
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
                    name
                  ) => [
                    formatCurrency(
                      Number(value)
                    ),
                    name === "inflow"
                      ? "Cash Inflow"
                      : "Cash Outflow",
                  ]}
                  labelFormatter={(label) =>
                    `Month: ${label}`
                  }
                  contentStyle={{
                    borderRadius: "12px",
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
    </div>
  );
}