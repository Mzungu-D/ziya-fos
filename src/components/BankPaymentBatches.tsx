import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  authenticatedFetch,
  getAuthToken,
} from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName?: string | null;
  currency: string;
  currentBalance?: number | null;
  integrationEnabled: boolean;
  integrationProvider?: string | null;
  connectionStatus?: string | null;
  status: string;
  apiBaseUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface BankPaymentBatchesProps {
  accounts: BankAccount[];
}

interface PaymentRecipient {
  beneficiaryName: string;
  accountNumber: string;
  bankCode: string;
  branchCode: string;
  amount: string;
  currency: string;
  description: string;
}

interface BankPaymentBatch {
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
  provider?: string | null;
  providerBatchId?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface Notice {
  type: "success" | "error";
  message: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

const EMPTY_RECIPIENT: PaymentRecipient = {
  beneficiaryName: "",
  accountNumber: "",
  bankCode: "",
  branchCode: "",
  amount: "",
  currency: "KES",
  description: "",
};

const inputClass =
  "w-full rounded-xl border border-[#E6E8EF] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#9AA0B4] focus:border-[#6D5DF5] focus:ring-4 focus:ring-[#6D5DF5]/10 disabled:bg-[#F7F8FB] disabled:opacity-60";

const selectClass =
  "w-full rounded-xl border border-[#E6E8EF] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#6D5DF5] focus:ring-4 focus:ring-[#6D5DF5]/10 disabled:bg-[#F7F8FB] disabled:opacity-60";

/* =========================================================
   API
========================================================= */

function authHeaders(): HeadersInit {
  const token = getAuthToken();

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<any> {
  const response = await authenticatedFetch(path, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  const contentType =
    response.headers.get("content-type") ?? "";

  let data: any = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {
          message: text,
        };
      }
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}.`,
    );
  }

  return data;
}

/* =========================================================
   HELPERS
========================================================= */

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

function isActiveAccount(
  account: BankAccount,
): boolean {
  return (
    account.status.trim().toUpperCase() ===
    "ACTIVE"
  );
}

function isConnectedAccount(
  account: BankAccount,
): boolean {
  return (
    account.connectionStatus
      ?.trim()
      .toUpperCase() === "CONNECTED"
  );
}

function isUsableFundingAccount(
  account: BankAccount,
): boolean {
  return (
    isActiveAccount(account) &&
    account.integrationEnabled === true &&
    isConnectedAccount(account)
  );
}

function maskAccountNumber(
  value: string,
): string {
  const normalized = value.trim();

  if (normalized.length <= 4) {
    return normalized;
  }

  return `•••• ${normalized.slice(-4)}`;
}

function formatAmount(
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
  ).format(Number(amount) || 0);
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getStatusClasses(
  status: string,
): string {
  const normalized =
    status.trim().toUpperCase();

  if (
    normalized === "SUCCESS" ||
    normalized === "COMPLETED"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized === "FAILED" ||
    normalized === "CANCELLED"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    normalized === "PROCESSING" ||
    normalized === "PENDING"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-[#E7E8EF] bg-[#F7F8FB] text-[#73788E]";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function BankPaymentBatches({
  accounts,
}: BankPaymentBatchesProps) {
  const [batches, setBatches] =
    useState<BankPaymentBatch[]>([]);

  const [loadingBatches, setLoadingBatches] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [formOpen, setFormOpen] =
    useState(false);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const [selectedBankAccountId, setSelectedBankAccountId] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [batchReference, setBatchReference] =
    useState("");

  const [recipients, setRecipients] =
    useState<PaymentRecipient[]>([
      {
        ...EMPTY_RECIPIENT,
      },
    ]);

  /* =======================================================
     FUNDING ACCOUNTS
  ======================================================= */

  const fundingAccounts =
    useMemo(
      () =>
        accounts.filter(
          isUsableFundingAccount,
        ),
      [accounts],
    );

  const selectedAccount =
    useMemo(
      () =>
        fundingAccounts.find(
          (account) =>
            account.id ===
            selectedBankAccountId,
        ) ?? null,
      [
        fundingAccounts,
        selectedBankAccountId,
      ],
    );

  /* =======================================================
     BATCH TOTALS
  ======================================================= */

  const totalAmount =
    useMemo(
      () =>
        recipients.reduce(
          (total, recipient) =>
            total +
            (Number(recipient.amount) || 0),
          0,
        ),
      [recipients],
    );

  const validRecipientCount =
    useMemo(
      () =>
        recipients.filter(
          (recipient) =>
            recipient.beneficiaryName.trim() &&
            recipient.accountNumber.trim() &&
            Number(recipient.amount) > 0,
        ).length,
      [recipients],
    );

  /* =======================================================
     LOAD BATCHES
  ======================================================= */

  const loadBatches =
    useCallback(async () => {
      try {
        setLoadingBatches(true);

        const data = await apiFetch(
          "/api/bank-payments/batches",
        );

        const result =
          Array.isArray(data?.batches)
            ? data.batches
            : Array.isArray(data)
              ? data
              : [];

        setBatches(result);
      } catch (error) {
        /*
         * Do not destroy the workspace if the
         * list endpoint is temporarily unavailable.
         */
        setBatches([]);

        setNotice({
          type: "error",
          message: getErrorMessage(
            error,
            "Unable to load payment batches.",
          ),
        });
      } finally {
        setLoadingBatches(false);
      }
    }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  /* =======================================================
     OPEN FORM
  ======================================================= */

  const openCreate =
    () => {
      setNotice(null);

      const firstFundingAccount =
        fundingAccounts[0];

      setSelectedBankAccountId(
        firstFundingAccount?.id ?? "",
      );

      setDescription("");
      setBatchReference("");

      setRecipients([
        {
          ...EMPTY_RECIPIENT,
          currency:
            firstFundingAccount?.currency ??
            "KES",
        },
      ]);

      setFormOpen(true);
    };

  /* =======================================================
     CLOSE FORM
  ======================================================= */

  const closeForm =
    () => {
      if (submitting) {
        return;
      }

      setFormOpen(false);
    };

  /* =======================================================
     RECIPIENTS
  ======================================================= */

  const updateRecipient =
    (
      index: number,
      field: keyof PaymentRecipient,
      value: string,
    ) => {
      setRecipients(
        (current) =>
          current.map(
            (recipient, recipientIndex) =>
              recipientIndex === index
                ? {
                    ...recipient,
                    [field]: value,
                  }
                : recipient,
          ),
      );
    };

  const addRecipient =
    () => {
      if (recipients.length >= 100) {
        setNotice({
          type: "error",
          message:
            "A maximum of 100 recipients is allowed per batch.",
        });

        return;
      }

      setRecipients(
        (current) => [
          ...current,
          {
            ...EMPTY_RECIPIENT,
            currency:
              selectedAccount?.currency ??
              "KES",
          },
        ],
      );
    };

  const removeRecipient =
    (index: number) => {
      if (recipients.length === 1) {
        return;
      }

      setRecipients(
        (current) =>
          current.filter(
            (_, recipientIndex) =>
              recipientIndex !== index,
          ),
      );
    };

  /* =======================================================
     SUBMIT BATCH
  ======================================================= */

  const submitBatch =
    async () => {
      setNotice(null);

      if (!selectedBankAccountId) {
        setNotice({
          type: "error",
          message:
            "Select a connected funding bank account.",
        });

        return;
      }

      if (!selectedAccount) {
        setNotice({
          type: "error",
          message:
            "The selected funding bank account is not active, enabled and connected.",
        });

        return;
      }

      if (
        recipients.length === 0
      ) {
        setNotice({
          type: "error",
          message:
            "At least one payment recipient is required.",
        });

        return;
      }

      for (
        let index = 0;
        index < recipients.length;
        index++
      ) {
        const recipient =
          recipients[index];

        if (
          !recipient.beneficiaryName.trim()
        ) {
          setNotice({
            type: "error",
            message:
              `Recipient ${index + 1}: beneficiary name is required.`,
          });

          return;
        }

        if (
          !recipient.accountNumber.trim()
        ) {
          setNotice({
            type: "error",
            message:
              `Recipient ${index + 1}: account number is required.`,
          });

          return;
        }

        const amount =
          Number(
            recipient.amount,
          );

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          setNotice({
            type: "error",
            message:
              `Recipient ${index + 1}: payment amount must be greater than zero.`,
          });

          return;
        }
      }

      if (totalAmount <= 0) {
        setNotice({
          type: "error",
          message:
            "The total payment amount must be greater than zero.",
        });

        return;
      }

      try {
        setSubmitting(true);

        const idempotencyKey =
          generateIdempotencyKey();

        const payload = {
          bankAccountId:
            selectedBankAccountId,

          batchReference:
            batchReference.trim() ||
            undefined,

          description:
            description.trim() ||
            undefined,

          provider:
            selectedAccount
              .integrationProvider
              ?.trim() ||
            undefined,

          idempotencyKey,

          recipients:
            recipients.map(
              (recipient) => ({
                beneficiaryName:
                  recipient.beneficiaryName.trim(),

                accountNumber:
                  recipient.accountNumber.trim(),

                bankCode:
                  recipient.bankCode.trim() ||
                  undefined,

                branchCode:
                  recipient.branchCode.trim() ||
                  undefined,

                amount:
                  Number(
                    recipient.amount,
                  ),

                currency:
                  recipient.currency.trim() ||
                  selectedAccount.currency ||
                  "KES",

                description:
                  recipient.description.trim() ||
                  undefined,
              }),
            ),
        };

        const data =
          await apiFetch(
            "/api/bank-payments/batches",
            {
              method: "POST",
              body:
                JSON.stringify(
                  payload,
                ),
            },
          );

        const createdBatch =
          data?.batch;

        setNotice({
          type: "success",
          message:
            data?.message ??
            `Payment batch ${createdBatch?.batchReference ?? ""} created successfully.`,
        });

        setFormOpen(false);

        setDescription("");
        setBatchReference("");
        setRecipients([
          {
            ...EMPTY_RECIPIENT,
          },
        ]);

        await loadBatches();
      } catch (error) {
        setNotice({
          type: "error",
          message: getErrorMessage(
            error,
            "Failed to create payment batch.",
          ),
        });
      } finally {
        setSubmitting(false);
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <div className="rounded-2xl border border-[#E8E9F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#6D5DF5]">
                <Wallet size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#20243A]">
                  Bank Payment Batches
                </h2>

                <p className="mt-1 text-sm text-[#73788E]">
                  Pay multiple recipients from a
                  connected organizational bank account.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void loadBatches()
              }
              disabled={loadingBatches}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E4E6ED] bg-white px-4 py-2.5 text-sm font-semibold text-[#555B72] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  loadingBatches
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5F50E6]"
            >
              <Plus size={17} />

              New Payment Batch
            </button>
          </div>
        </div>

        {/* =================================================
            NOTICE
        ================================================= */}

        {notice && (
          <div
            className={[
              "mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {notice.type === "success" ? (
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0"
              />
            ) : (
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />
            )}

            <span className="flex-1">
              {notice.message}
            </span>

            <button
              type="button"
              onClick={() =>
                setNotice(null)
              }
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label="Close notification"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* =================================================
            FUNDING ACCOUNT STATUS
        ================================================= */}

        {fundingAccounts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-amber-600"
              />

              <div>
                <h3 className="font-semibold text-amber-800">
                  No connected funding account
                </h3>

                <p className="mt-1 text-sm leading-6 text-amber-700">
                  Add a bank account, make sure it is
                  ACTIVE, enable its integration and
                  successfully connect it before creating
                  a payment batch.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-[#E8E9F0] bg-[#FAFAFC] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A8FA2]">
                  Connected Funding Accounts
                </p>

                <p className="mt-1 text-sm text-[#555B72]">
                  {fundingAccounts.length} account
                  {fundingAccounts.length === 1
                    ? ""
                    : "s"} available for payments.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {fundingAccounts.map(
                  (account) => (
                    <div
                      key={account.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                    >
                      <CheckCircle2
                        size={14}
                      />

                      {account.bankName} ·{" "}
                      {maskAccountNumber(
                        account.accountNumber,
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            EMPTY / BATCH LIST
        ================================================= */}

        {batches.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#D9DAE4] bg-[#FAFAFC] p-10 text-center">
            <Wallet
              size={32}
              className="mx-auto text-[#8A8FA2]"
            />

            <h3 className="mt-3 font-semibold text-[#20243A]">
              No payment batches yet
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#73788E]">
              Create a payment batch to pay multiple
              recipients from one connected organizational
              bank account.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5F50E6]"
            >
              <Plus size={17} />
              Create Payment Batch
            </button>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-[#E8E9F0]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-[#E8E9F0] bg-[#FAFAFC]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8A8FA2]">
                      Batch
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8A8FA2]">
                      Funding Account
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8A8FA2]">
                      Recipients
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8A8FA2]">
                      Amount
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8A8FA2]">
                      Status
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8A8FA2]">
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8E9F0] bg-white">
                  {batches.map(
                    (batch) => {
                      const account =
                        accounts.find(
                          (item) =>
                            item.id ===
                            batch.bankAccountId,
                        );

                      return (
                        <tr
                          key={batch.id}
                          className="transition hover:bg-[#FAFAFC]"
                        >
                          <td className="px-4 py-4">
                            <div className="font-semibold text-[#20243A]">
                              {
                                batch.batchReference
                              }
                            </div>

                            {batch.description && (
                              <div className="mt-1 max-w-xs truncate text-xs text-[#8A8FA2]">
                                {
                                  batch.description
                                }
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-medium text-[#20243A]">
                              {account?.bankName ??
                                "Bank account"}
                            </div>

                            <div className="mt-1 text-xs text-[#8A8FA2]">
                              {account
                                ? maskAccountNumber(
                                    account.accountNumber,
                                  )
                                : batch.bankAccountId}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm text-[#555B72]">
                            {
                              batch.totalPayments
                            }
                          </td>

                          <td className="px-4 py-4">
                            <span className="font-semibold text-[#20243A]">
                              {formatAmount(
                                Number(
                                  batch.totalAmount,
                                ),
                                account?.currency ??
                                  "KES",
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={[
                                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                getStatusClasses(
                                  batch.status,
                                ),
                              ].join(" ")}
                            >
                              {batch.status
                                .trim()
                                .replace(
                                  /_/g,
                                  " ",
                                )}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-xs text-[#73788E]">
                            {formatDate(
                              batch.createdAt,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F7F8FB] p-4">
            <p className="text-xs text-[#73788E]">
              Connected Funding Accounts
            </p>

            <p className="mt-1 text-xl font-bold text-[#20243A]">
              {fundingAccounts.length}
            </p>
          </div>

          <div className="rounded-xl bg-[#F7F8FB] p-4">
            <p className="text-xs text-[#73788E]">
              Payment Batches
            </p>

            <p className="mt-1 text-xl font-bold text-[#20243A]">
              {batches.length}
            </p>
          </div>

          <div className="rounded-xl bg-[#F7F8FB] p-4">
            <p className="text-xs text-[#73788E]">
              Pending
            </p>

            <p className="mt-1 text-xl font-bold text-[#20243A]">
              {batches.reduce(
                (total, batch) =>
                  total +
                  Number(
                    batch.pending ?? 0,
                  ),
                0,
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ===================================================
          CREATE PAYMENT BATCH MODAL
      =================================================== */}

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}

            <div className="flex items-center justify-between border-b border-[#E8E9F0] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  New Payment Batch
                </h2>

                <p className="mt-1 text-sm text-[#73788E]">
                  Create payments for multiple
                  beneficiaries from one funding account.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#73788E] transition hover:bg-[#F7F8FB] hover:text-[#20243A] disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {fundingAccounts.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      size={20}
                      className="mt-0.5 shrink-0 text-amber-600"
                    />

                    <div>
                      <h3 className="font-semibold text-amber-800">
                        No usable funding account
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-amber-700">
                        A funding account must be ACTIVE,
                        integration-enabled and CONNECTED
                        before payments can be submitted.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Funding account */}

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="payment-funding-account"
                        className="mb-2 block text-sm font-semibold text-[#555B72]"
                      >
                        Funding Bank Account
                      </label>

                      <div className="relative">
                        <select
                          id="payment-funding-account"
                          value={
                            selectedBankAccountId
                          }
                          onChange={(event) => {
                            const accountId =
                              event.target.value;

                            setSelectedBankAccountId(
                              accountId,
                            );

                            const account =
                              fundingAccounts.find(
                                (item) =>
                                  item.id ===
                                  accountId,
                              );

                            if (account) {
                              setRecipients(
                                (current) =>
                                  current.map(
                                    (
                                      recipient,
                                    ) => ({
                                      ...recipient,
                                      currency:
                                        account.currency ||
                                        "KES",
                                    }),
                                  ),
                              );
                            }
                          }}
                          disabled={submitting}
                          className={selectClass}
                        >
                          <option value="">
                            Select funding account
                          </option>

                          {fundingAccounts.map(
                            (account) => (
                              <option
                                key={account.id}
                                value={account.id}
                              >
                                {account.bankName} —{" "}
                                {
                                  account.accountName
                                }{" "}
                                (
                                {maskAccountNumber(
                                  account.accountNumber,
                                )}
                                )
                              </option>
                            ),
                          )}
                        </select>

                        <ChevronDown
                          size={17}
                          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8FA2]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="batch-reference"
                        className="mb-2 block text-sm font-semibold text-[#555B72]"
                      >
                        Batch Reference
                        <span className="ml-1 font-normal text-[#9AA0B4]">
                          optional
                        </span>
                      </label>

                      <input
                        id="batch-reference"
                        value={batchReference}
                        onChange={(event) =>
                          setBatchReference(
                            event.target.value,
                          )
                        }
                        disabled={submitting}
                        placeholder="Auto-generated if empty"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Description */}

                  <div className="mt-5">
                    <label
                      htmlFor="batch-description"
                      className="mb-2 block text-sm font-semibold text-[#555B72]"
                    >
                      Description
                      <span className="ml-1 font-normal text-[#9AA0B4]">
                        optional
                      </span>
                    </label>

                    <input
                      id="batch-description"
                      value={description}
                      onChange={(event) =>
                        setDescription(
                          event.target.value,
                        )
                      }
                      disabled={submitting}
                      placeholder="e.g. August supplier payments"
                      className={inputClass}
                    />
                  </div>

                  {/* Selected funding account */}

                  {selectedAccount && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                            Funding Account
                          </p>

                          <p className="mt-1 font-semibold text-emerald-900">
                            {
                              selectedAccount.bankName
                            }{" "}
                            ·{" "}
                            {
                              selectedAccount.accountName
                            }
                          </p>

                          <p className="mt-1 text-xs text-emerald-700">
                            {maskAccountNumber(
                              selectedAccount.accountNumber,
                            )}{" "}
                            ·{" "}
                            {
                              selectedAccount.currency
                            }
                          </p>
                        </div>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2
                            size={14}
                          />
                          Connected
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Recipients */}

                  <div className="mt-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-[#20243A]">
                          Payment Recipients
                        </h3>

                        <p className="mt-1 text-xs text-[#8A8FA2]">
                          Up to 100 recipients can be
                          included in one batch.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addRecipient}
                        disabled={
                          submitting ||
                          recipients.length >=
                            100
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCDDE7] bg-white px-3.5 py-2 text-sm font-semibold text-[#555B72] transition hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus size={16} />
                        Add Recipient
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {recipients.map(
                        (
                          recipient,
                          index,
                        ) => (
                          <div
                            key={index}
                            className="rounded-2xl border border-[#E8E9F0] bg-[#FAFAFC] p-4"
                          >
                            <div className="mb-4 flex items-center justify-between">
                              <div className="text-sm font-semibold text-[#20243A]">
                                Recipient{" "}
                                {index + 1}
                              </div>

                              {recipients.length >
                                1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeRecipient(
                                      index,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                >
                                  <Trash2
                                    size={14}
                                  />
                                  Remove
                                </button>
                              )}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#555B72]">
                                  Beneficiary Name
                                </label>

                                <input
                                  value={
                                    recipient.beneficiaryName
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRecipient(
                                      index,
                                      "beneficiaryName",
                                      event.target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  placeholder="Full name / company name"
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#555B72]">
                                  Account Number
                                </label>

                                <input
                                  value={
                                    recipient.accountNumber
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRecipient(
                                      index,
                                      "accountNumber",
                                      event.target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  placeholder="Bank account number"
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#555B72]">
                                  Amount
                                </label>

                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={
                                    recipient.amount
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRecipient(
                                      index,
                                      "amount",
                                      event.target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  placeholder="0.00"
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#555B72]">
                                  Currency
                                </label>

                                <select
                                  value={
                                    recipient.currency
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRecipient(
                                      index,
                                      "currency",
                                      event.target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  className={
                                    selectClass
                                  }
                                >
                                  <option value="KES">
                                    KES
                                  </option>

                                  <option value="USD">
                                    USD
                                  </option>

                                  <option value="EUR">
                                    EUR
                                  </option>

                                  <option value="GBP">
                                    GBP
                                  </option>

                                  <option value="UGX">
                                    UGX
                                  </option>

                                  <option value="TZS">
                                    TZS
                                  </option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#555B72]">
                                  Bank Code
                                  <span className="ml-1 font-normal text-[#9AA0B4]">
                                    optional
                                  </span>
                                </label>

                                <input
                                  value={
                                    recipient.bankCode
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRecipient(
                                      index,
                                      "bankCode",
                                      event.target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  placeholder="Bank code"
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#555B72]">
                                  Branch Code
                                  <span className="ml-1 font-normal text-[#9AA0B4]">
                                    optional
                                  </span>
                                </label>

                                <input
                                  value={
                                    recipient.branchCode
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRecipient(
                                      index,
                                      "branchCode",
                                      event.target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  placeholder="Branch code"
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div className="md:col-span-2 lg:col-span-3">
                                <label className="mb-2 block text-xs font-semibold text-[#555B72]">
                                  Payment Description
                                  <span className="ml-1 font-normal text-[#9AA0B4]">
                                    optional
                                  </span>
                                </label>

                                <input
                                  value={
                                    recipient.description
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRecipient(
                                      index,
                                      "description",
                                      event.target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                  placeholder="Payment description"
                                  className={
                                    inputClass
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Summary */}

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#F7F8FB] p-4">
                      <p className="text-xs text-[#73788E]">
                        Recipients
                      </p>

                      <p className="mt-1 text-xl font-bold text-[#20243A]">
                        {validRecipientCount} /{" "}
                        {recipients.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F7F8FB] p-4">
                      <p className="text-xs text-[#73788E]">
                        Total Amount
                      </p>

                      <p className="mt-1 text-xl font-bold text-[#20243A]">
                        {formatAmount(
                          totalAmount,
                          selectedAccount?.currency ??
                            "KES",
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F7F8FB] p-4">
                      <p className="text-xs text-[#73788E]">
                        Funding Account
                      </p>

                      <p className="mt-1 truncate text-sm font-bold text-[#20243A]">
                        {selectedAccount
                          ? `${selectedAccount.bankName} · ${maskAccountNumber(
                              selectedAccount.accountNumber,
                            )}`
                          : "Not selected"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}

            <div className="flex flex-col-reverse gap-3 border-t border-[#E8E9F0] bg-[#FAFAFC] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#8A8FA2]">
                Creating the batch records the payments in
                Ziya FOS. Final bank settlement depends on
                the configured bank provider connection.
              </p>

              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="rounded-xl border border-[#E0E2E9] bg-white px-4 py-2.5 text-sm font-semibold text-[#555B72] transition hover:bg-[#F7F8FB] disabled:opacity-50"
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
                    fundingAccounts.length === 0 ||
                    !selectedAccount ||
                    recipients.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5F50E6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Creating Batch...
                    </>
                  ) : (
                    <>
                      <Wallet size={17} />
                      Create Payment Batch
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}