import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Plus,
  Smartphone,
  Send,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock3,
  XCircle,
  Users,
} from "lucide-react";

type PaymentRow = {
  phoneNumber: string;
  amount: string;
  counterparty: string;
  remarks: string;
};

type Transaction = {
  id: string;
  phoneNumber: string;
  amount: number;
  counterparty?: string | null;
  status: string;
  mpesaReceiptNumber?: string | null;
  resultDescription?: string | null;
};

type Batch = {
  id: string;
  batchReference: string;
  description?: string | null;
  totalAmount: number;
  totalPayments: number;
  successful: number;
  failed: number;
  pending: number;
  status: string;
  transactions: Transaction[];
  createdAt: string;
};

const API_BASE =
  "/api/mpesa";

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

  const response =
    await fetch(
      `${API_BASE}${path}`,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`,
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
        "Request failed.",
    );
  }

  return data;
}

const emptyRow =
  (): PaymentRow => ({
    phoneNumber: "",
    amount: "",
    counterparty: "",
    remarks: "",
  });

export default function MpesaIntegration() {
  const [
    batches,
    setBatches,
  ] = useState<Batch[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    showPaymentForm,
    setShowPaymentForm,
  ] = useState(false);

  const [
    batchReference,
    setBatchReference,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    payments,
    setPayments,
  ] = useState<PaymentRow[]>([
    emptyRow(),
  ]);

  const loadBatches =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await apiRequest<{
            batches: Batch[];
          }>("/batches");

        setBatches(
          response.batches ?? [],
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load M-Pesa batches.",
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadBatches();
  }, []);

  const totals =
    useMemo(() => {
      return batches.reduce(
        (result, batch) => ({
          amount:
            result.amount +
            Number(
              batch.totalAmount || 0,
            ),

          payments:
            result.payments +
            Number(
              batch.totalPayments ||
                0,
            ),

          successful:
            result.successful +
            Number(
              batch.successful ||
                0,
            ),

          failed:
            result.failed +
            Number(
              batch.failed || 0,
            ),

          pending:
            result.pending +
            Number(
              batch.pending || 0,
            ),
        }),
        {
          amount: 0,
          payments: 0,
          successful: 0,
          failed: 0,
          pending: 0,
        },
      );
    }, [batches]);

  const updateRow = (
    index: number,
    field: keyof PaymentRow,
    value: string,
  ) => {
    setPayments(
      (current) =>
        current.map(
          (row, rowIndex) =>
            rowIndex === index
              ? {
                  ...row,
                  [field]: value,
                }
              : row,
        ),
    );
  };

  const addRow = () => {
    if (payments.length >= 100) {
      setError(
        "A maximum of 100 recipients is allowed per batch.",
      );
      return;
    }

    setPayments((current) => [
      ...current,
      emptyRow(),
    ]);
  };

  const removeRow = (
    index: number,
  ) => {
    setPayments(
      (current) =>
        current.length === 1
          ? current
          : current.filter(
              (_, rowIndex) =>
                rowIndex !== index,
            ),
    );
  };

  const submitBatch =
    async () => {
      try {
        setSubmitting(true);
        setError("");
        setSuccess("");

        const cleanedPayments =
          payments.map(
            (payment) => ({
              phoneNumber:
                payment.phoneNumber.trim(),

              amount:
                Number(
                  payment.amount,
                ),

              counterparty:
                payment.counterparty.trim(),

              remarks:
                payment.remarks.trim(),
            }),
          );

        if (
          cleanedPayments.some(
            (payment) =>
              !payment.phoneNumber ||
              !Number.isFinite(
                payment.amount,
              ) ||
              payment.amount <= 0,
          )
        ) {
          throw new Error(
            "Every recipient must have a valid phone number and amount.",
          );
        }

        const response =
          await apiRequest<{
            batch: Batch;
          }>("/b2c/bulk", {
            method: "POST",

            body: JSON.stringify({
              batchReference:
                batchReference.trim() ||
                undefined,

              description:
                description.trim() ||
                undefined,

              payments:
                cleanedPayments,
            }),
          });

        setSuccess(
          `Payment batch ${response.batch.batchReference} was submitted successfully.`,
        );

        setBatchReference("");
        setDescription("");
        setPayments([
          emptyRow(),
        ]);
        setShowPaymentForm(false);

        await loadBatches();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to submit payment batch.",
        );
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <div className="space-y-6">
      {/* Header */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            M-Pesa Integration
          </h1>

          <p className="mt-2 text-[#666B84]">
            Send payments, manage M-Pesa
            transactions and process
            multiple recipients in one batch.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              void loadBatches()
            }
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-60"
          >
            <RefreshCw
              size={17}
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
            onClick={() => {
              setError("");
              setSuccess("");
              setShowPaymentForm(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0]"
          >
            <Plus size={18} />

            New Payment Batch
          </button>
        </div>
      </div>

      {/* Alerts */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{success}</span>
        </div>
      )}

      {/* Summary */}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Batches"
          value={batches.length}
        />

        <SummaryCard
          label="Recipients"
          value={totals.payments}
        />

        <SummaryCard
          label="Successful"
          value={totals.successful}
        />

        <SummaryCard
          label="Failed"
          value={totals.failed}
        />

        <SummaryCard
          label="Pending"
          value={totals.pending}
        />
      </div>

      {/* New batch */}

      {showPaymentForm && (
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#20243A]">
                M-Pesa B2C Payment Batch
              </h2>

              <p className="mt-1 text-sm text-[#666B84]">
                Add multiple phone numbers with
                different amounts and submit them
                together.
              </p>
            </div>

            <Users
              size={28}
              className="text-[#6D5DF6]"
            />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                Batch Reference
              </label>

              <input
                value={batchReference}
                onChange={(event) =>
                  setBatchReference(
                    event.target.value,
                  )
                }
                placeholder="e.g. PAYROLL-AUG-001"
                className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                Description
              </label>

              <input
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Reason for this payment batch"
                className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
              />
            </div>
          </div>

          <div className="space-y-4">
            {payments.map(
              (payment, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#20243A]">
                      Recipient{" "}
                      {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        removeRow(index)
                      }
                      disabled={
                        payments.length === 1
                      }
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2
                        size={17}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <input
                      value={
                        payment.phoneNumber
                      }
                      onChange={(event) =>
                        updateRow(
                          index,
                          "phoneNumber",
                          event.target.value,
                        )
                      }
                      placeholder="0712345678"
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={
                        payment.amount
                      }
                      onChange={(event) =>
                        updateRow(
                          index,
                          "amount",
                          event.target.value,
                        )
                      }
                      placeholder="Amount (KES)"
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />

                    <input
                      value={
                        payment.counterparty
                      }
                      onChange={(event) =>
                        updateRow(
                          index,
                          "counterparty",
                          event.target.value,
                        )
                      }
                      placeholder="Recipient name"
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />

                    <input
                      value={
                        payment.remarks
                      }
                      onChange={(event) =>
                        updateRow(
                          index,
                          "remarks",
                          event.target.value,
                        )
                      }
                      placeholder="Payment description"
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC]"
            >
              <Plus size={17} />
              Add Recipient
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowPaymentForm(false)
                }
                disabled={submitting}
                className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void submitBatch()
                }
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0] disabled:opacity-60"
              >
                {submitting ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={17} />
                )}

                {submitting
                  ? "Submitting..."
                  : "Send Payments"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batches */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        <div className="border-b border-[#ECECF3] p-5">
          <h2 className="font-semibold text-[#20243A]">
            Payment Batches
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Track every recipient and the
            result returned by M-Pesa.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#666B84]">
            Loading M-Pesa batches...
          </div>
        ) : batches.length === 0 ? (
          <div className="p-10 text-center">
            <Smartphone
              size={34}
              className="mx-auto text-[#6D5DF6]"
            />

            <p className="mt-3 font-medium text-[#20243A]">
              No payment batches yet
            </p>

            <p className="mt-1 text-sm text-[#666B84]">
              Create your first M-Pesa B2C
              payment batch.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#ECECF3]">
            {batches.map(
              (batch) => (
                <div
                  key={batch.id}
                  className="p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-[#20243A]">
                          {
                            batch.batchReference
                          }
                        </h3>

                        <StatusBadge
                          status={
                            batch.status
                          }
                        />
                      </div>

                      <p className="mt-1 text-sm text-[#666B84]">
                        {batch.description ||
                          "M-Pesa payment batch"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-5 text-sm md:grid-cols-4">
                      <Metric
                        label="Amount"
                        value={`KES ${Number(
                          batch.totalAmount,
                        ).toLocaleString()}`}
                      />

                      <Metric
                        label="Recipients"
                        value={
                          batch.totalPayments
                        }
                      />

                      <Metric
                        label="Successful"
                        value={
                          batch.successful
                        }
                      />

                      <Metric
                        label="Failed"
                        value={
                          batch.failed
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#ECECF3] text-[#666B84]">
                          <th className="pb-3">
                            Phone
                          </th>

                          <th className="pb-3">
                            Recipient
                          </th>

                          <th className="pb-3">
                            Amount
                          </th>

                          <th className="pb-3">
                            Status
                          </th>

                          <th className="pb-3">
                            Receipt
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {batch.transactions.map(
                          (
                            transaction,
                          ) => (
                            <tr
                              key={
                                transaction.id
                              }
                              className="border-b border-[#F1F1F5] last:border-0"
                            >
                              <td className="py-3 font-medium text-[#20243A]">
                                {
                                  transaction.phoneNumber
                                }
                              </td>

                              <td className="py-3 text-[#666B84]">
                                {transaction.counterparty ||
                                  "—"}
                              </td>

                              <td className="py-3 text-[#20243A]">
                                KES{" "}
                                {Number(
                                  transaction.amount,
                                ).toLocaleString()}
                              </td>

                              <td className="py-3">
                                <StatusBadge
                                  status={
                                    transaction.status
                                  }
                                />
                              </td>

                              <td className="py-3 text-[#666B84]">
                                {
                                  transaction.mpesaReceiptNumber ||
                                  transaction.resultDescription ||
                                  "Pending"
                                }
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <p className="text-sm text-[#666B84]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-[#20243A]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs text-[#666B84]">
        {label}
      </p>

      <p className="mt-1 font-semibold text-[#20243A]">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.toUpperCase();

  if (
    normalized ===
      "COMPLETED" ||
    normalized ===
      "SUCCESS"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 size={13} />
        Successful
      </span>
    );
  }

  if (
    normalized ===
      "FAILED" ||
    normalized ===
      "REJECTED" ||
    normalized ===
      "TIMEOUT"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        <XCircle size={13} />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      <Clock3 size={13} />
      Pending
    </span>
  );
}