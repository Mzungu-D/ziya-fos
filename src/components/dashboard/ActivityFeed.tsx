import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { authenticatedFetch } from "../../lib/auth";

type ActivityTransaction = {
  id: string;
  reference: string;
  description: string;
  amount: number;
  transactionDate: string;
  createdAt: string;
  status: string;
  entryType: "JOURNAL";
};

type ActivityResponse = {
  success: boolean;
  transactions: ActivityTransaction[];
  message?: string;
};

const API_URL =
  import.meta.env.VITE_API_URL || "";

const formatCurrency = (
  amount: number
): string => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Math.abs(Number(amount) || 0));
};

const formatDate = (
  date: string
): string => {
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
};

const formatRelativeTime = (
  date: string
): string => {
  const timestamp =
    new Date(date).getTime();

  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const difference =
    Date.now() - timestamp;

  if (difference < 0) {
    return "Just now";
  }

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

  return formatDate(date);
};

const getStatusClasses = (
  status: string
): string => {
  switch (
    status.toUpperCase()
  ) {
    case "POSTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";

    case "APPROVED":
      return "bg-blue-50 text-blue-700 border-blue-100";

    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
};

export default function ActivityFeed() {
  const navigate = useNavigate();

  const [transactions, setTransactions] =
    useState<ActivityTransaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      const response =
        await authenticatedFetch(
          `${API_URL}/api/dashboard/recent-transactions?limit=6`
        );

      const data =
        (await response.json()) as ActivityResponse;

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load financial activity."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to load financial activity."
        );
      }

      setTransactions(
        Array.isArray(
          data.transactions
        )
          ? data.transactions
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load financial activity."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!mounted) {
        return;
      }

      await loadActivity();
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="bg-white border border-[#E7E9F0] rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F4F5F9] flex items-center justify-center shrink-0">
              <FileText
                size={19}
                className="text-[#5961A8]"
              />
            </div>

            <div className="min-w-0">
              <h2 className="text-xl font-bold text-[#20243A]">
                Activity Feed
              </h2>

              <p className="text-sm text-[#7B8199] mt-0.5">
                Latest posted accounting activity
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              "/dashboard/general-ledger"
            )
          }
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#20243A] hover:text-[#5961A8] transition shrink-0"
        >
          View All
          <ArrowRight size={16} />
        </button>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="flex items-center justify-between gap-4 border-b border-[#EEF0F4] pb-4 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#F1F3F7] animate-pulse shrink-0" />

                <div className="space-y-2 min-w-0">
                  <div className="h-3 w-32 bg-[#F1F3F7] rounded animate-pulse" />
                  <div className="h-3 w-48 bg-[#F1F3F7] rounded animate-pulse" />
                </div>
              </div>

              <div className="h-3 w-20 bg-[#F1F3F7] rounded animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-700">
                Unable to load activity
              </p>

              <p className="text-xs text-red-600 mt-1">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadActivity()
              }
              className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 hover:text-red-800"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading &&
        !error &&
        transactions.length === 0 && (
          <div className="min-h-[230px] flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#DDE1EA] bg-[#FAFBFC] px-6">
            <div className="w-14 h-14 rounded-full bg-white border border-[#E6E9F0] flex items-center justify-center shadow-sm">
              <FileText
                size={24}
                className="text-[#8B91A8]"
              />
            </div>

            <h3 className="mt-4 text-base font-semibold text-[#20243A]">
              No recent activity
            </h3>

            <p className="mt-1 max-w-sm text-sm text-[#7B8199]">
              Posted and approved financial activity will appear here automatically.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dashboard/general-ledger"
                )
              }
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#DCE0E9] bg-white px-4 py-2 text-sm font-semibold text-[#20243A] hover:bg-[#F8F9FB] transition"
            >
              Open General Ledger
              <ArrowRight size={15} />
            </button>
          </div>
        )}

      {!loading &&
        !error &&
        transactions.length > 0 && (
          <div className="space-y-0">
            {transactions.map(
              (transaction) => (
                <button
                  type="button"
                  key={transaction.id}
                  onClick={() =>
                    navigate(
                      "/dashboard/general-ledger"
                    )
                  }
                  className="w-full text-left flex items-center justify-between gap-4 py-4 border-b border-[#EEF0F4] last:border-0 hover:bg-[#FAFBFC] transition rounded-lg px-2 -mx-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#F4F5F9] flex items-center justify-center shrink-0">
                      <FileText
                        size={17}
                        className="text-[#5961A8]"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#20243A] truncate">
                        {transaction.reference}
                      </p>

                      <p className="text-xs text-[#7B8199] mt-1 truncate">
                        {transaction.description}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </span>

                        <span className="text-[11px] text-[#969CAF]">
                          {formatRelativeTime(
                            transaction.createdAt
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#20243A]">
                      {formatCurrency(
                        transaction.amount
                      )}
                    </p>

                    <p className="text-[11px] text-[#969CAF] mt-1">
                      {formatDate(
                        transaction.transactionDate
                      )}
                    </p>
                  </div>
                </button>
              )
            )}
          </div>
        )}
    </section>
  );
}
