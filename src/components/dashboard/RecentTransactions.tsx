import { useEffect, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ReceiptText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Math.abs(Number(amount) || 0));
}

function isInflow(
  type: string,
  description: string
): boolean {
  const normalized =
    `${type} ${description}`
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

function formatDate(date: string): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

export default function RecentTransactions() {
  const navigate = useNavigate();

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTransactions =
      async () => {
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
              Array.isArray(
                data.transactions
              )
                ? data.transactions
                : []
            );
          }
        } catch (err) {
          if (cancelled) {
            return;
          }

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
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Recent Transactions
          </h2>

          <p className="text-xs text-[#8A8FA6] mt-1">
            Latest posted financial transactions
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              "/dashboard/general-ledger"
            )
          }
          className="text-[#20243A] text-sm font-medium hover:text-[#5a4de0] transition"
        >
          View All
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="py-10 text-center">
          <p className="text-sm text-[#666B84]">
            Loading transactions...
          </p>
        </div>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-red-50 flex items-center justify-center">
            <ReceiptText
              size={20}
              className="text-red-500"
            />
          </div>

          <p className="text-sm font-semibold text-[#20243A]">
            Unable to load transactions
          </p>

          <p className="text-xs text-[#666B84] mt-1">
            {error}
          </p>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading &&
        !error &&
        transactions.length === 0 && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-[#F5F6FA] flex items-center justify-center">
              <ReceiptText
                size={20}
                className="text-[#8A8FA6]"
              />
            </div>

            <p className="text-sm font-semibold text-[#20243A]">
              No recent transactions
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              Posted transactions will
              automatically appear here.
            </p>
          </div>
        )}

      {/* TRANSACTIONS */}
      {!loading &&
        !error &&
        transactions.length > 0 && (
          <div className="space-y-2">
            {transactions.map(
              (transaction) => {
                const inflow =
                  isInflow(
                    transaction.type,
                    transaction.description
                  );

                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        "/dashboard/general-ledger"
                      )
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-[#FAFAFC] transition border border-transparent hover:border-[#ECECF3]"
                  >
                    {/* TRANSACTION ICON */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        inflow
                          ? "bg-green-50"
                          : "bg-red-50"
                      }`}
                    >
                      {inflow ? (
                        <ArrowDownCircle
                          size={20}
                          className="text-[#16A34A]"
                        />
                      ) : (
                        <ArrowUpCircle
                          size={20}
                          className="text-[#EF4444]"
                        />
                      )}
                    </div>

                    {/* TRANSACTION INFORMATION */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[#20243A] font-semibold text-sm truncate">
                        {transaction.description ||
                          transaction.type ||
                          "Financial Transaction"}
                      </p>

                      <p className="text-[#666B84] text-xs truncate mt-1">
                        {transaction.reference ||
                          "No reference"}
                        {" · "}
                        {formatDate(
                          transaction.createdAt
                        )}
                      </p>
                    </div>

                    {/* AMOUNT */}
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
                          transaction.amount
                        )}
                      </p>

                      <p className="text-[11px] text-[#8A8FA6] mt-1">
                        {inflow
                          ? "Money In"
                          : "Money Out"}
                      </p>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
    </div>
  );
}