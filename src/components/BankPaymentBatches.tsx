import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

type BankPayment = {
  id: string;
  paymentReference: string;
  beneficiaryName: string;
  accountNumber: string;
  bankCode?: string | null;
  branchCode?: string | null;
  amount: number;
  currency: string;
  description?: string | null;
  status: string;
  providerReference?: string | null;
  providerStatus?: string | null;
  providerMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

type BankPaymentBatch = {
  id: string;
  organizationId: string;
  bankAccountId: string;
  batchReference: string;
  description?: string | null;
  totalAmount: number;
  totalPayments: number;
  successful: number;
  failed: number;
  pending: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  bankAccount?: {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    currency: string;
  } | null;
  payments?: BankPayment[];
};

type Props = {
  batches?: BankPaymentBatch[];
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onCreate?: () => void;
};

function getToken(): string | null {
  return (
    localStorage.getItem("accessToken") ??
    localStorage.getItem("token") ??
    localStorage.getItem("authToken")
  );
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const response = await fetch(
    `/api${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),

        ...(options.headers || {}),
      },
    },
  );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Request failed.",
    );
  }

  return data as T;
}

function formatMoney(
  amount: number,
  currency = "KES",
): string {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(Number(amount || 0));
}

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-KE",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function statusClass(
  status: string,
): string {
  switch (
    status.toUpperCase()
  ) {
    case "COMPLETED":
    case "CONNECTED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";

    case "FAILED":
      return "border-red-500/30 bg-red-500/10 text-red-400";

    case "PROCESSING":
    case "PENDING":
    case "PARTIALLY_COMPLETED":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";

    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

export default function BankPaymentBatches({
  batches: externalBatches,
  loading: externalLoading = false,
  onRefresh,
  onCreate,
}: Props) {
  const [
    internalBatches,
    setInternalBatches,
  ] = useState<
    BankPaymentBatch[]
  >([]);

  const [
    internalLoading,
    setInternalLoading,
  ] = useState(true);

  const [
    expandedBatch,
    setExpandedBatch,
  ] = useState<string | null>(
    null,
  );

  const [
    selectedBatch,
    setSelectedBatch,
  ] = useState<BankPaymentBatch | null>(
    null,
  );

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const batches =
    externalBatches ??
    internalBatches;

  const loading =
    externalBatches !== undefined
      ? externalLoading
      : internalLoading;

  const loadBatches =
    async () => {
      if (
        externalBatches !==
        undefined
      ) {
        return;
      }

      try {
        setInternalLoading(
          true,
        );

        const response =
          await apiRequest<{
            success?: boolean;
            batches?: BankPaymentBatch[];
          }>(
            "/bank/payments/batches",
          );

        setInternalBatches(
          response.batches ??
            [],
        );
      } finally {
        setInternalLoading(
          false,
        );
      }
    };

  useEffect(() => {
    void loadBatches();
  }, []);

  const refresh =
    async () => {
      if (onRefresh) {
        await onRefresh();
        return;
      }

      await loadBatches();
    };

  const viewBatch =
    async (
      batch: BankPaymentBatch,
    ) => {
      if (
        expandedBatch ===
        batch.id
      ) {
        setExpandedBatch(
          null,
        );
        return;
      }

      setExpandedBatch(
        batch.id,
      );

      /*
       * If payments are already included in the
       * batch response, use them directly.
       */
      if (
        batch.payments &&
        batch.payments.length >
          0
      ) {
        setSelectedBatch(
          batch,
        );
        return;
      }

      try {
        setDetailLoading(
          true,
        );

        const response =
          await apiRequest<{
            success?: boolean;
            batch?: BankPaymentBatch;
          }>(
            `/bank/payments/batches/${batch.id}`,
          );

        setSelectedBatch(
          response.batch ??
            batch,
        );
      } catch {
        setSelectedBatch(
          batch,
        );
      } finally {
        setDetailLoading(
          false,
        );
      }
    };

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#111827]">
      {/* HEADER */}

      <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Bank Payment Batches
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Pay multiple recipients from an approved
            organizational bank account.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void refresh()
            }
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={16} />

            New Payment Batch
          </button>
        </div>
      </div>

      {/* CONTENT */}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-slate-400">
          <Loader2
            size={22}
            className="mr-3 animate-spin"
          />

          Loading payment batches...
        </div>
      ) : batches.length ===
        0 ? (
        <div className="px-5 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-500">
            <CreditCard
              size={25}
            />
          </div>

          <h3 className="mt-4 text-base font-semibold text-white">
            No payment batches yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Create a payment batch to pay multiple
            beneficiaries from a connected bank account.
          </p>

          <button
            type="button"
            onClick={onCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={16} />

            Create Payment Batch
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Batch
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Funding Account
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payments
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {batches.map(
                (batch) => {
                  const expanded =
                    expandedBatch ===
                    batch.id;

                  return (
                    <tr
                      key={batch.id}
                      className="border-b border-slate-800 last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-white">
                            {
                              batch.batchReference
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              batch.description ||
                              "No description"
                            }
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-200">
                          {
                            batch
                              .bankAccount
                              ?.bankName ??
                            "Bank Account"
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            batch
                              .bankAccount
                              ?.accountNumber ??
                            "—"
                          }
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-white">
                        {formatMoney(
                          batch.totalAmount,
                          batch
                            .bankAccount
                            ?.currency ??
                            "KES",
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300">
                            Total{" "}
                            {
                              batch.totalPayments
                            }
                          </span>

                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                            <CheckCircle2
                              size={12}
                              className="mr-1 inline"
                            />
                            {
                              batch.successful
                            }
                          </span>

                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
                            <RefreshCw
                              size={12}
                              className="mr-1 inline"
                            />
                            {
                              batch.pending
                            }
                          </span>

                          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-400">
                            <XCircle
                              size={12}
                              className="mr-1 inline"
                            />
                            {
                              batch.failed
                            }
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                            batch.status,
                          )}`}
                        >
                          {
                            batch.status
                          }
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-400">
                        {formatDate(
                          batch.createdAt,
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void viewBatch(
                              batch,
                            )
                          }
                          disabled={
                            detailLoading
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Eye
                            size={15}
                          />

                          View

                          {expanded ? (
                            <ChevronUp
                              size={14}
                            />
                          ) : (
                            <ChevronDown
                              size={14}
                            />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SELECTED BATCH */}

      {selectedBatch && (
        <div className="border-t border-slate-800 p-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-white">
                {
                  selectedBatch.batchReference
                }
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {
                  selectedBatch.description ||
                  "Payment batch details"
                }
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedBatch(
                  null,
                )
              }
              className="text-sm text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <Metric
              label="Total"
              value={formatMoney(
                selectedBatch.totalAmount,
              )}
            />

            <Metric
              label="Successful"
              value={String(
                selectedBatch.successful,
              )}
            />

            <Metric
              label="Pending"
              value={String(
                selectedBatch.pending,
              )}
            />

            <Metric
              label="Failed"
              value={String(
                selectedBatch.failed,
              )}
            />
          </div>

          {selectedBatch.payments &&
          selectedBatch.payments
            .length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
                      Beneficiary
                    </th>

                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
                      Account
                    </th>

                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
                      Amount
                    </th>

                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
                      Provider Reference
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {selectedBatch.payments.map(
                    (
                      payment,
                    ) => (
                      <tr
                        key={
                          payment.id
                        }
                        className="border-b border-slate-800 last:border-b-0"
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium text-white">
                            {
                              payment.beneficiaryName
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              payment.description ||
                              "—"
                            }
                          </p>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-300">
                          {
                            payment.accountNumber
                          }
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-white">
                          {formatMoney(
                            payment.amount,
                            payment.currency,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                              payment.status,
                            )}`}
                          >
                            {
                              payment.status
                            }
                          </span>

                          {payment.providerMessage && (
                            <p className="mt-2 max-w-xs text-xs text-slate-500">
                              {
                                payment.providerMessage
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-400">
                          {
                            payment.providerReference ||
                            "—"
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-5 py-8 text-center text-sm text-slate-500">
              No individual payment records are available for this
              batch.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-white">
        {value}
      </p>
    </div>
  );
}