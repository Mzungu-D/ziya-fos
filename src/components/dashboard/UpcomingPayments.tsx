import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { CalendarClock } from "lucide-react";
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
  payables: Payable[];
  message?: string;
};

type PaymentStatus =
  | "Due Soon"
  | "Scheduled"
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
  }).format(amount);
};

const formatDate = (
  date: string
): string => {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Invalid date";
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
    getDaysUntilDue(payable.dueDate);

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

  return "Scheduled";
};

const getStatusClasses = (
  status: PaymentStatus
): string => {
  switch (status) {
    case "Due Soon":
      return "bg-red-500/20 text-red-400";

    case "Scheduled":
      return "bg-[#0D9488]/20 text-[#20243A]";

    case "Pending":
    default:
      return "bg-yellow-500/20 text-yellow-500";
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

  useEffect(() => {
    let cancelled = false;

    const loadPayables = async () => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await authenticatedFetch(
            `${API_URL}/api/accounts-payable`,
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
              "Failed to load upcoming payments."
          );
        }

        if (!data.success) {
          throw new Error(
            data.message ||
              "Failed to load upcoming payments."
          );
        }

        if (!cancelled) {
          setPayables(
            Array.isArray(data.payables)
              ? data.payables
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
            : "Failed to load upcoming payments."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPayables();

    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingPayments = useMemo(() => {
    return payables
      .filter((payable) => {
        const outstanding =
          Number(
            payable.outstandingBalance
          );

        if (
          !Number.isFinite(outstanding) ||
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
          new Date(a.dueDate).getTime() -
          new Date(b.dueDate).getTime()
      )
      .slice(0, 4);
  }, [payables]);

  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <CalendarClock
              className="text-orange-400"
              size={24}
            />
          </div>

          <div>
            <h2 className="text-[#20243A] text-xl font-bold">
              Upcoming Payments
            </h2>

            <p className="text-[#666B84] text-sm">
              Bills and scheduled payments
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
          className="text-[#20243A] text-sm font-medium hover:text-[#5a4de0] transition"
        >
          View All
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center">
          <p className="text-sm text-[#666B84]">
            Loading upcoming payments...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-red-500">
            Unable to load payments
          </p>

          <p className="text-xs text-[#666B84] mt-1">
            {error}
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        upcomingPayments.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-[#20243A]">
              No upcoming payments
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              Upcoming supplier bills will appear here.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        upcomingPayments.length > 0 && (
          <div className="space-y-4">
            {upcomingPayments.map(
              (payment) => {
                const status =
                  getPaymentStatus(
                    payment
                  );

                const outstanding =
                  Number(
                    payment.outstandingBalance
                  );

                const vendorName =
                  payment.vendor?.name ||
                  payment.vendor?.companyName;

                const description =
                  payment.description?.trim() ||
                  vendorName ||
                  payment.invoiceNumber;

                return (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center border-b border-[#ECECF3] pb-4 last:border-none"
                  >
                    <div className="min-w-0 pr-4">
                      <h3 className="text-[#20243A] font-medium truncate">
                        {description}
                      </h3>

                      <p className="text-[#666B84] text-sm">
                        {formatDate(
                          payment.dueDate
                        )}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[#20243A] font-semibold">
                        {formatCurrency(
                          outstanding
                        )}
                      </p>

                      <span
                        className={`inline-block text-xs px-3 py-1 rounded-full ${getStatusClasses(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
    </div>
  );
}