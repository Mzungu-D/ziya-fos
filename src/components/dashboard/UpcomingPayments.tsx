import { useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  Clock3,
  CircleAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { authenticatedFetch } from "../../lib/auth";

interface Payable {
  id: string;
  invoiceNumber?: string | null;
  vendorName?: string | null;
  vendor?: {
    name?: string | null;
  } | null;
  description?: string | null;
  amount?: number | null;
  totalAmount?: number | null;
  outstandingBalance?: number | null;
  dueDate?: string | null;
  status?: string | null;
}

interface PayablesResponse {
  success: boolean;
  accountsPayable?: Payable[];
  data?: Payable[];
  message?: string;
}

const API_URL =
  import.meta.env.VITE_API_URL || "";

function formatCurrency(
  amount: number
): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Math.abs(Number(amount) || 0));
}

function formatDate(
  date: string
): string {
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

function getDaysUntilDue(
  date: string
): number {
  const due = new Date(date);
  const today = new Date();

  if (Number.isNaN(due.getTime())) {
    return 999999;
  }

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.ceil(
    (due.getTime() -
      today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function getPaymentStatus(
  date: string
): {
  label: string;
  className: string;
} {
  const days =
    getDaysUntilDue(date);

  if (days <= 0) {
    return {
      label: "Due Today",
      className:
        "bg-red-50 text-red-600",
    };
  }

  if (days <= 7) {
    return {
      label: "Due Soon",
      className:
        "bg-amber-50 text-amber-600",
    };
  }

  return {
    label: "Scheduled",
    className:
      "bg-blue-50 text-blue-600",
  };
}

function getVendorName(
  payable: Payable
): string {
  return (
    payable.vendorName ||
    payable.vendor?.name ||
    payable.description ||
    "Vendor payment"
  );
}

function getAmount(
  payable: Payable
): number {
  if (
    typeof payable.outstandingBalance ===
    "number"
  ) {
    return payable.outstandingBalance;
  }

  if (
    typeof payable.totalAmount ===
    "number"
  ) {
    return payable.totalAmount;
  }

  return Number(payable.amount) || 0;
}

export default function UpcomingPayments() {
  const navigate = useNavigate();

  const [payments, setPayments] =
    useState<Payable[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPayments = async () => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await authenticatedFetch(
            `${API_URL}/api/accounts-payable`
          );

        const data =
          (await response.json()) as PayablesResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to load upcoming payments."
          );
        }

        const source =
          Array.isArray(
            data.accountsPayable
          )
            ? data.accountsPayable
            : Array.isArray(data.data)
              ? data.data
              : [];

        const today =
          new Date();

        today.setHours(
          0,
          0,
          0,
          0
        );

        const upcoming =
          source
            .filter((payment) => {
              if (
                !payment.dueDate
              ) {
                return false;
              }

              const dueDate =
                new Date(
                  payment.dueDate
                );

              if (
                Number.isNaN(
                  dueDate.getTime()
                )
              ) {
                return false;
              }

              dueDate.setHours(
                0,
                0,
                0,
                0
              );

              return (
                getAmount(payment) >
                  0 &&
                dueDate >= today
              );
            })
            .sort(
              (a, b) =>
                new Date(
                  a.dueDate as string
                ).getTime() -
                new Date(
                  b.dueDate as string
                ).getTime()
            )
            .slice(0, 4);

        if (!cancelled) {
          setPayments(upcoming);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load upcoming payments."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPayments();

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
            Upcoming Payments
          </h2>

          <p className="text-xs text-[#8A8FA6] mt-1">
            Outstanding supplier payments due soon
          </p>
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

      {/* LOADING */}
      {loading && (
        <div className="py-10 text-center">
          <p className="text-sm text-[#666B84]">
            Loading upcoming payments...
          </p>
        </div>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-red-50 flex items-center justify-center">
            <CircleAlert
              size={20}
              className="text-red-500"
            />
          </div>

          <p className="text-sm font-semibold text-[#20243A]">
            Unable to load payments
          </p>

          <p className="text-xs text-[#666B84] mt-1">
            {error}
          </p>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading &&
        !error &&
        payments.length === 0 && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-[#F5F6FA] flex items-center justify-center">
              <CalendarClock
                size={20}
                className="text-[#8A8FA6]"
              />
            </div>

            <p className="text-sm font-semibold text-[#20243A]">
              No upcoming payments
            </p>

            <p className="text-xs text-[#666B84] mt-1">
              Outstanding payments with future
              due dates will appear here.
            </p>
          </div>
        )}

      {/* PAYMENT LIST */}
      {!loading &&
        !error &&
        payments.length > 0 && (
          <div className="space-y-2">
            {payments.map((payment) => {
              const status =
                getPaymentStatus(
                  payment.dueDate as string
                );

              const days =
                getDaysUntilDue(
                  payment.dueDate as string
                );

              return (
                <button
                  key={payment.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      "/dashboard/accounts-payable"
                    )
                  }
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-[#FAFAFC] transition border border-transparent hover:border-[#ECECF3]"
                >
                  {/* ICON */}
                  <div className="w-10 h-10 rounded-full bg-[#F3F1FF] flex items-center justify-center shrink-0">
                    {days <= 7 ? (
                      <Clock3
                        size={19}
                        className="text-[#5A4DE0]"
                      />
                    ) : (
                      <CalendarClock
                        size={19}
                        className="text-[#5A4DE0]"
                      />
                    )}
                  </div>

                  {/* PAYMENT DETAILS */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#20243A] truncate">
                      {getVendorName(
                        payment
                      )}
                    </p>

                    <p className="text-xs text-[#666B84] mt-1 truncate">
                      {payment.invoiceNumber
                        ? `Invoice ${payment.invoiceNumber}`
                        : "Accounts payable"}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>

                      <span className="text-[11px] text-[#8A8FA6]">
                        {formatDate(
                          payment.dueDate as string
                        )}
                      </span>
                    </div>
                  </div>

                  {/* AMOUNT + ARROW */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#20243A]">
                        {formatCurrency(
                          getAmount(payment)
                        )}
                      </p>

                      <p className="text-[11px] text-[#8A8FA6] mt-1">
                        Outstanding
                      </p>
                    </div>

                    <ChevronRight
                      size={17}
                      className="text-[#B0B4C5]"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}