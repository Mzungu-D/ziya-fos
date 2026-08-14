import { useEffect, useState } from "react";
import { authenticatedFetch } from "../../lib/auth";

interface Transaction {
  id: string;
  reference: string;
  description: string;
  amount: number;
  type: string;
  createdAt: string;
}

interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  message?: string;
}

const API_URL =
  import.meta.env.VITE_API_URL || "";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function isInflow(type: string) {
  const normalized = type
    .toLowerCase()
    .replace(/[_-]/g, " ");

  return [
    "payment received",
    "customer payment",
    "receipt",
    "income",
    "revenue",
    "deposit",
    "inflow",
    "credit",
  ].some((keyword) =>
    normalized.includes(keyword)
  );
}

function formatDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RecentTransactions() {
  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTransactions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await authenticatedFetch(
            `${API_URL}/api/transactions?limit=5`
          );

        const data =
          (await response.json()) as TransactionsResponse;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load recent transactions."
          );
        }

        if (!data.success) {
          throw new Error(
            data.message ||
              "Failed to load recent transactions."
          );
        }

        if (!cancelled) {
          setTransactions(
            Array.isArray(data.transactions)
              ? data.transactions
              : []
          );
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load recent transactions."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#20243A]">
          Recent Transactions
        </h2>

        <button
          type="button"
          onClick={() => {
            window.location.href =
              "/transactions";
          }}
          className="text-[#20243A] text-sm font-medium hover:text-[#5a4de0] transition"
        >
          View All
        </button>
      </div>

      {loading && (
        <div className="py-10 text-center">
          <p className="text-sm text-[#666B84]">
            Loading transactions...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-red-500">
            Unable to load transactions
          </p>

          <p className="text-xs text-[#666B84] mt-1">
            {error}
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        transactions.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-[#20243A]">
              No recent transactions
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              Posted transactions will appear here.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        transactions.length > 0 && (
          <div className="space-y-4">
            {transactions.map((tx) => {
              const inflow =
                isInflow(tx.type);

              return (
                <div
                  key={tx.id}
                  className="flex justify-between items-center border-b border-[#ECECF3] pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-[#20243A] font-medium text-sm truncate">
                      {tx.reference}
                    </p>

                    <p className="text-[#666B84] text-sm truncate">
                      {tx.description ||
                        tx.type}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`font-semibold text-sm ${
                        inflow
                          ? "text-[#16A34A]"
                          : "text-[#EF4444]"
                      }`}
                    >
                      {inflow ? "+" : "-"}
                      {formatCurrency(
                        tx.amount
                      )}
                    </p>

                    <p className="text-[#666B84] text-sm">
                      {formatDate(
                        tx.createdAt
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}