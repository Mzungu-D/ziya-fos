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
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import {
  authenticatedFetch,
} from "../lib/auth";

/* =========================================================
   API
========================================================= */

const API_BASE =
  "/api/mpesa";

/* =========================================================
   TYPES
========================================================= */

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
  transactions?: Transaction[];
  createdAt: string;
};

type MpesaAccount = {
  id: string;
  name: string;
  accountType?: string | null;
  shortcode: string;
  environment: string;
  initiatorName?: string | null;
  isActive: boolean;
  isDefault: boolean;
};

type BatchResponse = {
  success: boolean;
  batch: Batch;
};

type BatchListResponse = {
  success: boolean;
  batches: Batch[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type AccountListResponse = {
  success: boolean;
  accounts: MpesaAccount[];
};

/* =========================================================
   HELPERS
========================================================= */

const emptyRow = (): PaymentRow => ({
  phoneNumber: "",
  amount: "",
  counterparty: "",
  remarks: "",
});

const formatCurrency = (
  value: number,
): string => {
  return `KES ${Number(
    value || 0,
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (
  value: string,
): string => {
  const date =
    new Date(value);

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
};

/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response =
    await authenticatedFetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers: {
          "Content-Type":
            "application/json",
          ...(options.headers ?? {}),
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
        (response.status === 401
          ? "Authentication required. Please sign in."
          : "Request failed."),
    );
  }

  return data as T;
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function MpesaIntegration() {
  const [
    batches,
    setBatches,
  ] = useState<Batch[]>([]);

  const [
    mpesaAccounts,
    setMpesaAccounts,
  ] = useState<
    MpesaAccount[]
  >([]);

  const [
    selectedMpesaAccountId,
    setSelectedMpesaAccountId,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingAccounts,
    setLoadingAccounts,
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

  const [
    expandedBatchId,
    setExpandedBatchId,
  ] = useState<
    string | null
  >(null);

  const [
    loadingBatchId,
    setLoadingBatchId,
  ] = useState<
    string | null
  >(null);

  /* =======================================================
     LOAD ACCOUNTS
  ======================================================= */

  const loadMpesaAccounts =
    async () => {
      try {
        setLoadingAccounts(
          true,
        );

        const response =
          await apiRequest<AccountListResponse>(
            "/accounts",
          );

        const activeAccounts =
          (
            response.accounts ??
            []
          ).filter(
            (account) =>
              account.isActive,
          );

        setMpesaAccounts(
          activeAccounts,
        );

        const currentSelection =
          activeAccounts.find(
            (account) =>
              account.id ===
              selectedMpesaAccountId,
          );

        if (
          currentSelection
        ) {
          return;
        }

        const defaultAccount =
          activeAccounts.find(
            (account) =>
              account.isDefault,
          );

        if (
          defaultAccount
        ) {
          setSelectedMpesaAccountId(
            defaultAccount.id,
          );
          return;
        }

        if (
          activeAccounts.length ===
          1
        ) {
          setSelectedMpesaAccountId(
            activeAccounts[0].id,
          );
        } else {
          setSelectedMpesaAccountId(
            "",
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load M-Pesa accounts.",
        );
      } finally {
        setLoadingAccounts(
          false,
        );
      }
    };

  /* =======================================================
     LOAD BATCHES
  ======================================================= */

  const loadBatches =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await apiRequest<BatchListResponse>(
            "/batches?page=1&limit=100",
          );

        setBatches(
          response.batches ??
            [],
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

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void Promise.all([
      loadBatches(),
      loadMpesaAccounts(),
    ]);
  }, []);

  /* =======================================================
     TOTALS
  ======================================================= */

  const totals =
    useMemo(() => {
      return batches.reduce(
        (
          result,
          batch,
        ) => ({
          amount:
            result.amount +
            Number(
              batch.totalAmount ||
                0,
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
              batch.failed ||
                0,
            ),

          pending:
            result.pending +
            Number(
              batch.pending ||
                0,
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

  /* =======================================================
     ROW MANAGEMENT
  ======================================================= */

  const updateRow = (
    index: number,
    field: keyof PaymentRow,
    value: string,
  ) => {
    setPayments(
      (current) =>
        current.map(
          (
            row,
            rowIndex,
          ) =>
            rowIndex === index
              ? {
                  ...row,
                  [field]:
                    value,
                }
              : row,
        ),
    );
  };

  const addRow = () => {
    if (
      payments.length >=
      1000
    ) {
      setError(
        "A maximum of 1,000 recipients is allowed per batch.",
      );
      return;
    }

    setPayments(
      (current) => [
        ...current,
        emptyRow(),
      ],
    );
  };

  const removeRow = (
    index: number,
  ) => {
    setPayments(
      (current) =>
        current.length === 1
          ? current
          : current.filter(
              (
                _,
                rowIndex,
              ) =>
                rowIndex !==
                index,
            ),
    );
  };

  /* =======================================================
     LOAD BATCH DETAILS
  ======================================================= */

  const loadBatchDetails =
    async (
      batchId: string,
    ) => {
      try {
        setLoadingBatchId(
          batchId,
        );

        const response =
          await apiRequest<BatchResponse>(
            `/batches/${encodeURIComponent(
              batchId,
            )}`,
          );

        setBatches(
          (current) =>
            current.map(
              (batch) =>
                batch.id ===
                batchId
                  ? response.batch
                  : batch,
            ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load payment batch details.",
        );
      } finally {
        setLoadingBatchId(
          null,
        );
      }
    };

  const toggleBatch = (
    batchId: string,
  ) => {
    if (
      expandedBatchId ===
      batchId
    ) {
      setExpandedBatchId(
        null,
      );
      return;
    }

    setExpandedBatchId(
      batchId,
    );

    const existingBatch =
      batches.find(
        (batch) =>
          batch.id ===
          batchId,
      );

    if (
      !existingBatch?.transactions
    ) {
      void loadBatchDetails(
        batchId,
      );
    }
  };

  /* =======================================================
     SUBMIT BULK PAYMENT
  ======================================================= */

  const submitBatch =
    async () => {
      try {
        setSubmitting(true);
        setError("");
        setSuccess("");

        if (
          !selectedMpesaAccountId
        ) {
          throw new Error(
            "Please select an active M-Pesa account before submitting the payment batch.",
          );
        }

        if (
          payments.length ===
          0
        ) {
          throw new Error(
            "At least one recipient is required.",
          );
        }

        const cleanedPayments =
          payments.map(
            (
              payment,
            ) => ({
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

        const invalidIndex =
          cleanedPayments.findIndex(
            (payment) =>
              !payment.phoneNumber ||
              !Number.isFinite(
                payment.amount,
              ) ||
              payment.amount <=
                0,
          );

        if (
          invalidIndex !==
          -1
        ) {
          throw new Error(
            `Recipient ${
              invalidIndex + 1
            } must have a valid phone number and amount.`,
          );
        }

        /*
         * The backend normalizes and validates the Kenyan
         * phone number. We deliberately don't duplicate
         * that business rule in the browser.
         */

        const response =
          await apiRequest<BatchResponse>(
            "/payments/bulk",
            {
              method:
                "POST",

              body:
                JSON.stringify(
                  {
                    mpesaAccountId:
                      selectedMpesaAccountId,

                    description:
                      description.trim() ||
                      undefined,

                    recipients:
                      cleanedPayments.map(
                        (
                          payment,
                        ) => ({
                          phoneNumber:
                            payment.phoneNumber,

                          amount:
                            payment.amount,

                          reference:
                            undefined,

                          description:
                            payment.remarks ||
                            description.trim() ||
                            "Ziya FOS M-Pesa payment",
                        }),
                      ),
                  },
                ),
            },
          );

        setSuccess(
          `Payment batch ${
            response.batch
              .batchReference
          } was submitted successfully.`,
        );

        setBatchReference(
          "",
        );

        setDescription(
          "",
        );

        setPayments([
          emptyRow(),
        ]);

        setShowPaymentForm(
          false,
        );

        await loadBatches();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to submit payment batch.",
        );
      } finally {
        setSubmitting(
          false,
        );
      }
    };

  /* =======================================================
     REFRESH
  ======================================================= */

  const refreshAll =
    async () => {
      setError("");
      setSuccess("");

      await Promise.all([
        loadBatches(),
        loadMpesaAccounts(),
      ]);
    };

  /* =======================================================
     RENDER
  ======================================================= */

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
            transactions and process multiple
            recipients in one batch.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              void refreshAll()
            }
            disabled={
              loading ||
              loadingAccounts
            }
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={
                loading ||
                loadingAccounts
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
              setShowPaymentForm(
                true,
              );
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
          value={
            batches.length
          }
        />

        <SummaryCard
          label="Recipients"
          value={
            totals.payments
          }
        />

        <SummaryCard
          label="Successful"
          value={
            totals.successful
          }
        />

        <SummaryCard
          label="Failed"
          value={
            totals.failed
          }
        />

        <SummaryCard
          label="Pending"
          value={
            totals.pending
          }
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
                Add multiple recipients with
                different amounts and submit
                them together.
              </p>
            </div>

            <Users
              size={28}
              className="text-[#6D5DF6]"
            />
          </div>

          {/* M-Pesa account */}

          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
              M-Pesa Account
            </label>

            <select
              value={
                selectedMpesaAccountId
              }
              onChange={(
                event,
              ) =>
                setSelectedMpesaAccountId(
                  event.target
                    .value,
                )
              }
              disabled={
                loadingAccounts ||
                submitting
              }
              className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6] disabled:bg-[#F8F9FC] disabled:opacity-70"
            >
              <option value="">
                {loadingAccounts
                  ? "Loading M-Pesa accounts..."
                  : "Select M-Pesa account"}
              </option>

              {mpesaAccounts.map(
                (account) => (
                  <option
                    key={
                      account.id
                    }
                    value={
                      account.id
                    }
                  >
                    {account.name} —{" "}
                    {
                      account.shortcode
                    }{" "}
                    (
                    {
                      account.environment
                    }
                    )
                  </option>
                ),
              )}
            </select>

            {!loadingAccounts &&
              mpesaAccounts.length ===
                0 && (
                <p className="mt-2 text-xs text-red-600">
                  No active M-Pesa
                  account is
                  configured for
                  this organization.
                  Configure an
                  account before
                  making payments.
                </p>
              )}
          </div>

          {/* Batch information */}

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                Batch Reference
              </label>

              <input
                value={
                  batchReference
                }
                onChange={(
                  event,
                ) =>
                  setBatchReference(
                    event.target
                      .value,
                  )
                }
                placeholder="Optional — e.g. PAYROLL-AUG-001"
                disabled={
                  submitting
                }
                className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6] disabled:bg-[#F8F9FC]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                Description
              </label>

              <input
                value={
                  description
                }
                onChange={(
                  event,
                ) =>
                  setDescription(
                    event.target
                      .value,
                  )
                }
                placeholder="Reason for this payment batch"
                disabled={
                  submitting
                }
                className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6] disabled:bg-[#F8F9FC]"
              />
            </div>
          </div>

          {/* Recipients */}

          <div className="space-y-4">
            {payments.map(
              (
                payment,
                index,
              ) => (
                <div
                  key={
                    index
                  }
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
                        removeRow(
                          index,
                        )
                      }
                      disabled={
                        payments.length ===
                          1 ||
                        submitting
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
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          index,
                          "phoneNumber",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="0712345678"
                      disabled={
                        submitting
                      }
                      inputMode="tel"
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6] disabled:bg-[#F8F9FC]"
                    />

                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={
                        payment.amount
                      }
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          index,
                          "amount",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Amount (KES)"
                      disabled={
                        submitting
                      }
                      inputMode="decimal"
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6] disabled:bg-[#F8F9FC]"
                    />

                    <input
                      value={
                        payment.counterparty
                      }
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          index,
                          "counterparty",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Recipient name"
                      disabled={
                        submitting
                      }
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6] disabled:bg-[#F8F9FC]"
                    />

                    <input
                      value={
                        payment.remarks
                      }
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          index,
                          "remarks",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Payment description"
                      disabled={
                        submitting
                      }
                      className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D5DF6] disabled:bg-[#F8F9FC]"
                    />
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Actions */}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={
                addRow
              }
              disabled={
                submitting ||
                payments.length >=
                  1000
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} />

              Add Recipient
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowPaymentForm(
                    false,
                  )
                }
                disabled={
                  submitting
                }
                className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void submitBatch()
                }
                disabled={
                  submitting ||
                  loadingAccounts ||
                  mpesaAccounts.length ===
                    0
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Send
                    size={17}
                  />
                )}

                {submitting
                  ? "Submitting..."
                  : "Send Payments"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment batches */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        <div className="border-b border-[#ECECF3] p-5">
          <h2 className="font-semibold text-[#20243A]">
            Payment Batches
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Track every payment batch and
            view individual recipient results.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#666B84]">
            <RefreshCw
              size={22}
              className="mx-auto mb-3 animate-spin"
            />

            Loading M-Pesa batches...
          </div>
        ) : batches.length ===
          0 ? (
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
              (batch) => {
                const expanded =
                  expandedBatchId ===
                  batch.id;

                const detailsLoading =
                  loadingBatchId ===
                  batch.id;

                return (
                  <div
                    key={
                      batch.id
                    }
                    className="p-5"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleBatch(
                          batch.id,
                        )
                      }
                      className="w-full text-left"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
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

                          <p className="mt-1 text-xs text-[#8A8EA3]">
                            {formatDate(
                              batch.createdAt,
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="grid grid-cols-2 gap-5 text-sm md:grid-cols-4">
                            <Metric
                              label="Amount"
                              value={formatCurrency(
                                Number(
                                  batch.totalAmount,
                                ),
                              )}
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

                          {expanded ? (
                            <ChevronUp
                              size={20}
                              className="shrink-0 text-[#666B84]"
                            />
                          ) : (
                            <ChevronDown
                              size={20}
                              className="shrink-0 text-[#666B84]"
                            />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Details */}

                    {expanded && (
                      <div className="mt-5">
                        {detailsLoading ? (
                          <div className="rounded-xl bg-[#F8F9FC] p-6 text-center text-sm text-[#666B84]">
                            <RefreshCw
                              size={20}
                              className="mx-auto mb-2 animate-spin"
                            />

                            Loading payment
                            details...
                          </div>
                        ) : batch.transactions &&
                          batch.transactions.length >
                            0 ? (
                          <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
                            <table className="w-full min-w-[750px] text-left text-sm">
                              <thead className="bg-[#F8F9FC]">
                                <tr className="border-b border-[#ECECF3] text-[#666B84]">
                                  <th className="px-4 py-3">
                                    Phone
                                  </th>

                                  <th className="px-4 py-3">
                                    Recipient
                                  </th>

                                  <th className="px-4 py-3">
                                    Amount
                                  </th>

                                  <th className="px-4 py-3">
                                    Status
                                  </th>

                                  <th className="px-4 py-3">
                                    Receipt / Result
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
                                      <td className="px-4 py-3 font-medium text-[#20243A]">
                                        {
                                          transaction.phoneNumber
                                        }
                                      </td>

                                      <td className="px-4 py-3 text-[#666B84]">
                                        {transaction.counterparty ||
                                          "—"}
                                      </td>

                                      <td className="px-4 py-3 font-medium text-[#20243A]">
                                        {formatCurrency(
                                          Number(
                                            transaction.amount,
                                          ),
                                        )}
                                      </td>

                                      <td className="px-4 py-3">
                                        <StatusBadge
                                          status={
                                            transaction.status
                                          }
                                        />
                                      </td>

                                      <td className="px-4 py-3 text-[#666B84]">
                                        {transaction.mpesaReceiptNumber ||
                                          transaction.resultDescription ||
                                          "Pending"}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-[#F8F9FC] p-6 text-center text-sm text-[#666B84]">
                            No individual transaction
                            details are available
                            for this batch yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

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
        {value.toLocaleString(
          "en-KE",
        )}
      </p>
    </div>
  );
}

/* =========================================================
   METRIC
========================================================= */

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

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    String(status || "")
      .toUpperCase();

  if (
    normalized ===
      "COMPLETED" ||
    normalized ===
      "SUCCESS"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2
          size={13}
        />

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
        <XCircle
          size={13}
        />

        Failed
      </span>
    );
  }

  if (
    normalized ===
    "PARTIALLY_COMPLETED"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        <CheckCircle2
          size={13}
        />

        Partially Completed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      <Clock3
        size={13}
      />

      Pending
    </span>
  );
}