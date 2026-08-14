import {
  DollarSign,
  TrendingUp,
  Wallet,
  Landmark,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

interface IncomeStatementResponse {
  success: boolean;
  totals?: {
    revenue?: number;
    expenses?: number;
    netProfit?: number;
    profitMargin?: number;
  };
  meta?: {
    currency?: string;
  };
  message?: string;
}

interface BankAccount {
  id: string;
  name?: string;
  accountName?: string;
  currentBalance?: number | string;
  balance?: number | string;
  currency?: string;
  status?: string;
}

interface BankAccountsResponse {
  success: boolean;
  accounts?: BankAccount[];
  data?: BankAccount[];
  message?: string;
}

interface KPIData {
  revenue: number;
  expenses: number;
  netProfit: number;
  cashBalance: number;
  currency: string;
}

interface KPIState {
  data: KPIData | null;
  loading: boolean;
  error: string | null;
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

function formatCurrency(
  value: number,
  currency: string
): string {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function extractBankAccounts(
  response: BankAccountsResponse
): BankAccount[] {
  if (
    Array.isArray(
      response.accounts
    )
  ) {
    return response.accounts;
  }

  if (
    Array.isArray(response.data)
  ) {
    return response.data;
  }

  return [];
}

export default function KPICards() {
  const [state, setState] =
    useState<KPIState>({
      data: null,
      loading: true,
      error: null,
    });

  useEffect(() => {
    let cancelled = false;

    const loadDashboardKPIs =
      async () => {
        try {
          setState({
            data: null,
            loading: true,
            error: null,
          });

          const [
            incomeStatement,
            bankAccounts,
          ] = await Promise.all([
            apiGet<IncomeStatementResponse>(
              "/api/income-statement"
            ),
            apiGet<BankAccountsResponse>(
              "/api/bank-accounts"
            ),
          ]);

          if (cancelled) {
            return;
          }

          const revenue =
            toNumber(
              incomeStatement
                .totals
                ?.revenue
            );

          const expenses =
            toNumber(
              incomeStatement
                .totals
                ?.expenses
            );

          const netProfit =
            toNumber(
              incomeStatement
                .totals
                ?.netProfit
            );

          const accounts =
            extractBankAccounts(
              bankAccounts
            );

          const cashBalance =
            accounts.reduce(
              (
                total,
                account
              ) => {
                if (
                  account.status &&
                  account.status !==
                    "ACTIVE"
                ) {
                  return total;
                }

                return (
                  total +
                  toNumber(
                    account.currentBalance ??
                      account.balance
                  )
                );
              },
              0
            );

          const currency =
            incomeStatement
              .meta
              ?.currency ||
            accounts.find(
              (account) =>
                account.currency
            )?.currency ||
            "KES";

          setState({
            data: {
              revenue,
              expenses,
              netProfit,
              cashBalance,
              currency,
            },
            loading: false,
            error: null,
          });
        } catch (error) {
          if (cancelled) {
            return;
          }

          setState({
            data: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load dashboard financial data.",
          });
        }
      };

    void loadDashboardKPIs();

    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      title:
        "Total Revenue",
      value:
        state.data
          ? formatCurrency(
              state.data.revenue,
              state.data.currency
            )
          : "—",
      color:
        "text-[#20243A]",
      bg:
        "bg-[#0D9488]/10",
      icon:
        DollarSign,
    },
    {
      title:
        "Total Expenses",
      value:
        state.data
          ? formatCurrency(
              state.data.expenses,
              state.data.currency
            )
          : "—",
      color:
        "text-[#EF4444]",
      bg:
        "bg-[#EF4444]/10",
      icon:
        Wallet,
    },
    {
      title:
        "Net Profit",
      value:
        state.data
          ? formatCurrency(
              state.data.netProfit,
              state.data.currency
            )
          : "—",
      color:
        state.data &&
        state.data.netProfit < 0
          ? "text-[#EF4444]"
          : "text-[#16A34A]",
      bg:
        "bg-[#16A34A]/10",
      icon:
        TrendingUp,
    },
    {
      title:
        "Cash Balance",
      value:
        state.data
          ? formatCurrency(
              state.data.cashBalance,
              state.data.currency
            )
          : "—",
      color:
        "text-[#F59E0B]",
      bg:
        "bg-[#F59E0B]/10",
      icon:
        Landmark,
    },
  ];

  if (state.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 shrink-0 text-red-500"
            size={20}
          />

          <div>
            <p className="font-medium text-red-700">
              Unable to load financial summary
            </p>

            <p className="mt-1 text-sm text-red-600">
              {state.error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon =
          card.icon;

        return (
          <div
            key={card.title}
            className="rounded-2xl border border-[#ECECF3] bg-white p-5 transition-all hover:border-[#20243A]/40 hover:shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.bg}`}
              >
                <Icon
                  className={
                    card.color
                  }
                  size={20}
                />
              </div>

              {state.loading && (
                <Loader2
                  className="animate-spin text-[#666B84]"
                  size={17}
                />
              )}
            </div>

            <p className="text-sm text-[#666B84]">
              {card.title}
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[#20243A]">
              {card.value}
            </h2>

            <div className="mt-3 text-sm">
              <span className="text-[#666B84]">
                Current period
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}