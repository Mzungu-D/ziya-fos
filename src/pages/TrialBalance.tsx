import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

interface TrialBalanceAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface TrialBalanceResponse {
  success: boolean;

  trialBalance: TrialBalanceAccount[];

  totals: {
    debit: number;
    credit: number;
    difference: number;
    balanced: boolean;
  };

  meta?: {
    postedEntries?: number;
    generatedAt?: string;
  };

  message?: string;
}

export default function TrialBalance() {
  const [accounts, setAccounts] = useState<TrialBalanceAccount[]>([]);
  const [search, setSearch] = useState("");

  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [difference, setDifference] = useState(0);
  const [balanced, setBalanced] = useState(true);
  const [postedEntries, setPostedEntries] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const loadTrialBalance = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await authenticatedFetch("/api/trial-balance", {
          method: "GET",

          headers: {
            Accept: "application/json",

          },
        });

        const data =
          (await response.json()) as TrialBalanceResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load Trial Balance"
          );
        }

        setAccounts(data.trialBalance ?? []);

        setTotalDebit(data.totals?.debit ?? 0);
        setTotalCredit(data.totals?.credit ?? 0);
        setDifference(data.totals?.difference ?? 0);
        setBalanced(data.totals?.balanced ?? false);

        setPostedEntries(data.meta?.postedEntries ?? 0);
      } catch (error: unknown) {
        console.error("TRIAL BALANCE ERROR:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Unable to load Trial Balance");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadTrialBalance();
  }, [loadTrialBalance]);

  const searchTerm = search.trim().toLowerCase();

  const filteredAccounts = accounts.filter(
    (account: TrialBalanceAccount) => {
      if (!searchTerm) {
        return true;
      }

      return (
        account.code.toLowerCase().includes(searchTerm) ||
        account.name.toLowerCase().includes(searchTerm) ||
        account.type.toLowerCase().includes(searchTerm)
      );
    }
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Trial Balance
          </h1>

          <p className="mt-2 text-slate-400">
            Verify that total posted debits equal total posted credits.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadTrialBalance(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={18}
            className={refreshing ? "animate-spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* SEARCH */}

      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">
          <Search
            size={18}
            className="text-slate-500"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by account code, name or type..."
            className="w-full bg-transparent px-3 py-3 text-white outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={20}
              className="text-red-400"
            />

            <p className="font-semibold text-red-400">
              Unable to load Trial Balance
            </p>
          </div>

          <p className="mt-2 text-sm text-slate-300">
            {error}
          </p>
        </div>
      )}

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900">
              <tr className="text-slate-400">
                <th className="p-4 text-left">
                  Code
                </th>

                <th className="p-4 text-left">
                  Account
                </th>

                <th className="p-4 text-left">
                  Type
                </th>

                <th className="p-4 text-right">
                  Debit
                </th>

                <th className="p-4 text-right">
                  Credit
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-12 text-center text-slate-400"
                  >
                    Loading Trial Balance...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-12 text-center text-slate-400"
                  >
                    {searchTerm
                      ? "No matching accounts found."
                      : "No posted journal balances available."}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(
                  (account: TrialBalanceAccount) => (
                    <tr
                      key={account.id}
                      className="border-t border-slate-800 transition hover:bg-slate-900/70"
                    >
                      <td className="p-4 font-medium text-blue-400">
                        {account.code}
                      </td>

                      <td className="p-4 font-medium text-white">
                        {account.name}
                      </td>

                      <td className="p-4 text-slate-400">
                        {account.type}
                      </td>

                      <td className="p-4 text-right text-slate-200">
                        {account.debit > 0
                          ? formatCurrency(account.debit)
                          : "—"}
                      </td>

                      <td className="p-4 text-right text-slate-200">
                        {account.credit > 0
                          ? formatCurrency(account.credit)
                          : "—"}
                      </td>
                    </tr>
                  )
                )
              )}

              {!loading && !error && (
                <tr className="border-t-2 border-slate-700 bg-slate-900/70 font-bold">
                  <td
                    colSpan={3}
                    className="p-4 text-white"
                  >
                    TOTAL
                  </td>

                  <td className="p-4 text-right text-green-400">
                    {formatCurrency(totalDebit)}
                  </td>

                  <td className="p-4 text-right text-green-400">
                    {formatCurrency(totalCredit)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BALANCE STATUS */}

      {!loading &&
        !error &&
        (balanced ? (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2
                size={20}
                className="text-green-400"
              />

              <p className="font-semibold text-green-400">
                Trial Balance is Balanced
              </p>
            </div>

            <p className="mt-2 text-sm text-slate-300">
              Total debits equal total credits.
              {postedEntries > 0 &&
                ` Calculated from ${postedEntries} posted journal ${
                  postedEntries === 1
                    ? "entry"
                    : "entries"
                }.`}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={20}
                className="text-red-400"
              />

              <p className="font-semibold text-red-400">
                Trial Balance Out of Balance
              </p>
            </div>

            <p className="mt-2 text-slate-300">
              Difference:{" "}
              <span className="font-semibold text-red-400">
                {formatCurrency(difference)}
              </span>
            </p>
          </div>
        ))}
    </div>
  );
}
