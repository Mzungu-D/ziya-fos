import { Search, Download } from "lucide-react";

const entries = [
  {
    date: "2026-07-01",
    account: "Customer Loan Disbursement",
    reference: "GL-0001",
    debit: "KES 500,000",
    credit: "-",
    balance: "KES 500,000",
  },
  {
    date: "2026-07-02",
    account: "Loan Repayment",
    reference: "GL-0002",
    debit: "-",
    credit: "KES 120,000",
    balance: "KES 380,000",
  },
  {
    date: "2026-07-03",
    account: "Office Expenses",
    reference: "GL-0003",
    debit: "KES 25,000",
    credit: "-",
    balance: "KES 405,000",
  },
  {
    date: "2026-07-04",
    account: "Payroll",
    reference: "GL-0004",
    debit: "KES 180,000",
    credit: "-",
    balance: "KES 585,000",
  },
];

export default function GeneralLedger() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            General Ledger
          </h1>

          <p className="text-slate-400 mt-2">
            View all financial transactions across the organization.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Download size={18} />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex gap-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3 flex-1">
          <Search size={18} className="text-slate-500" />

          <input
            type="text"
            placeholder="Search account, reference..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>

        <input
          type="date"
          className="bg-slate-900 border border-slate-700 rounded-lg px-4 text-white"
        />

        <input
          type="date"
          className="bg-slate-900 border border-slate-700 rounded-lg px-4 text-white"
        />
      </div>

      {/* Ledger Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Reference</th>
              <th className="text-left p-4">Account</th>
              <th className="text-right p-4">Debit</th>
              <th className="text-right p-4">Credit</th>
              <th className="text-right p-4">Balance</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.reference}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-slate-300">{entry.date}</td>
                <td className="p-4 text-blue-400">{entry.reference}</td>
                <td className="p-4 text-white">{entry.account}</td>
                <td className="p-4 text-right text-green-400">
                  {entry.debit}
                </td>
                <td className="p-4 text-right text-red-400">
                  {entry.credit}
                </td>
                <td className="p-4 text-right text-white font-semibold">
                  {entry.balance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}