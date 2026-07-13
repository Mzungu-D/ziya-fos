import { Plus, Search } from "lucide-react";

const entries = [
  {
    id: "JE-0001",
    date: "2026-07-09",
    description: "Loan Disbursement",
    debit: "Loans Receivable",
    credit: "Cash and Bank",
    amount: "KES 500,000",
  },
  {
    id: "JE-0002",
    date: "2026-07-09",
    description: "Loan Repayment",
    debit: "Cash and Bank",
    credit: "Loans Receivable",
    amount: "KES 120,000",
  },
  {
    id: "JE-0003",
    date: "2026-07-09",
    description: "Office Rent Payment",
    debit: "Rent Expense",
    credit: "Cash and Bank",
    amount: "KES 80,000",
  },
];

export default function JournalEntries() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Journal Entries
          </h1>

          <p className="text-slate-400 mt-2">
            Record and manage accounting transactions.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          New Entry
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />

          <input
            type="text"
            placeholder="Search journal entries..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Entry ID</th>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Description</th>
              <th className="text-left p-4">Debit Account</th>
              <th className="text-left p-4">Credit Account</th>
              <th className="text-right p-4">Amount</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-blue-400">{entry.id}</td>
                <td className="p-4 text-slate-300">{entry.date}</td>
                <td className="p-4 text-white">{entry.description}</td>
                <td className="p-4 text-green-400">{entry.debit}</td>
                <td className="p-4 text-red-400">{entry.credit}</td>
                <td className="p-4 text-right text-white font-semibold">
                  {entry.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}