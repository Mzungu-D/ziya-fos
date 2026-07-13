import { Plus, Download, Landmark } from "lucide-react";

const accounts = [
  {
    account: "Equity Bank - Main Account",
    type: "Bank",
    balance: "KES 12,456,700",
    status: "Active",
  },
  {
    account: "KCB Operations Account",
    type: "Bank",
    balance: "KES 8,320,500",
    status: "Active",
  },
  {
    account: "M-Pesa Collection Wallet",
    type: "Mobile Money",
    balance: "KES 1,240,000",
    status: "Connected",
  },
  {
    account: "Petty Cash",
    type: "Cash",
    balance: "KES 75,000",
    status: "Active",
  },
];

export default function CashBank() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Cash & Bank
          </h1>

          <p className="text-slate-400 mt-2">
            Manage bank accounts, cash balances and reconciliations.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-white">
            <Download size={18} />
            Export
          </button>

          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
            <Plus size={18} />
            Add Account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Total Bank Balance</p>
          <h2 className="text-2xl font-bold text-white mt-2">
            KES 20,777,200
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Mobile Money</p>
          <h2 className="text-2xl font-bold text-white mt-2">
            KES 1,240,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Cash On Hand</p>
          <h2 className="text-2xl font-bold text-white mt-2">
            KES 75,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Unreconciled Transactions</p>
          <h2 className="text-2xl font-bold text-red-400 mt-2">
            12
          </h2>
        </div>
      </div>

      {/* Accounts */}
      <div className="grid grid-cols-2 gap-6">
        {accounts.map((account) => (
          <div
            key={account.account}
            className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Landmark size={28} className="text-blue-400" />
              </div>

              <div>
                <h2 className="text-white text-lg font-semibold">
                  {account.account}
                </h2>

                <p className="text-slate-400">
                  {account.type}
                </p>
              </div>
            </div>

            <h3 className="text-3xl font-bold text-white">
              {account.balance}
            </h3>

            <div className="mt-4">
              <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400">
                {account.status}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}