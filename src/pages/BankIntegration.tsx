import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Edit3,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
  ReactNode,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  authenticatedFetch,
  getAuthToken,
} from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName?: string | null;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  integrationEnabled: boolean;
  integrationProvider?: string | null;
  apiBaseUrl?: string | null;
  webhookUrl?: string | null;
  connectionStatus: string;
  status: string;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface BankAccountForm {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  currency: string;
  openingBalance: string;
  integrationEnabled: boolean;
  integrationProvider: string;
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
}

interface Notice {
  type: "success" | "error";
  message: string;
}

type Tab =
  | "accounts"
  | "connections"
  | "payments"
  | "transactions"
  | "providers";

/* =========================================================
   CONSTANTS
========================================================= */

const BANK_PROVIDERS = [
  {
    id: "kcb",
    name: "KCB Bank",
  },
  {
    id: "equity",
    name: "Equity Bank",
  },
  {
    id: "coop",
    name: "Co-operative Bank",
  },
  {
    id: "ncba",
    name: "NCBA Bank",
  },
  {
    id: "absa",
    name: "Absa Bank",
  },
  {
    id: "stanbic",
    name: "Stanbic Bank",
  },
  {
    id: "im",
    name: "I&M Bank",
  },
  {
    id: "scb",
    name: "Standard Chartered Bank",
  },
  {
    id: "dtb",
    name: "Diamond Trust Bank",
  },
  {
    id: "custom",
    name: "Other / Custom Bank",
  },
] as const;

const CURRENCIES = [
  "KES",
  "USD",
  "EUR",
  "GBP",
  "UGX",
  "TZS",
];

const EMPTY_FORM: BankAccountForm = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
  currency: "KES",
  openingBalance: "0",
  integrationEnabled: false,
  integrationProvider: "",
  apiBaseUrl: "",
  apiKey: "",
  apiSecret: "",
  webhookUrl: "",
};

const inputClass =
  "w-full rounded-xl border border-[#E6E8EF] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#9AA0B4] focus:border-[#6D5DF5] focus:ring-4 focus:ring-[#6D5DF5]/10 disabled:bg-[#F7F8FB] disabled:opacity-60";

const selectClass =
  "w-full rounded-xl border border-[#E6E8EF] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#6D5DF5] focus:ring-4 focus:ring-[#6D5DF5]/10 disabled:bg-[#F7F8FB] disabled:opacity-60";

/* =========================================================
   HELPERS
========================================================= */

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : fallback;
}

function authHeaders(): HeadersInit {
  const token =
    getAuthToken();

  return {
    "Content-Type":
      "application/json",
    Accept:
      "application/json",
    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),
  };
}

async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<any> {
  const response =
    await authenticatedFetch(
      path,
      {
        ...init,
        headers: {
          ...authHeaders(),
          ...(init?.headers ?? {}),
        },
      },
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        data?.error ??
        `Request failed (${response.status})`,
    );
  }

  return data;
}

