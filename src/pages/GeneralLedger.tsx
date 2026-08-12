import { useEffect, useMemo, useState } from "react";
import { Search, Download, RefreshCw } from "lucide-react";
import { API_URL } from "../lib/api";
import { authenticatedFetch } from "../lib/auth";

type LedgerEntry = {
  id: string;
  journalId?: string;
  date: string;
  reference: string;
  description: string;
  accountId: string;
  accountCode: string;
  account: string;
  debit: number;
  credit: number;
  balance: number;
};

export default function GeneralLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadLedger = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authenticatedFetch(
        `${API_URL}/api/ledger`,
        {
          method: "GET",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load General Ledger"
        );
      }

      setEntries(data.entries || []);
    } catch (error) {
      console.error("LEDGER ERROR:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load General Ledger"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        entry.account?.toLowerCase().includes(query) ||
        entry.accountCode?.toLowerCase().includes(query) ||
        entry.reference?.toLowerCase().includes(query) ||
        entry.description?.toLowerCase().includes(query);

      const entryDate = new Date(entry.date);

      const matchesStartDate =
        !startDate ||
        entryDate >= new Date(`${startDate}T00:00:00`);

      const matchesEndDate =
        !endDate ||
        entryDate <= new Date(`${endDate}T23:59:59`);

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [entries, search, startDate, endDate]);

  const totalDebit = filteredEntries.reduce(
    (total, entry) => total + Number(entry.debit || 0),
    0
  );

  const totalCredit = filteredEntries.reduce(
    (total, entry) => total + Number(entry.credit || 0),
    0
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-KE");
  };

  const exportLedger = () => {
    if (filteredEntries.length === 0) {
      alert("There are no ledger entries to export.");
      return;
    }

    const headers = [
      "Date",
      "Reference",
      "Account Code",
      "Account",
      "Description",
      "Debit",
      "Credit",
    ];

    const rows = filteredEntries.map((entry) => [
      formatDate(entry.date),
      entry.reference,
      entry.accountCode,
      entry.account,
      entry.description,
      entry.debit,
      entry.credit,
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `ziya-general-ledger-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">

      {/* Header */}

      <div className="flex justify-between items-center">

        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            General Ledger
          </h1>

          <p className="text-[#666B84] mt-2">
            View all posted financial transactions across the organization.
          </p>
        </div>

        <div className="flex gap-3">

          <button
            onClick={loadLedger}
            disabled={loading}
            className="flex items-center gap-2 bg-[#F8F9FC] hover:bg-[#ECECF3] px-4 py-2 rounded-lg text-[#20243A] disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
            />

            Refresh
          </button>

          <button
            onClick={exportLedger}
            className="flex items-center gap-2 bg-[#20243A] hover:bg-[#5a4de0] px-4 py-2 rounded-lg text-white"
          >
            <Download size={18} />
            Export
          </button>

        </div>

      </div>

      {/* Summary */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-5">
          <p className="text-[#666B84]">
            Ledger Lines
          </p>

          <h2 className="text-2xl font-bold text-[#20243A] mt-2">
            {filteredEntries.length}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-5">
          <p className="text-[#666B84]">
            Total Debits
          </p>

          <h2 className="text-2xl font-bold text-green-400 mt-2">
            {formatCurrency(totalDebit)}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-5">
          <p className="text-[#666B84]">
            Total Credits
          </p>

          <h2 className="text-2xl font-bold text-red-400 mt-2">
            {formatCurrency(totalCredit)}
          </h2>
        </div>

      </div>

      {/* Filters */}

      <div className="bg-white border border-[#ECECF3] rounded-2xl p-4 flex flex-col lg:flex-row gap-4">

        <div className="flex items-center bg-white rounded-lg px-3 flex-1">

          <Search
            size={18}
            className="text-[#666B84]"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account, code, reference or description..."
            className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
          />

        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-white border border-[#ECECF3] rounded-lg px-4 py-3 text-[#20243A]"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-white border border-[#ECECF3] rounded-lg px-4 py-3 text-[#20243A]"
        />

      </div>

      {/* Error */}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4">
          {error}
        </div>
      )}

      {/* Ledger Table */}

      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-x-auto">

        <table className="w-full">

          <thead className="bg-white text-[#666B84]">

            <tr>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Reference</th>
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Account</th>
              <th className="text-left p-4">Description</th>
              <th className="text-right p-4">Debit</th>
              <th className="text-right p-4">Credit</th>
            </tr>

          </thead>

          <tbody>

            {loading ? (

              <tr>
                <td
                  colSpan={7}
                  className="p-10 text-center text-[#666B84]"
                >
                  Loading General Ledger...
                </td>
              </tr>

            ) : filteredEntries.length === 0 ? (

              <tr>
                <td
                  colSpan={7}
                  className="p-10 text-center text-[#666B84]"
                >
                  No ledger transactions found.
                </td>
              </tr>

            ) : (

              filteredEntries.map((entry) => (

                <tr
                  key={entry.id}
                  className="border-t border-[#ECECF3] hover:bg-white/70"
                >

                  <td className="p-4 text-[#666B84]">
                    {formatDate(entry.date)}
                  </td>

                  <td className="p-4 text-[#20243A]">
                    {entry.reference}
                  </td>

                  <td className="p-4 text-[#666B84]">
                    {entry.accountCode}
                  </td>

                  <td className="p-4 text-[#20243A]">
                    {entry.account}
                  </td>

                  <td className="p-4 text-[#666B84]">
                    {entry.description}
                  </td>

                  <td className="p-4 text-right text-green-400">
                    {entry.debit > 0
                      ? formatCurrency(entry.debit)
                      : "-"}
                  </td>

                  <td className="p-4 text-right text-red-400">
                    {entry.credit > 0
                      ? formatCurrency(entry.credit)
                      : "-"}
                  </td>

                </tr>

              ))

            )}

          </tbody>

          {!loading && filteredEntries.length > 0 && (

            <tfoot className="border-t-2 border-[#ECECF3] bg-white">

              <tr>

                <td
                  colSpan={5}
                  className="p-4 text-right font-semibold text-[#20243A]"
                >
                  TOTAL
                </td>

                <td className="p-4 text-right font-bold text-green-400">
                  {formatCurrency(totalDebit)}
                </td>

                <td className="p-4 text-right font-bold text-red-400">
                  {formatCurrency(totalCredit)}
                </td>

              </tr>

            </tfoot>

          )}

        </table>

      </div>

    </div>
  );
}

