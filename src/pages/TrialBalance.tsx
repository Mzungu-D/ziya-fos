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
          <h1 className="text-3xl font-bold text-[#20243A]">
            Trial Balance
          </h1>

          <p className="mt-2 text-[#666B84]">
            Verify that total posted debits equal total posted credits.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadTrialBalance(true)}
          className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2 text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={18}
            className={refreshing ? "animate-spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* SEARCH */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex items-center rounded-xl border border-[#ECECF3] bg-white px-4">
          <Search
            size={18}
            className="text-[#666B84]"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by account code, name or type..."
            className="w-full bg-transparent px-3 py-3 text-[#20243A] outline-none placeholder:text-[#666B84]"
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

          <p className="mt-2 text-sm text-[#666B84]">
            {error}
          </p>
        </div>
      )}

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white">
              <tr className="text-[#666B84]">
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
                    className="p-12 text-center text-[#666B84]"
                  >
                    Loading Trial Balance...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-12 text-center text-[#666B84]"
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
                      className="border-t border-[#ECECF3] transition hover:bg-white/70"
                    >
                      <td className="p-4 font-medium text-[#6D5DF6]">
                        {account.code}
                      </td>

                      <td className="p-4 font-medium text-[#20243A]">
                        {account.name}
                      </td>

                      <td className="p-4 text-[#666B84]">
                        {account.type}
                      </td>

                      <td className="p-4 text-right text-[#20243A]">
                        {account.debit > 0
                          ? formatCurrency(account.debit)
                          : "—"}
                      </td>

                      <td className="p-4 text-right text-[#20243A]">
                        {account.credit > 0
                          ? formatCurrency(account.credit)
                          : "—"}
                      </td>
                    </tr>
                  )
                )
              )}

              {!loading && !error && (
                <tr className="border-t-2 border-[#ECECF3] bg-white/70 font-bold">
                  <td
                    colSpan={3}
                    className="p-4 text-[#20243A]"
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

            <p className="mt-2 text-sm text-[#666B84]">
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

            <p className="mt-2 text-[#666B84]">
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