function formatCurrency(
  amount: number,
  currency = "KES",
): string {
  const value =
    Number(amount);

  if (
    !Number.isFinite(value)
  ) {
    return `${currency} 0.00`;
  }

  try {
    return new Intl.NumberFormat(
      "en-KE",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function maskAccountNumber(
  value: string,
): string {
  const cleaned =
    value.trim();

  if (cleaned.length <= 4) {
    return cleaned;
  }

  return `•••• ${cleaned.slice(
    -4,
  )}`;
}

function providerName(
  provider?: string | null,
): string {
  if (!provider) {
    return "Not configured";
  }

  const match =
    BANK_PROVIDERS.find(
      (item) =>
        item.id ===
        provider
          .trim()
          .toLowerCase(),
    );

  return (
    match?.name ??
    provider
  );
}

function connectionIsGood(
  status?: string,
): boolean {
  return (
    status?.toUpperCase() ===
    "CONNECTED"
  );
}

function integrationIsEnabled(
  account: BankAccount,
): boolean {
  return (
    account.integrationEnabled ===
    true
  );
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E9F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#73788E]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
            {value}
          </p>

          <p className="mt-1 text-xs text-[#8A8FA2]">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#6D5DF5]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status
      .trim()
      .toUpperCase();

  const connected =
    normalized ===
    "CONNECTED";

  const active =
    normalized ===
    "ACTIVE";

  const label =
    normalized ===
    "CONNECTED"
      ? "Connected"
      : normalized ===
          "ACTIVE"
        ? "Active"
        : normalized
            .toLowerCase()
            .replace(
              /^\w/,
              (letter) =>
                letter.toUpperCase(),
            );

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        connected ||
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[#E7E8EF] bg-[#F7F8FB] text-[#73788E]",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          connected ||
          active
            ? "bg-emerald-500"
            : "bg-[#9AA0B4]",
        ].join(" ")}
      />
      {label}
    </span>
  );
}

function NoticeBar({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const success =
    notice.type ===
    "success";

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      ].join(" ")}
    >
      {success ? (
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
        onClick={onClose}
        className="rounded-md p-0.5 opacity-70 transition hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function BankIntegration() {
  const navigate =
    useNavigate();

  const [accounts, setAccounts] =
    useState<BankAccount[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    testingConnectionId,
    setTestingConnectionId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<string | null>(
      null,
    );

  const [notice, setNotice] =
    useState<Notice | null>(
      null,
    );

  const [search, setSearch] =
    useState("");

  const [providerFilter, setProviderFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [activeTab, setActiveTab] =
    useState<Tab>(
      "accounts",
    );

  const [formOpen, setFormOpen] =
    useState(false);

  const [editing, setEditing] =
    useState<BankAccount | null>(
      null,
    );

  const [form, setForm] =
    useState<BankAccountForm>(
      EMPTY_FORM,
    );

  /* =======================================================
     LOAD ACCOUNTS
  ======================================================= */

  const loadAccounts =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const data =
            await apiFetch(
              "/api/bank-accounts",
            );

          const result =
            Array.isArray(
              data?.accounts,
            )
              ? data.accounts
              : Array.isArray(data)
                ? data
                : [];

          setAccounts(result);
        } catch (error) {
          setAccounts([]);

          setNotice({
            type: "error",
            message:
              getErrorMessage(
                error,
                "Failed to load bank accounts.",
              ),
          });
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const filteredAccounts =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return accounts.filter(
        (account) => {
          const matchesSearch =
            !term ||
            [
              account.bankName,
              account.accountName,
              account.accountNumber,
              account.branchName,
              account.currency,
              account.integrationProvider,
              account.status,
              account.connectionStatus,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(term);

          const matchesProvider =
            providerFilter ===
              "ALL" ||
            (
              account.integrationProvider ??
              ""
            ).toLowerCase() ===
              providerFilter.toLowerCase();

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            account.status
              .toUpperCase() ===
              statusFilter;

          return (
            matchesSearch &&
            matchesProvider &&
            matchesStatus
          );
        },
      );
    }, [
      accounts,
      search,
      providerFilter,
      statusFilter,
    ]);

  const activeAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account.status.toUpperCase() ===
            "ACTIVE",
        ),
      [accounts],
    );

  const connectedAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            connectionIsGood(
              account.connectionStatus,
            ),
        ),
      [accounts],
    );

  const integrationAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            integrationIsEnabled(
              account,
            ),
        ),
      [accounts],
    );

  const kesBalance =
    useMemo(
      () =>
        activeAccounts.reduce(
          (total, account) => {
            if (
              account.currency
                .toUpperCase() !==
              "KES"
            ) {
              return total;
            }

            return (
              total +
              Number(
                account.currentBalance,
              )
            );
          },
          0,
        ),
      [activeAccounts],
    );

  /* =======================================================
     FORM
  ======================================================= */

  const resetForm =
    () => {
      setForm({
        ...EMPTY_FORM,
      });

      setEditing(null);
    };

  const openCreate =
    () => {
      resetForm();

      setNotice(null);

      setFormOpen(true);
    };

  const openEdit = (
    account: BankAccount,
  ) => {
    setEditing(account);

    setForm({
      bankName:
        account.bankName,
      accountName:
        account.accountName,
      accountNumber:
        account.accountNumber,
      branchName:
        account.branchName ??
        "",
      currency:
        account.currency,
      openingBalance:
        String(
          account.openingBalance,
        ),
      integrationEnabled:
        account.integrationEnabled,
      integrationProvider:
        account.integrationProvider ??
        "",
      apiBaseUrl:
        account.apiBaseUrl ??
        "",
      /*
       * Secrets are intentionally NOT loaded
       * into the browser.
       */
      apiKey: "",
      apiSecret: "",
      webhookUrl:
        account.webhookUrl ??
        "",
    });

    setNotice(null);

    setFormOpen(true);
  };

  const closeForm =
    () => {
      if (saving) {
        return;
      }

      setFormOpen(false);

      resetForm();
    };

  const updateForm = <
    K extends keyof BankAccountForm,
  >(
    key: K,
    value: BankAccountForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleBankChange =
    (value: string) => {
      const selected =
        BANK_PROVIDERS.find(
          (provider) =>
            provider.name ===
            value,
        );

      setForm(
        (current) => ({
          ...current,
          bankName: value,
          integrationProvider:
            selected?.id ??
            current.integrationProvider,
        }),
      );
    };

  /* =======================================================
     SAVE ACCOUNT
  ======================================================= */

  const handleSubmit =
    async (
      event: FormEvent,
    ) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      setNotice(null);

      const bankName =
        form.bankName.trim();

      const accountName =
        form.accountName.trim();

      const accountNumber =
        form.accountNumber.trim();

      if (!bankName) {
        setNotice({
          type: "error",
          message:
            "Bank name is required.",
        });

        return;
      }

      if (!accountName) {
        setNotice({
          type: "error",
          message:
            "Account name is required.",
        });

        return;
      }

      if (!accountNumber) {
        setNotice({
          type: "error",
          message:
            "Account number is required.",
        });

        return;
      }

      const openingBalance =
        Number(
          form.openingBalance,
        );

      if (
        !Number.isFinite(
          openingBalance,
        ) ||
        openingBalance < 0
      ) {
        setNotice({
          type: "error",
          message:
            "Opening balance must be zero or greater.",
        });

        return;
      }

      if (
        form.integrationEnabled
      ) {
        if (
          !form.integrationProvider.trim()
        ) {
          setNotice({
            type: "error",
            message:
              "Select a bank integration provider.",
          });

          return;
        }

        if (
          !form.apiBaseUrl.trim()
        ) {
          setNotice({
            type: "error",
            message:
              "API Base URL is required when bank integration is enabled.",
          });

          return;
        }

        try {
          const parsed =
            new URL(
              form.apiBaseUrl.trim(),
            );

          const localhost =
            parsed.hostname ===
              "localhost" ||
            parsed.hostname ===
              "127.0.0.1";

          if (
            parsed.protocol !==
              "https:" &&
            !localhost
          ) {
            setNotice({
              type: "error",
              message:
                "Bank API Base URL must use HTTPS.",
            });

            return;
          }
        } catch {
          setNotice({
            type: "error",
            message:
              "Enter a valid bank API Base URL.",
          });

          return;
        }
      }

      const payload: Record<
        string,
        unknown
      > = {
        bankName,
        accountName,
        accountNumber,
        branchName:
          form.branchName.trim() ||
          undefined,
        currency:
          form.currency,
        integrationEnabled:
          form.integrationEnabled,
        integrationProvider:
          form.integrationEnabled
            ? form.integrationProvider.trim()
            : undefined,
        apiBaseUrl:
          form.integrationEnabled
            ? form.apiBaseUrl.trim()
            : undefined,
        webhookUrl:
          form.webhookUrl.trim() ||
          undefined,
      };

      /*
       * Never send empty credential fields during
       * an edit. This allows the backend to preserve
       * the already encrypted credentials.
       */
      if (
        form.apiKey.trim()
      ) {
        payload.apiKey =
          form.apiKey.trim();
      }

      if (
        form.apiSecret.trim()
      ) {
        payload.apiSecret =
          form.apiSecret.trim();
      }

      if (!editing) {
        payload.openingBalance =
          openingBalance;
      }

      try {
        setSaving(true);

        if (editing) {
          const data =
            await apiFetch(
              `/api/bank-accounts/${editing.id}`,
              {
                method: "PUT",
                body:
                  JSON.stringify(
                    payload,
                  ),
              },
            );

          const updated =
            data?.account ??
            data;

          setAccounts(
            (current) =>
              current.map(
                (account) =>
                  account.id ===
                  updated.id
                    ? updated
                    : account,
              ),
          );

          setNotice({
            type: "success",
            message:
              "Bank account configuration updated successfully.",
          });
        } else {
          const data =
            await apiFetch(
              "/api/bank-accounts",
              {
                method: "POST",
                body:
                  JSON.stringify(
                    payload,
                  ),
              },
            );

          const created =
            data?.account ??
            data;

          setAccounts(
            (current) => [
              created,
              ...current,
            ],
          );

          setNotice({
            type: "success",
            message:
              "Bank account added successfully.",
          });
        }

        setFormOpen(false);

        resetForm();
      } catch (error) {
        setNotice({
          type: "error",
          message:
            getErrorMessage(
              error,
              "Failed to save bank account.",
            ),
        });
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     CONNECTION TEST
  ======================================================= */

  const testConnection =
    async (
      account: BankAccount,
    ) => {
      if (
        testingConnectionId
      ) {
        return;
      }

      setTestingConnectionId(
        account.id,
      );

      setNotice(null);

      try {
        const data =
          await apiFetch(
            `/api/bank-accounts/${account.id}/test`,
            {
              method: "POST",
            },
          );

        const connected =
          Boolean(
            data?.connected ??
              data?.success,
          );

        setAccounts(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                account.id
                  ? {
                      ...item,
                      connectionStatus:
                        connected
                          ? "CONNECTED"
                          : "DISCONNECTED",
                    }
                  : item,
            ),
        );

        setNotice({
          type: connected
            ? "success"
            : "error",
          message:
            data?.message ??
            (connected
              ? "Bank connection is working correctly."
              : "Bank connection test failed."),
        });
      } catch (error) {
        setNotice({
          type: "error",
          message:
            getErrorMessage(
              error,
              "Bank connection test failed.",
            ),
        });
      } finally {
        setTestingConnectionId(
          null,
        );
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete =
    async (
      account: BankAccount,
    ) => {
      const confirmed =
        window.confirm(
          `Delete "${account.accountName}" (${maskAccountNumber(account.accountNumber)})?\n\nThis cannot be undone.`,
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingId(
          account.id,
        );

        setNotice(null);

        await apiFetch(
          `/api/bank-accounts/${account.id}`,
          {
            method: "DELETE",
          },
        );

        setAccounts(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                account.id,
            ),
        );

        setNotice({
          type: "success",
          message:
            "Bank account deleted successfully.",
        });
      } catch (error) {
        setNotice({
          type: "error",
          message:
            getErrorMessage(
              error,
              "Failed to delete bank account.",
            ),
        });
      } finally {
        setDeletingId(null);
      }
    };

  /* =======================================================
     TABS
  ======================================================= */

  const tabs: Array<{
    id: Tab;
    label: string;
  }> = [
    {
      id: "accounts",
      label: "Bank Accounts",
    },
    {
      id: "connections",
      label: "Connection Status",
    },
    {
      id: "payments",
      label: "Payment Batches",
    },
    {
      id: "transactions",
      label: "Transactions",
    },
    {
      id: "providers",
      label: "Providers",
    },
  ];

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full space-y-6 bg-[#F7F7FA] pb-10 text-[#20243A]">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="rounded-2xl border border-[#E8E9F0] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:px-7">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-[#8A8FA2]">
          <span>
            Cash & Banking
          </span>

          <span>
            /
          </span>

          <span className="text-[#20243A]">
            Bank Integration
          </span>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dashboard/cash-bank",
                )
              }
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E6E8EF] bg-white text-[#666B84] transition hover:border-[#6D5DF5]/30 hover:bg-[#F7F5FF] hover:text-[#6D5DF5]"
              aria-label="Back"
            >
              <ArrowLeft
                size={18}
              />
            </button>

            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Bank Integration
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#73788E]">
                Manage organizational bank accounts,
                configure integrations and process
                payments securely.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void loadAccounts()
              }
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E4E6ED] bg-white px-4 py-2.5 text-sm font-semibold text-[#555B72] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
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
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5D4DE5]"
            >
              <Plus size={18} />

              Add Bank Account
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          NOTICE
      ===================================================== */}

      {notice && (
        <NoticeBar
          notice={notice}
          onClose={() =>
            setNotice(null)
          }
        />
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Bank Accounts"
          value={String(
            accounts.length,
          )}
          description={`${activeAccounts.length} active accounts`}
          icon={
            <Building2
              size={21}
            />
          }
        />

        <SummaryCard
          title="Connected"
          value={String(
            connectedAccounts.length,
          )}
          description="Verified connections"
          icon={
            <Link2
              size={21}
            />
          }
        />

        <SummaryCard
          title="Integration Enabled"
          value={String(
            integrationAccounts.length,
          )}
          description="Accounts with integration"
          icon={
            <ShieldCheck
              size={21}
            />
          }
        />

        <SummaryCard
          title="KES Balance"
          value={formatCurrency(
            kesBalance,
            "KES",
          )}
          description={`${new Set(
            accounts.map(
              (account) =>
                account.currency,
            ),
          ).size} currency type(s)`}
          icon={
            <Wallet
              size={21}
            />
          }
        />
      </div>

      {/* =====================================================
          TABS
      ===================================================== */}

      <div className="overflow-x-auto rounded-2xl border border-[#E8E9F0] bg-white px-2">
        <div className="flex min-w-max">
          {tabs.map(
            (tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab.id,
                  )
                }
                className={[
                  "border-b-2 px-5 py-4 text-sm font-semibold transition",
                  activeTab ===
                  tab.id
                    ? "border-[#6D5DF5] text-[#6D5DF5]"
                    : "border-transparent text-[#73788E] hover:text-[#20243A]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* =====================================================
          BANK ACCOUNTS
      ===================================================== */}

      {activeTab ===
        "accounts" && (
        <>
          <div className="rounded-2xl border border-[#E8E9F0] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8FA2]"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search bank accounts..."
                  className={`${inputClass} pl-11`}
                />
              </div>

              <div className="relative">
                <select
                  value={
                    providerFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setProviderFilter(
                      event.target
                        .value,
                    )
                  }
                  className={`${selectClass} min-w-[190px] appearance-none pr-10`}
                >
                  <option value="ALL">
                    All Providers
                  </option>

                  {BANK_PROVIDERS.map(
                    (provider) => (
                      <option
                        key={
                          provider.id
                        }
                        value={
                          provider.id
                        }
                      >
                        {
                          provider.name
                        }
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8FA2]"
                />
              </div>

              <div className="relative">
                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusFilter(
                      event.target
                        .value,
                    )
                  }
                  className={`${selectClass} min-w-[160px] appearance-none pr-10`}
                >
                  <option value="ALL">
                    All Status
                  </option>

                  <option value="ACTIVE">
                    Active
                  </option>

                  <option value="INACTIVE">
                    Inactive
                  </option>
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8FA2]"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#E8E9F0] bg-white">
              <div className="text-center">
                <Loader2
                  size={30}
                  className="mx-auto animate-spin text-[#6D5DF5]"
                />

                <p className="mt-3 text-sm text-[#73788E]">
                  Loading bank accounts...
                </p>
              </div>
            </div>
          ) : filteredAccounts.length ===
            0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#DCDDE7] bg-white px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1EEFF] text-[#6D5DF5]">
                <Building2
                  size={29}
                />
              </div>

              <h2 className="mt-5 text-lg font-bold">
                {accounts.length ===
                0
                  ? "No bank accounts added"
                  : "No matching accounts"}
              </h2>

              <p className="mt-2 max-w-md text-sm leading-6 text-[#73788E]">
                {accounts.length ===
                0
                  ? "Add a bank account to start managing your organization's banking and integrations."
                  : "Try a different search or filter."}
              </p>

              {accounts.length ===
                0 && (
                <button
                  type="button"
                  onClick={
                    openCreate
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6D5DF5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5D4DE5]"
                >
                  <Plus
                    size={18}
                  />

                  Add First Bank
                  Account
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {filteredAccounts.map(
                (account) => (
                  <div
                    key={
                      account.id
                    }
                    className="rounded-2xl border border-[#E8E9F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-[#6D5DF5]/25 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#6D5DF5]">
                          <Building2
                            size={23}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-bold">
                              {
                                account.accountName
                              }
                            </h2>

                            <StatusBadge
                              status={
                                account.status
                              }
                            />
                          </div>

                          <p className="mt-1 text-sm font-semibold text-[#6D5DF5]">
                            {
                              account.bankName
                            }
                          </p>

                          <p className="mt-0.5 font-mono text-sm text-[#73788E]">
                            {maskAccountNumber(
                              account.accountNumber,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(
                              account,
                            )
                          }
                          className="rounded-lg p-2 text-[#73788E] transition hover:bg-[#F7F8FB] hover:text-[#20243A]"
                          title="Configure"
                        >
                          <Edit3
                            size={17}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDelete(
                              account,
                            )
                          }
                          disabled={
                            deletingId ===
                            account.id
                          }
                          className="rounded-lg p-2 text-[#73788E] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          title="Delete"
                        >
                          {deletingId ===
                          account.id ? (
                            <Loader2
                              size={
                                17
                              }
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2
                              size={
                                17
                              }
                            />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-[#F7F8FB] p-4">
                        <p className="text-xs font-medium text-[#73788E]">
                          Current Balance
                        </p>

                        <p className="mt-1 text-xl font-bold">
                          {formatCurrency(
                            Number(
                              account.currentBalance,
                            ),
                            account.currency,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#F7F8FB] p-4">
                        <p className="text-xs font-medium text-[#73788E]">
                          Connection
                        </p>

                        <div className="mt-2">
                          <StatusBadge
                            status={
                              account.connectionStatus ||
                              "DISCONNECTED"
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-[#ECECF3] pt-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#73788E]">
                          Provider
                        </span>

                        <span className="font-semibold">
                          {providerName(
                            account.integrationProvider,
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#73788E]">
                          Integration
                        </span>

                        <span className="font-semibold">
                          {account.integrationEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#73788E]">
                          Last Sync
                        </span>

                        <span className="font-medium text-[#555B72]">
                          {formatDate(
                            account.lastSyncAt,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void testConnection(
                            account,
                          )
                        }
                        disabled={
                          testingConnectionId ===
                            account.id ||
                          !account.integrationEnabled
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[#E2E3EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#555B72] transition hover:border-[#6D5DF5]/30 hover:bg-[#F8F7FF] hover:text-[#6D5DF5] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {testingConnectionId ===
                        account.id ? (
                          <Loader2
                            size={
                              16
                            }
                            className="animate-spin"
                          />
                        ) : (
                          <Zap
                            size={
                              16
                            }
                          />
                        )}

                        Test Connection
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEdit(
                            account,
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-[#F1EEFF] px-3.5 py-2 text-sm font-semibold text-[#6D5DF5] transition hover:bg-[#EAE6FF]"
                      >
                        <KeyRound
                          size={
                            16
                          }
                        />

                        Configuration
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}

      {/* =====================================================
          CONNECTION STATUS
      ===================================================== */}

      {activeTab ===
        "connections" && (
        <div className="grid gap-5">
          {accounts.length ===
          0 ? (
            <div className="rounded-2xl border border-[#E8E9F0] bg-white p-10 text-center">
              <Link2
                size={35}
                className="mx-auto text-[#6D5DF5]"
              />

              <h2 className="mt-4 text-lg font-bold">
                No connections configured
              </h2>

              <p className="mt-2 text-sm text-[#73788E]">
                Add a bank account and configure
                its API connection.
              </p>
            </div>
          ) : (
            accounts.map(
              (account) => {
                const connected =
                  connectionIsGood(
                    account.connectionStatus,
                  );

                return (
                  <div
                    key={
                      account.id
                    }
                    className="rounded-2xl border border-[#E8E9F0] bg-white p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#6D5DF5]">
                          {connected ? (
                            <CheckCircle2
                              size={
                                22
                              }
                            />
                          ) : (
                            <Link2
                              size={
                                22
                              }
                            />
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold">
                            {
                              account.accountName
                            }
                          </h3>

                          <p className="text-sm text-[#73788E]">
                            {
                              account.bankName
                            }{" "}
                            ·{" "}
                            {providerName(
                              account.integrationProvider,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge
                          status={
                            account.connectionStatus ||
                            "DISCONNECTED"
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            void testConnection(
                              account,
                            )
                          }
                          disabled={
                            testingConnectionId ===
                              account.id ||
                            !account.integrationEnabled
                          }
                          className="rounded-xl border border-[#E3E4EC] px-3.5 py-2 text-sm font-semibold text-[#555B72] disabled:opacity-50"
                        >
                          {testingConnectionId ===
                          account.id
                            ? "Testing..."
                            : "Test Again"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              },
            )
          )}
        </div>
      )}

      {/* =====================================================
          PAYMENT BATCHES
      ===================================================== */}

      {activeTab ===
        "payments" && (
        <div className="rounded-2xl border border-[#E8E9F0] bg-white p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#6D5DF5]">
                  <CircleDollarSign
                    size={22}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-bold">
                    Bank Payment Batches
                  </h2>

                  <p className="mt-1 text-sm text-[#73788E]">
                    Pay multiple recipients from a connected
                    organizational bank account.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#6D5DF5] px-4 py-2.5 text-sm font-semibold text-white opacity-50"
              title="Payment batch backend is not yet enabled"
            >
              <Plus size={17} />
              New Payment Batch
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-[#D9DAE4] bg-[#FAFAFC] p-8 text-center">
            <Wallet
              size={30}
              className="mx-auto text-[#8A8FA2]"
            />

            <h3 className="mt-3 font-semibold">
              Multiple-account payments
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#73788E]">
              The payment workspace will use the connected
              bank accounts above as funding accounts and
              will support multiple recipients in one batch.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#F7F8FB] p-4">
              <p className="text-xs text-[#73788E]">
                Connected Funding Accounts
              </p>

              <p className="mt-1 text-xl font-bold">
                {
                  connectedAccounts.length
                }
              </p>
            </div>

            <div className="rounded-xl bg-[#F7F8FB] p-4">
              <p className="text-xs text-[#73788E]">
                Payment Batches
              </p>

              <p className="mt-1 text-xl font-bold">
                —
              </p>
            </div>

            <div className="rounded-xl bg-[#F7F8FB] p-4">
              <p className="text-xs text-[#73788E]">
                Pending
              </p>

              <p className="mt-1 text-xl font-bold">
                —
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          TRANSACTIONS
      ===================================================== */}

      {activeTab ===
        "transactions" && (
        <div className="rounded-2xl border border-[#E8E9F0] bg-white p-8 text-center">
          <Banknote
            size={34}
            className="mx-auto text-[#6D5DF5]"
          />

          <h2 className="mt-4 text-lg font-bold">
            Bank Transactions
          </h2>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#73788E]">
            Transactions will appear here once a supported
            bank provider adapter is connected and transaction
            synchronization is enabled.
          </p>
        </div>
      )}

      {/* =====================================================
          PROVIDERS
      ===================================================== */}

      {activeTab ===
        "providers" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BANK_PROVIDERS.map(
            (provider) => {
              const count =
                accounts.filter(
                  (account) =>
                    (
                      account.integrationProvider ??
                      ""
                    ).toLowerCase() ===
                    provider.id,
                ).length;

              return (
                <div
                  key={
                    provider.id
                  }
                  className="rounded-2xl border border-[#E8E9F0] bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#6D5DF5]">
                      <Building2
                        size={21}
                      />
                    </div>

                    <span className="rounded-full bg-[#F7F8FB] px-2.5 py-1 text-xs font-semibold text-[#73788E]">
                      {count}{" "}
                      account
                      {count ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  </div>

                  <h3 className="mt-4 font-bold">
                    {
                      provider.name
                    }
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#73788E]">
                    Customer-owned API credentials can be
                    configured securely for this provider.
                  </p>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* =====================================================
          SECURITY NOTE
      ===================================================== */}

      <div className="flex items-start gap-3 rounded-2xl border border-[#E5E6ED] bg-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#6D5DF5]">
          <Lock
            size={19}
          />
        </div>

        <div>
          <p className="text-sm font-semibold">
            Bank credentials are protected
          </p>

          <p className="mt-1 text-xs leading-5 text-[#73788E]">
            API secrets are handled by the secure backend
            and are never returned to the browser when an
            account is edited. Each bank account remains
            isolated within its organization.
          </p>
        </div>
      </div>

      {/* =====================================================
          ADD / EDIT MODAL
      ===================================================== */}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E4E5EC] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#E8E9F0] bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">
                  {editing
                    ? "Bank Account Configuration"
                    : "Add Bank Account"}
                </h2>

                <p className="mt-1 text-sm text-[#73788E]">
                  {editing
                    ? "Update account details and integration settings."
                    : "Register a bank account and optionally connect its bank API."}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeForm
                }
                disabled={saving}
                className="rounded-lg p-2 text-[#73788E] transition hover:bg-[#F7F8FB] hover:text-[#20243A] disabled:opacity-50"
              >
                <X
                  size={21}
                />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="p-6"
            >
              {/* ACCOUNT DETAILS */}

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Building2
                    size={18}
                    className="text-[#6D5DF5]"
                  />

                  <h3 className="font-bold">
                    Account Details
                  </h3>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">
                      Bank Name
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <div className="relative">
                      <select
                        value={
                          form.bankName
                        }
                        onChange={(
                          event,
                        ) =>
                          handleBankChange(
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          saving
                        }
                        className={`${selectClass} appearance-none pr-10`}
                      >
                        <option value="">
                          Select bank...
                        </option>

                        {BANK_PROVIDERS.map(
                          (
                            provider,
                          ) => (
                            <option
                              key={
                                provider.id
                              }
                              value={
                                provider.name
                              }
                            >
                              {
                                provider.name
                              }
                            </option>
                          ),
                        )}
                      </select>

                      <ChevronDown
                        size={
                          16
                        }
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8FA2]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">
                      Currency
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <select
                      value={
                        form.currency
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "currency",
                          event
                            .target
                            .value,
                        )
                      }
                      disabled={
                        saving
                      }
                      className={
                        selectClass
                      }
                    >
                      {CURRENCIES.map(
                        (
                          currency,
                        ) => (
                          <option
                            key={
                              currency
                            }
                            value={
                              currency
                            }
                          >
                            {
                              currency
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">
                      Account Name
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      value={
                        form.accountName
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "accountName",
                          event
                            .target
                            .value,
                        )
                      }
                      disabled={
                        saving
                      }
                      placeholder="e.g. Operations Account"
                      className={
                        inputClass
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">
                      Account Number
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      value={
                        form.accountNumber
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "accountNumber",
                          event
                            .target
                            .value,
                        )
                      }
                      disabled={
                        saving
                      }
                      autoComplete="off"
                      placeholder="Enter bank account number"
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">
                      Branch Name
                    </label>

                    <input
                      value={
                        form.branchName
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "branchName",
                          event
                            .target
                            .value,
                        )
                      }
                      disabled={
                        saving
                      }
                      placeholder="e.g. Westlands Branch"
                      className={
                        inputClass
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">
                      Opening Balance
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.openingBalance
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "openingBalance",
                          event
                            .target
                            .value,
                        )
                      }
                      disabled={
                        saving ||
                        Boolean(
                          editing,
                        )
                      }
                      className={
                        inputClass
                      }
                    />

                    {editing && (
                      <p className="mt-1 text-xs text-[#8A8FA2]">
                        Opening balance cannot be changed after creation.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* INTEGRATION */}

              <div className="mt-8 border-t border-[#E8E9F0] pt-7">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Zap
                      size={18}
                      className="text-[#6D5DF5]"
                    />

                    <div>
                      <h3 className="font-bold">
                        Bank API Configuration
                      </h3>

                      <p className="mt-1 text-xs text-[#73788E]">
                        Connect this account using the customer's bank API.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={
                      form.integrationEnabled
                    }
                    onClick={() =>
                      updateForm(
                        "integrationEnabled",
                        !form.integrationEnabled,
                      )
                    }
                    disabled={
                      saving
                    }
                    className={[
                      "relative h-6 w-11 rounded-full transition",
                      form.integrationEnabled
                        ? "bg-[#6D5DF5]"
                        : "bg-[#D8DAE3]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
                        form.integrationEnabled
                          ? "left-6"
                          : "left-1",
                      ].join(" ")}
                    />
                  </button>
                </div>

                {form.integrationEnabled ? (
                  <div className="rounded-2xl border border-[#E5E1FF] bg-[#FAF9FF] p-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold">
                          Integration Provider
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <select
                          value={
                            form.integrationProvider
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              "integrationProvider",
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            saving
                          }
                          className={
                            selectClass
                          }
                        >
                          <option value="">
                            Select provider...
                          </option>

                          {BANK_PROVIDERS.map(
                            (
                              provider,
                            ) => (
                              <option
                                key={
                                  provider.id
                                }
                                value={
                                  provider.id
                                }
                              >
                                {
                                  provider.name
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold">
                          API Base URL
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <input
                          type="url"
                          value={
                            form.apiBaseUrl
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              "apiBaseUrl",
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            saving
                          }
                          placeholder="https://api.yourbank.com"
                          autoComplete="url"
                          className={
                            inputClass
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold">
                          API Key
                        </label>

                        <input
                          type="password"
                          value={
                            form.apiKey
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              "apiKey",
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            saving
                          }
                          autoComplete="new-password"
                          placeholder={
                            editing
                              ? "Leave blank to keep existing key"
                              : "Enter API key"
                          }
                          className={
                            inputClass
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold">
                          API Secret
                        </label>

                        <input
                          type="password"
                          value={
                            form.apiSecret
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              "apiSecret",
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            saving
                          }
                          autoComplete="new-password"
                          placeholder={
                            editing
                              ? "Leave blank to keep existing secret"
                              : "Enter API secret"
                          }
                          className={
                            inputClass
                          }
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-sm font-semibold">
                          Webhook URL
                        </label>

                        <input
                          type="url"
                          value={
                            form.webhookUrl
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              "webhookUrl",
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            saving
                          }
                          placeholder="https://your-domain.com/api/bank/webhook"
                          className={
                            inputClass
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#DDD8FF] bg-white p-4">
                      <ShieldCheck
                        size={18}
                        className="mt-0.5 shrink-0 text-[#6D5DF5]"
                      />

                      <div>
                        <p className="text-sm font-semibold">
                          Secure credential handling
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#73788E]">
                          Credentials are sent to the Ziya FOS
                          backend only. Existing credentials are
                          not returned to this page when editing.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E8E9F0] bg-[#F8F9FC] p-4 text-sm text-[#73788E]">
                    Integration is disabled. The account can
                    still be maintained as a manual bank account.
                  </div>
                )}
              </div>

              {/* FORM ACTIONS */}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#E8E9F0] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closeForm
                  }
                  disabled={
                    saving
                  }
                  className="rounded-xl border border-[#E3E4EC] bg-white px-5 py-2.5 text-sm font-semibold text-[#555B72] transition hover:bg-[#F8F9FC] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5D4DE5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : editing ? (
                    <Edit3
                      size={17}
                    />
                  ) : (
                    <Plus
                      size={17}
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Configuration"
                      : "Add Bank Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}