import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { authenticatedFetch } from "../../lib/auth";

type Payable = {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  outstandingBalance: number;
  dueDate: string;
  paymentStatus: string;
  status: string;
  vendor?: {
    id: string;
    name?: string;
    companyName?: string;
  } | null;
};

type PayablesResponse = {
  success: boolean;
  count: number;
  total?: number;
  payables: Payable[];
  message?: string;
};

type PaymentStatus =
  | "Due Soon"
  | "Due Later"
  | "Pending";

const API_URL =
  import.meta.env.VITE_API_URL || "";

const formatCurrency = (
  amount: number
): string => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(
    Number(amount) || 0
  );
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

const getDaysUntilDue = (
  dueDate: string
): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);

  if (Number.isNaN(due.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  due.setHours(0, 0, 0, 0);

  return Math.ceil(
    (due.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
};

const getPaymentStatus = (
  payable: Payable
): PaymentStatus => {
  const daysUntilDue =
    getDaysUntilDue(
      payable.dueDate
    );

  if (
    payable.status !== "APPROVED"
  ) {
    return "Pending";
  }

  if (
    daysUntilDue >= 0 &&
    daysUntilDue <= 7
  ) {
    return "Due Soon";
  }

  return "Due Later";
};

const getStatusClasses = (
  status: PaymentStatus
): string => {
  switch (status) {
    case "Due Soon":
      return "bg-red-50 text-red-700 border-red-100";

    case "Due Later":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";

    case "Pending":
    default:
      return "bg-amber-50 text-amber-700 border-amber-100";
  }
};

export default function UpcomingPayments() {
  const navigate = useNavigate();

  const [payables, setPayables] =
    useState<Payable[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadPayables = async () => {
    try {
      setLoading(true);
      setError(null);

      const response =
        await authenticatedFetch(
          `${API_URL}/api/accounts-payable?page=1&pageSize=20`,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        (await response.json()) as PayablesResponse;

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load upcoming payments."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to load upcoming payments."
        );
      }

      setPayables(
        Array.isArray(
          data.payables
        )
          ? data.payables
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load upcoming payments."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayables();
  }, []);

  const upcomingPayments =
    useMemo(() => {
      return payables
        .filter((payable) => {
          const outstanding =
            Number(
              payable.outstandingBalance
            );

          if (
            !Number.isFinite(
              outstanding
            ) ||
            outstanding <= 0
          ) {
            return false;
          }

          return (
            getDaysUntilDue(
              payable.dueDate
            ) >= 0
          );
        })
        .sort(
          (a, b) =>
            new Date(
              a.dueDate
            ).getTime() -
            new Date(
              b.dueDate
            ).getTime()
        )
        .slice(0, 4);
    }, [payables]);

  const totalUpcoming =
    upcomingPayments.reduce(
      (total, payment) =>
        total +
        (Number(
          payment.outstandingBalance
        ) || 0),
      0
    );

  return (
    <section className="bg-white border border-[#E7E9F0] rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center shrink-0">
            <CalendarClock
              size={19}
              className="text-[#EA580C]"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#20243A]">
              Upcoming Payments
            </h2>

            <p className="text-sm text-[#7B8199] mt-0.5">
              Outstanding supplier obligations due soon
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              "/dashboard/accounts-payable"
            )
          }
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#20243A] hover:text-[#5961A8] transition shrink-0"
        >
          View All
          <ArrowRight size={16} />
        </button>
      </div>

      {!loading &&
        !error &&
        upcomingPayments.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-[#FAFBFC] border border-[#EEF0F4] px-4 py-3">
            <div>
              <p className="text-xs text-[#7B8199]">
                Next obligations
              </p>

              <p className="text-sm font-semibold text-[#20243A] mt-0.5">
                {upcomingPayments.length}{" "}
                {upcomingPayments.length === 1
                  ? "payment"
                  : "payments"}
              </p>
            </div>

            <p className="text-sm font-bold text-[#20243A]">
              {formatCurrency(
                totalUpcoming
              )}
            </p>
          </div>
        )}

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="flex items-center justify-between gap-4 border-b border-[#EEF0F4] pb-4 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#F1F3F7] animate-pulse shrink-0" />

                <div className="space-y-2">
                  <div className="h-3 w-32 bg-[#F1F3F7] rounded animate-pulse" />
                  <div className="h-3 w-24 bg-[#F1F3F7] rounded animate-pulse" />
                </div>
              </div>

              <div className="h-3 w-20 bg-[#F1F3F7] rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-700">
                Unable to load payments
              </p>

              <p className="text-xs text-red-600 mt-1">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadPayables()
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
        upcomingPayments.length === 0 && (
          <div className="min-h-[230px] flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#DDE1EA] bg-[#FAFBFC] px-6">
            <div className="w-14 h-14 rounded-full bg-white border border-[#E6E9F0] flex items-center justify-center shadow-sm">
              <WalletCards
                size={24}
                className="text-[#8B91A8]"
              />
            </div>

            <h3 className="mt-4 text-base font-semibold text-[#20243A]">
              No upcoming payments
            </h3>

            <p className="mt-1 max-w-sm text-sm text-[#7B8199]">
              Supplier bills with an outstanding balance and a future due date will appear here.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dashboard/accounts-payable"
                )
              }
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#DCE0E9] bg-white px-4 py-2 text-sm font-semibold text-[#20243A] hover:bg-[#F8F9FB] transition"
            >
              Open Accounts Payable
              <ArrowRight size={15} />
            </button>
          </div>
        )}

      {!loading &&
        !error &&
        upcomingPayments.length > 0 && (
          <div className="space-y-0">
            {upcomingPayments.map(
              (payment) => {
                const status =
                  getPaymentStatus(
                    payment
                  );

                const outstanding =
                  Number(
                    payment.outstandingBalance
                  ) || 0;

                const vendorName =
                  payment.vendor?.name ||
                  payment.vendor?.companyName;

                const title =
                  vendorName ||
                  payment.description?.trim() ||
                  payment.invoiceNumber;

                const daysUntilDue =
                  getDaysUntilDue(
                    payment.dueDate
                  );

                return (
                  <button
                    type="button"
                    key={payment.id}
                    onClick={() =>
                      navigate(
                        "/dashboard/accounts-payable"
                      )
                    }
                    className="w-full text-left flex items-center justify-between gap-4 py-4 border-b border-[#EEF0F4] last:border-0 hover:bg-[#FAFBFC] transition rounded-lg px-2 -mx-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#FFF7ED] flex items-center justify-center shrink-0">
                        <CalendarClock
                          size={17}
                          className="text-[#EA580C]"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#20243A] truncate">
                          {title}
                        </p>

                        <p className="text-xs text-[#7B8199] mt-1 truncate">
                          {payment.invoiceNumber}
                          {" • "}
                          {formatDate(
                            payment.dueDate
                          )}
                        </p>

                        <span
                          className={`inline-flex mt-2 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#20243A]">
                        {formatCurrency(
                          outstanding
                        )}
                      </p>

                      <p className="text-[11px] text-[#969CAF] mt-1">
                        {daysUntilDue === 0
                          ? "Due today"
                          : daysUntilDue === 1
                          ? "Due tomorrow"
                          : `Due in ${daysUntilDue} days`}
                      </p>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
    </section>
  );
}
