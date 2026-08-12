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
          <h1 className="text-3xl font-bold text-[#20243A]">
            Cash & Bank
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage bank accounts, cash balances and reconciliations.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-[#F8F9FC] hover:bg-[#ECECF3] px-4 py-2 rounded-lg text-[#20243A]">
            <Download size={18} />
            Export
          </button>

          <button className="flex items-center gap-2 bg-[#0D9488] hover:bg-[#5a4de0] px-4 py-2 rounded-lg text-[#20243A]">
            <Plus size={18} />
            Add Account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Total Bank Balance</p>
          <h2 className="text-2xl font-bold text-[#20243A] mt-2">
            KES 20,777,200
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Mobile Money</p>
          <h2 className="text-2xl font-bold text-[#20243A] mt-2">
            KES 1,240,000
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Cash On Hand</p>
          <h2 className="text-2xl font-bold text-[#20243A] mt-2">
            KES 75,000
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Unreconciled Transactions</p>
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
            className="bg-white border border-[#ECECF3] rounded-2xl p-6 hover:border-[#20243A] transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-[#0D9488]/10 flex items-center justify-center">
                <Landmark size={28} className="text-[#20243A]" />
              </div>

              <div>
                <h2 className="text-[#20243A] text-lg font-semibold">
                  {account.account}
                </h2>

                <p className="text-[#666B84]">
                  {account.type}
                </p>
              </div>
            </div>

            <h3 className="text-3xl font-bold text-[#20243A]">
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

