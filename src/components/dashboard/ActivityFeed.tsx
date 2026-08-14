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

function formatRelativeTime(
  date: string
): string {
  const timestamp =
    new Date(date).getTime();

  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const difference =
    Date.now() - timestamp;

  const minutes = Math.floor(
    difference / 60000
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} ${
      minutes === 1 ? "minute" : "minutes"
    } ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} ${
      hours === 1 ? "hour" : "hours"
    } ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 30) {
    return `${days} ${
      days === 1 ? "day" : "days"
    } ago`;
  }

  return new Date(date).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function getActivityTitle(
  transaction: Transaction
): string {
  const type =
    transaction.type?.trim();

  if (type) {
    return type
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  return "Financial Transaction";
}

export default function ActivityFeed() {
  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadActivity = async () => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await authenticatedFetch(
            `${API_URL}/api/transactions?limit=6`
          );

        const data =
          (await response.json()) as TransactionsResponse;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load activity."
          );
        }

        if (!data.success) {
          throw new Error(
            data.message ||
              "Failed to load activity."
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
            : "Failed to load activity."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#20243A]">
          Activity Feed
        </h2>

        <button
          type="button"
          onClick={() => {
            window.location.href =
              "/transactions";
          }}
          className="text-[#20243A] text-sm hover:text-[#5a4de0] transition"
        >
          View All
        </button>
      </div>

      {loading && (
        <div className="py-8 text-center">
          <p className="text-sm text-[#666B84]">
            Loading activity...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-red-500">
            Unable to load activity
          </p>

          <p className="text-xs text-[#666B84] mt-1">
            {error}
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        transactions.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-[#20243A]">
              No recent activity
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              Financial activity will appear here.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        transactions.length > 0 && (
          <div className="space-y-5">
            {transactions.map(
              (transaction) => (
                <div
                  key={transaction.id}
                  className="border-b border-[#ECECF3] pb-4 last:border-0"
                >
                  <p className="text-[#20243A] font-medium">
                    {getActivityTitle(
                      transaction
                    )}
                  </p>

                  <p className="text-[#666B84] text-sm mt-1">
                    {transaction.description ||
                      transaction.reference}
                  </p>

                  <p className="text-[#666B84] text-xs mt-2">
                    {formatRelativeTime(
                      transaction.createdAt
                    )}
                  </p>
                </div>
              )
            )}
          </div>
        )}
    </div>
  );
}