import { useEffect, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
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
  const value =
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
    value.includes(keyword)
  );
}

function formatRelativeTime(
  date: string
): string {
  const timestamp =
    new Date(date).getTime();

  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const difference = Math.max(
    0,
    Date.now() - timestamp
  );

  const minutes = Math.floor(
    difference / 60000
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} ${
      minutes === 1
        ? "minute"
        : "minutes"
    } ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} ${
      hours === 1
        ? "hour"
        : "hours"
    } ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 30) {
    return `${days} ${
      days === 1
        ? "day"
        : "days"
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

function getActivityLabel(
  transaction: Transaction
): string {
  if (transaction.description?.trim()) {
    return transaction.description;
  }

  if (transaction.type?.trim()) {
    return transaction.type;
  }

  return "Financial transaction";
}

export default function ActivityFeed() {
  const navigate = useNavigate();

  const [activities, setActivities] =
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

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to load activity."
          );
        }

        if (!cancelled) {
          setActivities(
            Array.isArray(data.transactions)
              ? data.transactions
              : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load activity."
          );
        }
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
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Activity Feed
          </h2>

          <p className="text-xs text-[#8A8FA6] mt-1">
            Latest financial activity in this organization
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
        <div className="py-8 text-center">
          <p className="text-sm text-[#666B84]">
            Loading activity...
          </p>
        </div>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-red-50 flex items-center justify-center">
            <Activity
              size={20}
              className="text-red-500"
            />
          </div>

          <p className="text-sm font-semibold text-[#20243A]">
            Unable to load activity
          </p>

          <p className="text-xs text-[#666B84] mt-1">
            {error}
          </p>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading &&
        !error &&
        activities.length === 0 && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-[#F5F6FA] flex items-center justify-center">
              <ReceiptText
                size={20}
                className="text-[#8A8FA6]"
              />
            </div>

            <p className="text-sm font-semibold text-[#20243A]">
              No recent activity
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              Financial activity will appear here
              automatically.
            </p>
          </div>
        )}

      {/* ACTIVITY LIST */}
      {!loading &&
        !error &&
        activities.length > 0 && (
          <div className="space-y-1">
            {activities.map(
              (activity) => {
                const inflow =
                  isInflow(
                    activity.type,
                    activity.description
                  );

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        "/dashboard/general-ledger"
                      )
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-[#FAFAFC] transition border border-transparent hover:border-[#ECECF3]"
                  >
                    {/* ICON */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        inflow
                          ? "bg-green-50"
                          : "bg-red-50"
                      }`}
                    >
                      {inflow ? (
                        <ArrowDownCircle
                          size={19}
                          className="text-[#16A34A]"
                        />
                      ) : (
                        <ArrowUpCircle
                          size={19}
                          className="text-[#EF4444]"
                        />
                      )}
                    </div>

                    {/* ACTIVITY DETAILS */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#20243A] truncate">
                        {getActivityLabel(
                          activity
                        )}
                      </p>

                      <p className="text-xs text-[#666B84] mt-1 truncate">
                        {activity.reference ||
                          "Financial transaction"}
                      </p>

                      <p className="text-[11px] text-[#8A8FA6] mt-1">
                        {formatRelativeTime(
                          activity.createdAt
                        )}
                      </p>
                    </div>

                    {/* AMOUNT */}
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold ${
                          inflow
                            ? "text-[#16A34A]"
                            : "text-[#EF4444]"
                        }`}
                      >
                        {inflow ? "+" : "-"}
                        {formatCurrency(
                          activity.amount
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