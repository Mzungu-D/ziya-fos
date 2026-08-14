import {
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { authenticatedFetch } from "../../lib/auth";

interface IncomeStatementResponse {
  success: boolean;
  revenue?: Array<{
    id: string;
    code: string;
    name: string;
    amount: number | string;
  }>;
  expenses?: Array<{
    id: string;
    code: string;
    name: string;
    amount: number | string;
  }>;
  totals?: {
    revenue?: number | string;
    expenses?: number | string;
    netProfit?: number | string;
    profitMargin?: number | string;
  };
  message?: string;
}

interface Row {
  title: string;
  value: string;
  color: string;
}

async function apiGet<T>(
  endpoint: string
): Promise<T> {
  const response =
    await authenticatedFetch(endpoint, {
      method: "GET",
      headers: {
        Accept:
          "application/json",
      },
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

function formatCurrency(
  value: number
): string {
  const absoluteValue =
    Math.abs(value);

  const formatted =
    new Intl.NumberFormat(
      "en-KE",
      {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0,
      }
    ).format(
      absoluteValue
    );

  return value < 0
    ? `-${formatted}`
    : formatted;
}

export default function ProfitLossSummary() {
  const [
    statement,
    setStatement,
  ] =
    useState<IncomeStatementResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let cancelled = false;

    const loadIncomeStatement =
      async () => {
        try {
          setLoading(true);
          setError(null);

          const response =
            await apiGet<IncomeStatementResponse>(
              "/api/income-statement"
            );

          if (cancelled) {
            return;
          }

          if (!response.success) {
            throw new Error(
              response.message ??
                "Unable to load profit and loss statement."
            );
          }

          setStatement(
            response
          );
        } catch (err) {
          if (cancelled) {
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load profit and loss statement."
          );

          setStatement(
            null
          );
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void loadIncomeStatement();

    return () => {
      cancelled = true;
    };
  }, []);

  const revenue =
    toNumber(
      statement?.totals
        ?.revenue
    );

  const expenses =
    toNumber(
      statement?.totals
        ?.expenses
    );

  const netProfit =
    toNumber(
      statement?.totals
        ?.netProfit
    );

  const profitMargin =
    toNumber(
      statement?.totals
        ?.profitMargin
    );

  const grossProfit =
    revenue - expenses;

  const rows: Row[] = [
    {
      title:
        "Total Revenue",
      value:
        formatCurrency(
          revenue
        ),
      color:
        "text-[#20243A]",
    },
    {
      title:
        "Total Expenses",
      value:
        formatCurrency(
          -expenses
        ),
      color:
        "text-[#EF4444]",
    },
    {
      title:
        "Net Profit",
      value:
        formatCurrency(
          netProfit
        ),
      color:
        netProfit < 0
          ? "text-[#EF4444]"
          : "text-[#16A34A]",
    },
    {
      title:
        "Profit Margin",
      value:
        `${profitMargin.toFixed(
          1
        )}%`,
      color:
        "text-[#20243A]",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Profit & Loss Summary
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Current financial period
          </p>
        </div>

        {loading && (
          <Loader2
            className="animate-spin text-[#666B84]"
            size={18}
          />
        )}
      </div>

      {error ? (
        <div className="flex min-h-[20rem] items-center justify-center">
          <div className="max-w-sm text-center">
            <AlertCircle
              className="mx-auto mb-3 text-red-500"
              size={24}
            />

            <p className="font-medium text-red-700">
              Unable to load P&L
            </p>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex min-h-[20rem] items-center justify-center text-sm text-[#666B84]">
          Loading profit and loss...
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {rows.map(
              (row) => (
                <div
                  key={row.title}
                  className="flex items-center justify-between border-b border-[#ECECF3] pb-3"
                >
                  <span className="text-[#666B84]">
                    {row.title}
                  </span>

                  <span
                    className={`font-semibold ${row.color}`}
                  >
                    {row.value}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="mt-5 rounded-xl bg-[#F8F9FC] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#666B84]">
                Revenue after expenses
              </span>

              <span
                className={`font-semibold ${
                  grossProfit < 0
                    ? "text-[#EF4444]"
                    : "text-[#16A34A]"
                }`}
              >
                {formatCurrency(
                  grossProfit
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href =
                "/reports/income-statement";
            }}
            className="mt-6 text-sm font-medium text-[#20243A] transition hover:text-[#5a4de0]"
          >
            View Full P&L Statement →
          </button>
        </>
      )}
    </div>
  );
}