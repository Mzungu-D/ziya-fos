import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit3,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
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
  createdAt: string;
  updatedAt: string;
}

interface BankForm {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  currency: string;
  openingBalance: string;
}

interface IntegrationForm {
  integrationEnabled: boolean;
  integrationProvider: string;
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

const KENYAN_BANKS = [
  "Equity Bank",
  "KCB Bank",
  "Co-operative Bank",
  "Absa Bank Kenya",
  "Standard Chartered Bank",
  "NCBA Bank",
  "Diamond Trust Bank (DTB)",
  "I&M Bank",
  "Family Bank",
  "Stanbic Bank",
  "Prime Bank",
  "NIC Bank",
  "HFC Bank",
  "Gulf African Bank",
  "Victoria Commercial Bank",
  "Other",
];

const CURRENCIES = [
  "KES",
  "USD",
  "EUR",
  "GBP",
  "UGX",
  "TZS",
];

const EMPTY_BANK_FORM: BankForm = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
  currency: "KES",
  openingBalance: "0",
};

const EMPTY_INTEGRATION_FORM: IntegrationForm = {
  integrationEnabled: false,
  integrationProvider: "",
  apiBaseUrl: "",
  apiKey: "",
  apiSecret: "",
  webhookUrl: "",
};

/* =========================================================
   HELPERS
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
  init?: RequestInit
): Promise<any> {
  const response =
    await authenticatedFetch(path, {
      ...init,
      headers: {
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });

  const data =
    await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        `Request failed (${response.status})`
    );
  }

  return data;
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

function formatMoney(
  value: number,
  currency: string
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `0.00 ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "en-KE",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(
  value: string | undefined
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function connectionLabel(
  status: string
): string {
  const normalized =
    status?.toUpperCase() ??
    "DISCONNECTED";

  return normalized
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#666B84]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#20243A]">
            {value}
          </p>

          {sub && (
            <p className="mt-1 text-xs text-[#666B84]">
              {sub}
            </p>
          )}
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#6D5DF6]">
          {icon}
        </div>
      </div>
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
    status?.toUpperCase() ??
    "UNKNOWN";

  let classes =
    "border-[#ECECF3] bg-[#F8F9FC] text-[#666B84]";

  if (normalized === "ACTIVE") {
    classes =
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  }

  if (normalized === "CONNECTED") {
    classes =
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  }

  if (
    normalized === "ERROR" ||
    normalized === "FAILED"
  ) {
    classes =
      "border-red-500/20 bg-red-500/10 text-red-600";
  }

  if (
    normalized === "PENDING" ||
    normalized === "DISCONNECTED"
  ) {
    classes =
      "border-amber-500/20 bg-amber-500/10 text-amber-700";
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {connectionLabel(normalized)}
    </span>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function BankIntegration() {
  const [accounts, setAccounts] =
    useState<BankAccount[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [integrationSaving, setIntegrationSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [showBankForm, setShowBankForm] =
    useState(false);

  const [showIntegrationForm, setShowIntegrationForm] =
    useState(false);

  const [editing, setEditing] =
    useState<BankAccount | null>(null);

  const [integrationAccount, setIntegrationAccount] =
    useState<BankAccount | null>(null);

  const [bankForm, setBankForm] =
    useState<BankForm>({
      ...EMPTY_BANK_FORM,
    });

  const [integrationForm, setIntegrationForm] =
    useState<IntegrationForm>({
      ...EMPTY_INTEGRATION_FORM,
    });

  /* =======================================================
     LOAD
  ======================================================= */

  const loadAccounts =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await apiFetch(
            "/api/bank-accounts"
          );

        const serverAccounts =
          Array.isArray(
            data?.bankAccounts
          )
            ? data.bankAccounts
            : [];

        setAccounts(
          serverAccounts
        );
      } catch (error) {
        setError(
          getErrorMessage(
            error,
            "Failed to load bank accounts."
          )
        );

        setAccounts([]);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredAccounts =
    useMemo(() => {
      const term =
        search.trim().toLowerCase();

      if (!term) {
        return accounts;
      }

      return accounts.filter(
        (account) =>
          [
            account.bankName,
            account.accountName,
            account.accountNumber,
            account.branchName,
            account.currency,
            account.status,
            account.connectionStatus,
            account.integrationProvider,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term)
      );
    }, [accounts, search]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      const active =
        accounts.filter(
          (account) =>
            account.status?.toUpperCase() ===
            "ACTIVE"
        );

      const connected =
        active.filter(
          (account) =>
            account.connectionStatus?.toUpperCase() ===
            "CONNECTED"
        );

      const enabled =
        active.filter(
          (account) =>
            account.integrationEnabled
        );

      const currencies =
        new Set(
          active.map(
            (account) =>
              account.currency
          )
        );

      const kesBalance =
        active
          .filter(
            (account) =>
              account.currency ===
              "KES"
          )
          .reduce(
            (total, account) =>
              total +
              (Number(
                account.currentBalance
              ) || 0),
            0
          );

      return {
        total: accounts.length,
        active: active.length,
        connected: connected.length,
        enabled: enabled.length,
        currencies: currencies.size,
        kesBalance,
      };
    }, [accounts]);

  /* =======================================================
     BANK FORM
  ======================================================= */

  function openCreate() {
    setEditing(null);
    setBankForm({
      ...EMPTY_BANK_FORM,
    });
    setError("");
    setSuccess("");
    setShowBankForm(true);
  }

  function openEdit(
    account: BankAccount
  ) {
    setEditing(account);

    setBankForm({
      bankName:
        account.bankName ?? "",
      accountName:
        account.accountName ?? "",
      accountNumber:
        account.accountNumber ?? "",
      branchName:
        account.branchName ?? "",
      currency:
        account.currency ?? "KES",
      openingBalance:
        String(
          account.openingBalance ?? 0
        ),
    });

    setError("");
    setSuccess("");
    setShowBankForm(true);
  }

  function closeBankForm() {
    if (saving) return;

    setShowBankForm(false);
    setEditing(null);

    setBankForm({
      ...EMPTY_BANK_FORM,
    });
  }

  async function handleBankSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    if (!bankForm.bankName) {
      setError(
        "Bank name is required."
      );
      return;
    }

    if (
      !bankForm.accountName.trim()
    ) {
      setError(
        "Account name is required."
      );
      return;
    }

    if (
      !bankForm.accountNumber.trim()
    ) {
      setError(
        "Account number is required."
      );
      return;
    }

    const openingBalance =
      Number(
        bankForm.openingBalance
      );

    if (
      !Number.isFinite(
        openingBalance
      ) ||
      openingBalance < 0
    ) {
      setError(
        "Opening balance must be zero or greater."
      );
      return;
    }

    const payload = {
      bankName:
        bankForm.bankName,
      accountName:
        bankForm.accountName.trim(),
      accountNumber:
        bankForm.accountNumber.trim(),
      branchName:
        bankForm.branchName.trim() ||
        undefined,
      currency:
        bankForm.currency,
      openingBalance,
    };

    try {
      setSaving(true);

      if (editing) {
        const data =
          await apiFetch(
            `/api/bank-accounts/${editing.id}`,
            {
              method: "PATCH",
              body: JSON.stringify(
                payload
              ),
            }
          );

        const updated =
          data?.bankAccount;

        if (!updated?.id) {
          throw new Error(
            "The server returned an invalid bank account."
          );
        }

        setAccounts(
          (current) =>
            current.map(
              (account) =>
                account.id ===
                updated.id
                  ? updated
                  : account
            )
        );

        setSuccess(
          "Bank account updated successfully."
        );
      } else {
        const data =
          await apiFetch(
            "/api/bank-accounts",
            {
              method: "POST",
              body: JSON.stringify(
                payload
              ),
            }
          );

        const created =
          data?.bankAccount;

        if (!created?.id) {
          throw new Error(
            "The server returned an invalid bank account."
          );
        }

        setAccounts(
          (current) => [
            created,
            ...current,
          ]
        );

        setSuccess(
          "Bank account added successfully."
        );
      }

      closeBankForm();
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          "Failed to save bank account."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     INTEGRATION FORM
  ======================================================= */

  function openIntegration(
    account: BankAccount
  ) {
    setIntegrationAccount(
      account
    );

    setIntegrationForm({
      integrationEnabled:
        Boolean(
          account.integrationEnabled
        ),

      integrationProvider:
        account.integrationProvider ??
        "",

      apiBaseUrl:
        account.apiBaseUrl ??
        "",

      /*
       * Credentials are intentionally
       * never returned by the backend.
       *
       * Empty means "leave existing
       * credential unchanged".
       */
      apiKey: "",
      apiSecret: "",

      webhookUrl:
        account.webhookUrl ??
        "",
    });

    setError("");
    setSuccess("");
    setShowIntegrationForm(
      true
    );
  }

  function closeIntegration() {
    if (integrationSaving) return;

    setShowIntegrationForm(
      false
    );

    setIntegrationAccount(
      null
    );

    setIntegrationForm({
      ...EMPTY_INTEGRATION_FORM,
    });
  }

  async function handleIntegrationSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      integrationSaving ||
      !integrationAccount
    ) {
      return;
    }

    setError("");
    setSuccess("");

    if (
      integrationForm.integrationEnabled
    ) {
      if (
        !integrationForm
          .integrationProvider
          .trim()
      ) {
        setError(
          "Integration provider is required when integration is enabled."
        );
        return;
      }

      if (
        !integrationForm.apiBaseUrl.trim()
      ) {
        setError(
          "API base URL is required when integration is enabled."
        );
        return;
      }

      try {
        new URL(
          integrationForm.apiBaseUrl.trim()
        );
      } catch {
        setError(
          "API base URL must be a valid URL."
        );
        return;
      }
    }

    try {
      setIntegrationSaving(
        true
      );

      const payload: Record<
        string,
        unknown
      > = {
        integrationEnabled:
          integrationForm.integrationEnabled,

        integrationProvider:
          integrationForm
            .integrationProvider
            .trim() || null,

        apiBaseUrl:
          integrationForm.apiBaseUrl.trim() ||
          null,

        webhookUrl:
          integrationForm.webhookUrl.trim() ||
          null,
      };

      /*
       * Only send credentials when the
       * user actually entered new values.
       *
       * Existing credentials remain untouched.
       */
      if (
        integrationForm.apiKey.trim()
      ) {
        payload.apiKey =
          integrationForm.apiKey.trim();
      }

      if (
        integrationForm.apiSecret.trim()
      ) {
        payload.apiSecret =
          integrationForm.apiSecret.trim();
      }

      const data =
        await apiFetch(
          `/api/bank-accounts/${integrationAccount.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(
              payload
            ),
          }
        );

      const updated =
        data?.bankAccount;

      if (!updated?.id) {
        throw new Error(
          "The server returned an invalid bank account."
        );
      }

      setAccounts(
        (current) =>
          current.map(
            (account) =>
              account.id ===
              updated.id
                ? updated
                : account
          )
      );

      setSuccess(
        "Bank integration configuration saved successfully."
      );

      closeIntegration();
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          "Failed to save integration configuration."
        )
      );
    } finally {
      setIntegrationSaving(
        false
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#666B84]">
            Cash & Banking
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">
            Bank Integration
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage organizational bank accounts
            and secure bank integration
            configuration.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            onClick={() =>
              void loadAccounts()
            }
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
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
            className="flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0]"
          >
            <Plus size={18} />

            Add Bank Account
          </button>

        </div>
      </div>

      {/* ALERTS */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">
            {success}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <SummaryCard
          title="Bank Accounts"
          value={String(
            summary.total
          )}
          sub={`${summary.active} active`}
          icon={
            <Building2 size={20} />
          }
        />

        <SummaryCard
          title="Connected"
          value={String(
            summary.connected
          )}
          sub="Verified connection status"
          icon={
            <Link2 size={20} />
          }
        />

        <SummaryCard
          title="Integration Enabled"
          value={String(
            summary.enabled
          )}
          sub="Accounts configured for integration"
          icon={
            <ShieldCheck size={20} />
          }
        />

        <SummaryCard
          title="KES Balance"
          value={formatMoney(
            summary.kesBalance,
            "KES"
          )}
          sub={`${summary.currencies} currency type(s)`}
          icon={
            <Building2 size={20} />
          }
        />

      </div>

      {/* SEARCH */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-sm">

        <div className="flex items-center rounded-xl border border-[#ECECF3] px-4 focus-within:border-[#6D5DF6]">

          <Search
            size={18}
            className="shrink-0 text-[#666B84]"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search bank accounts..."
            className="w-full bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-400"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              className="text-[#666B84] hover:text-[#20243A]"
            >
              <X size={17} />
            </button>
          )}

        </div>

      </div>

      {/* ACCOUNTS */}

      {loading ? (

        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white">
          <div className="text-center">

            <Loader2
              size={28}
              className="mx-auto animate-spin text-[#6D5DF6]"
            />

            <p className="mt-3 text-sm text-[#666B84]">
              Loading bank accounts...
            </p>

          </div>
        </div>

      ) : filteredAccounts.length === 0 ? (

        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#ECECF3] bg-white px-6 text-center">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC]">
            <Building2
              size={26}
              className="text-[#20243A]"
            />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
            {accounts.length === 0
              ? "No bank accounts added"
              : "No matching accounts"}
          </h2>

          <p className="mt-2 max-w-sm text-sm text-[#666B84]">
            {accounts.length === 0
              ? "Add a bank account to begin managing your organization's banking configuration."
              : "Try a different search term."}
          </p>

          {accounts.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0]"
            >
              <Plus size={18} />

              Add First Account
            </button>
          )}

        </div>

      ) : (

        <div className="grid gap-5 xl:grid-cols-2">

          {filteredAccounts.map(
            (account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm transition hover:border-[#6D5DF6]/30"
              >

                {/* ACCOUNT HEADER */}

                <div className="flex items-start justify-between gap-4">

                  <div className="flex min-w-0 items-center gap-4">

                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC]">
                      <Building2
                        size={26}
                        className="text-[#6D5DF6]"
                      />
                    </div>

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="truncate text-base font-semibold text-[#20243A]">
                          {account.accountName}
                        </h2>

                        <StatusBadge
                          status={
                            account.status
                          }
                        />

                      </div>

                      <p className="mt-0.5 text-sm font-medium text-[#6D5DF6]">
                        {account.bankName}
                      </p>

                      <p className="font-mono text-sm text-[#666B84]">
                        {account.accountNumber}
                      </p>

                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openEdit(account)
                    }
                    className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
                    title="Edit account"
                  >
                    <Edit3 size={17} />
                  </button>

                </div>

                {/* BALANCE */}

                <div className="mt-5 rounded-xl bg-[#F8F9FC] p-4">

                  <p className="text-xs font-medium text-[#666B84]">
                    Current Balance
                  </p>

                  <p className="mt-1.5 text-2xl font-bold text-[#20243A]">
                    {formatMoney(
                      Number(
                        account.currentBalance
                      ),
                      account.currency
                    )}
                  </p>

                  <p className="mt-1 text-xs text-[#666B84]">
                    Opening balance:{" "}
                    {formatMoney(
                      Number(
                        account.openingBalance
                      ),
                      account.currency
                    )}
                  </p>

                </div>

                {/* INTEGRATION */}

                <div className="mt-4 rounded-xl border border-[#ECECF3] p-4">

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <div className="flex items-center gap-2">

                        <Link2
                          size={16}
                          className="text-[#6D5DF6]"
                        />

                        <p className="text-sm font-semibold text-[#20243A]">
                          Bank API Integration
                        </p>

                      </div>

                      <p className="mt-1 text-xs text-[#666B84]">
                        {account.integrationEnabled
                          ? account.integrationProvider ||
                            "Provider configured"
                          : "Not enabled"}
                      </p>

                    </div>

                    <StatusBadge
                      status={
                        account.connectionStatus ||
                        "DISCONNECTED"
                      }
                    />

                  </div>

                  {account.integrationEnabled && (
                    <div className="mt-3 grid gap-2 text-xs text-[#666B84]">

                      {account.apiBaseUrl && (
                        <div>
                          <span className="font-medium">
                            API:
                          </span>{" "}
                          {account.apiBaseUrl}
                        </div>
                      )}

                      {account.webhookUrl && (
                        <div>
                          <span className="font-medium">
                            Webhook:
                          </span>{" "}
                          {account.webhookUrl}
                        </div>
                      )}

                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      openIntegration(
                        account
                      )
                    }
                    className="mt-4 flex items-center gap-2 rounded-xl bg-[#F8F9FC] px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#ECECF3]"
                  >
                    <Link2 size={16} />

                    {account.integrationEnabled
                      ? "Configure Integration"
                      : "Configure Bank API"}
                  </button>

                </div>

                {/* FOOTER */}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#ECECF3] pt-4 text-xs text-[#666B84]">

                  <span>
                    {account.branchName
                      ? `Branch: ${account.branchName}`
                      : "Branch not specified"}
                  </span>

                  <span>
                    Added{" "}
                    {formatDate(
                      account.createdAt
                    )}
                  </span>

                </div>

              </div>
            )
          )}

        </div>

      )}

      {/* =====================================================
          BANK ACCOUNT MODAL
      ===================================================== */}

      {showBankForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >

          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-[#ECECF3] px-6 py-5">

              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  {editing
                    ? "Edit Bank Account"
                    : "Add Bank Account"}
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  {editing
                    ? "Update the bank account record."
                    : "Register a new organizational bank account."}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeBankForm
                }
                disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
              >
                <X size={22} />
              </button>

            </div>

            <form
              onSubmit={
                handleBankSubmit
              }
              className="p-6"
            >

              <div className="grid gap-5 md:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Bank Name{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      bankForm.bankName
                    }
                    onChange={(event) =>
                      setBankForm(
                        (current) => ({
                          ...current,
                          bankName:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                  >
                    <option value="">
                      Select bank...
                    </option>

                    {KENYAN_BANKS.map(
                      (bank) => (
                        <option
                          key={bank}
                          value={bank}
                        >
                          {bank}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Currency
                  </label>

                  <select
                    value={
                      bankForm.currency
                    }
                    onChange={(event) =>
                      setBankForm(
                        (current) => ({
                          ...current,
                          currency:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                  >
                    {CURRENCIES.map(
                      (currency) => (
                        <option
                          key={currency}
                          value={
                            currency
                          }
                        >
                          {currency}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Account Name{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    value={
                      bankForm.accountName
                    }
                    onChange={(event) =>
                      setBankForm(
                        (current) => ({
                          ...current,
                          accountName:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    placeholder="e.g. Operations Account"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Account Number{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    value={
                      bankForm.accountNumber
                    }
                    onChange={(event) =>
                      setBankForm(
                        (current) => ({
                          ...current,
                          accountNumber:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    placeholder="Bank account number"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 font-mono text-sm outline-none focus:border-[#6D5DF6]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Branch
                  </label>

                  <input
                    value={
                      bankForm.branchName
                    }
                    onChange={(event) =>
                      setBankForm(
                        (current) => ({
                          ...current,
                          branchName:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    placeholder="e.g. Westlands"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                    Opening Balance
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      bankForm.openingBalance
                    }
                    onChange={(event) =>
                      setBankForm(
                        (current) => ({
                          ...current,
                          openingBalance:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={
                      saving ||
                      Boolean(
                        editing
                      )
                    }
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                  />

                  {editing && (
                    <p className="mt-1 text-xs text-[#666B84]">
                      Opening balance cannot be changed after creation.
                    </p>
                  )}
                </div>

              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#ECECF3] pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    closeBankForm
                  }
                  disabled={saving}
                  className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2
                      size={17}
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : editing
                    ? "Save Changes"
                    : "Add Account"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* =====================================================
          INTEGRATION MODAL
      ===================================================== */}

      {showIntegrationForm &&
        integrationAccount && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >

            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">

              <div className="flex items-start justify-between border-b border-[#ECECF3] px-6 py-5">

                <div>
                  <h2 className="text-xl font-bold text-[#20243A]">
                    Bank API Integration
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    {integrationAccount.bankName} ·{" "}
                    {integrationAccount.accountName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeIntegration
                  }
                  disabled={
                    integrationSaving
                  }
                  className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
                >
                  <X size={22} />
                </button>

              </div>

              <form
                onSubmit={
                  handleIntegrationSubmit
                }
                className="p-6"
              >

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">

                  <div className="flex gap-3">

                    <ShieldCheck
                      size={20}
                      className="mt-0.5 shrink-0 text-amber-700"
                    />

                    <div>

                      <p className="text-sm font-semibold text-amber-800">
                        Credentials are protected
                      </p>

                      <p className="mt-1 text-xs leading-5 text-amber-700">
                        API credentials are never displayed back to the browser. Leave the credential fields blank to keep the existing credentials unchanged.
                      </p>

                    </div>

                  </div>

                </div>

                <div className="mt-6 space-y-5">

                  <label className="flex items-center justify-between rounded-xl border border-[#ECECF3] p-4">

                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">
                        Enable integration
                      </p>

                      <p className="mt-1 text-xs text-[#666B84]">
                        Enables this account for API integration configuration.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={
                        integrationForm.integrationEnabled
                      }
                      onChange={(event) =>
                        setIntegrationForm(
                          (current) => ({
                            ...current,
                            integrationEnabled:
                              event.target
                                .checked,
                          })
                        )
                      }
                      disabled={
                        integrationSaving
                      }
                      className="h-5 w-5 rounded border-gray-300 text-[#6D5DF6] focus:ring-[#6D5DF6]"
                    />

                  </label>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                      Integration Provider
                    </label>

                    <input
                      value={
                        integrationForm.integrationProvider
                      }
                      onChange={(event) =>
                        setIntegrationForm(
                          (current) => ({
                            ...current,
                            integrationProvider:
                              event.target
                                .value,
                          })
                        )
                      }
                      disabled={
                        integrationSaving
                      }
                      placeholder="e.g. KCB, EQUITY, NCBA"
                      className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                      API Base URL
                    </label>

                    <input
                      type="url"
                      value={
                        integrationForm.apiBaseUrl
                      }
                      onChange={(event) =>
                        setIntegrationForm(
                          (current) => ({
                            ...current,
                            apiBaseUrl:
                              event.target
                                .value,
                          })
                        )
                      }
                      disabled={
                        integrationSaving
                      }
                      placeholder="https://api.example-bank.com"
                      className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                      API Key
                    </label>

                    <input
                      type="password"
                      autoComplete="new-password"
                      value={
                        integrationForm.apiKey
                      }
                      onChange={(event) =>
                        setIntegrationForm(
                          (current) => ({
                            ...current,
                            apiKey:
                              event.target
                                .value,
                          })
                        )
                      }
                      disabled={
                        integrationSaving
                      }
                      placeholder="Enter new key only if changing it"
                      className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                      API Secret
                    </label>

                    <input
                      type="password"
                      autoComplete="new-password"
                      value={
                        integrationForm.apiSecret
                      }
                      onChange={(event) =>
                        setIntegrationForm(
                          (current) => ({
                            ...current,
                            apiSecret:
                              event.target
                                .value,
                          })
                        )
                      }
                      disabled={
                        integrationSaving
                      }
                      placeholder="Enter new secret only if changing it"
                      className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
                      Webhook URL
                    </label>

                    <input
                      type="url"
                      value={
                        integrationForm.webhookUrl
                      }
                      onChange={(event) =>
                        setIntegrationForm(
                          (current) => ({
                            ...current,
                            webhookUrl:
                              event.target
                                .value,
                          })
                        )
                      }
                      disabled={
                        integrationSaving
                      }
                      placeholder="https://your-domain.com/api/bank/webhook"
                      className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </div>

                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#ECECF3] pt-5 sm:flex-row sm:justify-end">

                  <button
                    type="button"
                    onClick={
                      closeIntegration
                    }
                    disabled={
                      integrationSaving
                    }
                    className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      integrationSaving
                    }
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0] disabled:opacity-60"
                  >
                    {integrationSaving ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2
                        size={17}
                      />
                    )}

                    {integrationSaving
                      ? "Saving..."
                      : "Save Integration"}
                  </button>

                </div>

              </form>

            </div>
          </div>
        )}
    </div>
  );
}