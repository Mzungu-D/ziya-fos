import { Plus, Search } from "lucide-react";

const accounts = [
  {
    code: "1000",
    name: "Cash and Bank",
    type: "Asset",
    status: "Active",
  },
  {
    code: "1100",
    name: "Accounts Receivable",
    type: "Asset",
    status: "Active",
  },
  {
    code: "2000",
    name: "Accounts Payable",
    type: "Liability",
    status: "Active",
  },
  {
    code: "3000",
    name: "Share Capital",
    type: "Equity",
    status: "Active",
  },
  {
    code: "4000",
    name: "Revenue",
    type: "Income",
    status: "Active",
  },
  {
    code: "5000",
    name: "Operating Expenses",
    type: "Expense",
    status: "Active",
  },
];

export default function ChartOfAccounts() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Chart of Accounts
          </h1>

          <p className="text-slate-400 mt-2">
            Manage your organization's financial accounts.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          New Account
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />

          <input
            type="text"
            placeholder="Search account..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Account Name</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.code}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-blue-400">{account.code}</td>
                <td className="p-4 text-white">{account.name}</td>
                <td className="p-4 text-slate-300">{account.type}</td>
                <td className="p-4 text-green-400">{account.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}