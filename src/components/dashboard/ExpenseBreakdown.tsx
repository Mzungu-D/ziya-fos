import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { authenticatedFetch } from "../../lib/auth";

interface Expense {
  id: string;
  category?: string | null;
  amount: number | string;
  expenseDate?: string;
  status?: string;
}

interface ExpenseResponse {
  success: boolean;
  expenses?: Expense[];
  message?: string;
}

interface ExpenseCategory {
  name: string;
  value: number;
  amount: number;
}

const COLORS = [
  "#20243A",
  "#16A34A",
  "#F59E0B",
  "#EF4444",
  "#6366F1",
  "#0D9488",
  "#8B5CF6",
  "#94A3B8",
];

async function apiGet<T>(
  endpoint: string
): Promise<T> {
  const response =
    await authenticatedFetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    });

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
      value.replace(/,/g, "")
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function isCurrentMonth(
  expenseDate?: string
): boolean {
  if (!expenseDate) {
    return false;
  }

  const date = new Date(expenseDate);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth()
  );
}

function formatCurrency(
  value: number
): string {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function buildCategoryData(
  expenses: Expense[]
): ExpenseCategory[] {
  const categoryTotals =
    new Map<string, number>();

  for (const expense of expenses) {
    if (
      !isCurrentMonth(
        expense.expenseDate
      )
    ) {
      continue;
    }

    const category =
      expense.category?.trim() ||
      "Other";

    const amount =
      toNumber(expense.amount);

    if (amount <= 0) {
      continue;
    }

    categoryTotals.set(
      category,
      (categoryTotals.get(category) ??
        0) + amount
    );
  }

  const total = Array.from(
    categoryTotals.values()
  ).reduce(
    (sum, amount) =>
      sum + amount,
    0
  );

  if (total <= 0) {
    return [];
  }

  return Array.from(
    categoryTotals.entries()
  )
    .map(
      ([name, amount]) => ({
        name,
        amount,
        value:
          (amount / total) * 100,
      })
    )
    .sort(
      (a, b) =>
        b.amount - a.amount
    );
}

export default function ExpenseBreakdown() {
  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadExpenses =
      async () => {
        try {
          setLoading(true);
          setError(null);

          const response =
            await apiGet<ExpenseResponse>(
              "/api/expenses"
            );

          if (cancelled) {
            return;
          }

          if (!response.success) {
            throw new Error(
              response.message ??
                "Unable to load expenses."
            );
          }

          setExpenses(
            response.expenses ?? []
          );
        } catch (err) {
          if (cancelled) {
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load expenses."
          );

          setExpenses([]);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void loadExpenses();

    return () => {
      cancelled = true;
    };
  }, []);

  const data =
    useMemo(
      () =>
        buildCategoryData(
          expenses
        ),
      [expenses]
    );

  const totalExpenses =
    useMemo(
      () =>
        data.reduce(
          (total, item) =>
            total + item.amount,
          0
        ),
      [data]
    );

  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#20243A]">
          Expense Breakdown
        </h2>

        <p className="text-sm text-[#666B84]">
          Distribution of current-month expenses
        </p>
      </div>

      {error ? (
        <div className="flex min-h-[28rem] items-center justify-center">
          <div className="max-w-sm text-center">
            <AlertCircle
              className="mx-auto mb-3 text-red-500"
              size={24}
            />

            <p className="font-medium text-red-700">
              Unable to load expenses
            </p>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex min-h-[28rem] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-[#666B84]">
            <Loader2
              className="animate-spin"
              size={18}
            />

            Loading expenses...
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex min-h-[28rem] items-center justify-center">
          <div className="text-center">
            <p className="font-medium text-[#20243A]">
              No expenses this month
            </p>

            <p className="mt-1 text-sm text-[#666B84]">
              Expense categories will appear here when expenses are recorded.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {data.map(
                    (item, index) => (
                      <Cell
                        key={item.name}
                        fill={
                          COLORS[
                            index %
                              COLORS.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip
                  formatter={(
                    value,
                    name
                  ) => [
                    `${Number(
                      value
                    ).toFixed(1)}%`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-[#666B84]">
                  Total
                </p>

                <p className="mt-1 text-lg font-bold text-[#20243A]">
                  {formatCurrency(
                    totalExpenses
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {data.map(
              (item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          COLORS[
                            index %
                              COLORS.length
                          ],
                      }}
                    />

                    <span className="truncate text-sm text-[#666B84]">
                      {item.name}
                    </span>
                  </div>

                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[#666B84]">
                      {formatCurrency(
                        item.amount
                      )}
                    </span>

                    <span className="min-w-[48px] text-right text-sm font-semibold text-[#20243A]">
                      {item.value.toFixed(
                        1
                      )}
                      %
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}