import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authenticatedFetch } from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

type BankAccount = {
  id: string;
  organizationId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName?: string | null;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  integrationEnabled: boolean;
  integrationProvider?: string | null;
  connectionStatus: string;
  lastSyncAt?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type BankAccountsResponse = {
  success?: boolean;
  bankAccounts?: BankAccount[];
  message?: string;
};

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(
  amount: number,
  currency: string
): string {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currency || "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "KES"} ${amount.toLocaleString(
      "en-KE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }
}

function formatDate(
  value?: string | null
): string {
  if (!value) {
    return "Not synchronized";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not synchronized";
  }

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function maskAccountNumber(
  accountNumber: string
): string {
  const value = accountNumber.trim();

  if (value.length <= 4) {
    return value;
  }

  return `•••• ${value.slice(-4)}`;
}

function getConnectionLabel(
  account: BankAccount
): string {
  if (
    account.connectionStatus.toUpperCase() ===
      "CONNECTED" &&
    account.integrationEnabled
  ) {
    return "Connected";
  }

  if (
    account.connectionStatus.toUpperCase() ===
    "CONNECTING"
  ) {
    return "Connecting";
  }

  return "Not connected";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function BankAccounts() {
  const [accounts, setAccounts] =
    useState<BankAccount[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [showBalances, setShowBalances] =
    useState(true);
  const [expandedAccountId, setExpandedAccountId] =
    useState<string | null>(null);

  /* ---------------------------------------------------------
     LOAD ORGANIZATION BANK ACCOUNTS
  --------------------------------------------------------- */

  const loadAccounts = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const response =
          await authenticatedFetch(
            "/api/bank-accounts"
          );

        const payload =
          (await response.json()) as BankAccountsResponse;

        if (!response.ok) {
          throw new Error(
            payload.message ||
              "Failed to load bank accounts."
          );
        }

        setAccounts(
          Array.isArray(payload.bankAccounts)
            ? payload.bankAccounts
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load bank accounts."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  /* ---------------------------------------------------------
     SUMMARY
  --------------------------------------------------------- */

  const summary = useMemo(() => {
    const activeAccounts =
      accounts.filter(
        (account) =>
          account.status.toUpperCase() ===
          "ACTIVE"
      );

    const totalCashByCurrency =
      activeAccounts.reduce<
        Record<string, number>
      >((totals, account) => {
        const currency =
          account.currency || "KES";

        totals[currency] =
          (totals[currency] ?? 0) +
          toNumber(account.currentBalance);

        return totals;
      }, {});

    const netMovementByCurrency =
      activeAccounts.reduce<
        Record<string, number>
      >((totals, account) => {
        const currency =
          account.currency || "KES";

        const movement =
          toNumber(account.currentBalance) -
          toNumber(account.openingBalance);

        totals[currency] =
          (totals[currency] ?? 0) +
          movement;

        return totals;
      }, {});

    return {
      activeCount:
        activeAccounts.length,
      currencies:
        Object.keys(totalCashByCurrency),
      totalCashByCurrency,
      netMovementByCurrency,
    };
  }, [accounts]);

  const primaryCurrency =
    summary.currencies.length === 1
      ? summary.currencies[0]
      : "KES";

  const totalCash =
    summary.totalCashByCurrency[
      primaryCurrency
    ] ?? 0;

  const netMovement =
    summary.netMovementByCurrency[
      primaryCurrency
    ] ?? 0;

  /* ---------------------------------------------------------
     RENDER
  --------------------------------------------------------- */

  return (
    <div className="min-h-full bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Cash &amp; Banking
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              Cash &amp; Bank Accounts
            </h1>

            <p className="mt-2 text-base text-slate-500">
              View the organization&apos;s bank
              balances and cash position.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void loadAccounts(true)
              }
              disabled={
                loading || refreshing
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                setShowBalances(
                  (current) => !current
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {showBalances ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showBalances
                ? "Hide balances"
                : "Show balances"}
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">
                Unable to load bank accounts
              </p>
              <p className="mt-1 text-sm">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Cash Balance"
            value={
              loading
                ? "—"
                : showBalances
                  ? formatMoney(
                      totalCash,
                      primaryCurrency
                    )
                  : "••••••"
            }
            detail={
              summary.currencies.length > 1
                ? "Multiple currencies"
                : `${summary.activeCount} active account${
                    summary.activeCount ===
                    1
                      ? ""
                      : "s"
                  }`
            }
            icon={
              <Wallet className="h-5 w-5" />
            }
          />

          <SummaryCard
            label="Net Movement"
            value={
              loading
                ? "—"
                : showBalances
                  ? formatMoney(
                      netMovement,
                      primaryCurrency
                    )
                  : "••••••"
            }
            detail="Current balance less opening balance"
            icon={
              <RefreshCw className="h-5 w-5" />
            }
          />

          <SummaryCard
            label="Active Accounts"
            value={
              loading
                ? "—"
                : String(summary.activeCount)
            }
            detail={`${accounts.length} total registered`}
            icon={
              <Building2 className="h-5 w-5" />
            }
          />

          <SummaryCard
            label="Currencies"
            value={
              loading
                ? "—"
                : String(
                    summary.currencies.length
                  )
            }
            detail="Currency types held"
            icon={
              <Wallet className="h-5 w-5" />
            }
          />
        </div>

        {/* SECURITY NOTICE */}
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

          <div>
            <p className="font-semibold text-slate-800">
              Bank balances are read-only
            </p>
            <p className="mt-1 text-sm text-slate-500">
              This workspace only displays bank
              account information available to
              the organization. It does not create
              or send bank payments.
            </p>
          </div>
        </div>

        {/* ACCOUNT LIST */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Organizational Bank Accounts
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Current balances and synchronization
              status for this organization&apos;s
              registered bank accounts.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading bank accounts...
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-slate-100">
              {accounts.map((account) => {
                const expanded =
                  expandedAccountId ===
                  account.id;

                const movement =
                  toNumber(
                    account.currentBalance
                  ) -
                  toNumber(
                    account.openingBalance
                  );

                const connected =
                  account.connectionStatus.toUpperCase() ===
                    "CONNECTED" &&
                  account.integrationEnabled;

                return (
                  <div
                    key={account.id}
                    className="px-6 py-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
                          <Building2 className="h-6 w-6" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-slate-900">
                              {account.bankName}
                            </h3>

                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                connected
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {connected ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                              {getConnectionLabel(
                                account
                              )}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {account.accountName}
                            {" · "}
                            {maskAccountNumber(
                              account.accountNumber
                            )}
                          </p>

                          {account.branchName && (
                            <p className="mt-1 text-xs text-slate-400">
                              {account.branchName}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-8">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Current balance
                          </p>
                          <p className="mt-1 text-xl font-semibold text-slate-900">
                            {showBalances
                              ? formatMoney(
                                  toNumber(
                                    account.currentBalance
                                  ),
                                  account.currency
                                )
                              : "••••••"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAccountId(
                              expanded
                                ? null
                                : account.id
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Details
                          <ChevronDown
                            className={`h-4 w-4 transition ${
                              expanded
                                ? "rotate-180"
                                : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail
                          label="Opening balance"
                          value={
                            showBalances
                              ? formatMoney(
                                  toNumber(
                                    account.openingBalance
                                  ),
                                  account.currency
                                )
                              : "••••••"
                          }
                        />

                        <Detail
                          label="Net movement"
                          value={
                            showBalances
                              ? formatMoney(
                                  movement,
                                  account.currency
                                )
                              : "••••••"
                          }
                        />

                        <Detail
                          label="Last synchronized"
                          value={formatDate(
                            account.lastSyncAt
                          )}
                        />

                        <Detail
                          label="Provider"
                          value={
                            account.integrationProvider ||
                            "Not configured"
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* MULTI-CURRENCY NOTE */}
        {summary.currencies.length > 1 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold">
              Multiple currencies detected
            </p>
            <p className="mt-1">
              Balances are displayed in their
              original account currencies. The total
              cash card does not combine different
              currencies into one number.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   SUBCOMPONENTS
========================================================= */

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {detail}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
        <Wallet className="h-8 w-8" />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-slate-900">
        No bank accounts added
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        This organization has no active bank
        accounts registered in Ziya FOS yet.
      </p>
    </div>
  );
}