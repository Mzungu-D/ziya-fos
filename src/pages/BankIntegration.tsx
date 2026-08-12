import { Plus, Building2, Link2, Edit, Trash2 } from "lucide-react";

const bankAccounts = [
  {
    bankName: "Choice Bank",
    accountName: "Operations Account",
    accountNumber: "****1234",
    currency: "KES",
    status: "Connected",
  },
  {
    bankName: "Choice Bank",
    accountName: "Payroll Account",
    accountNumber: "****5678",
    currency: "KES",
    status: "Connected",
  },
];

export default function BankIntegration() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Bank Integration
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage bank accounts and integrations for Ziya FOS.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-[#20243A] hover:bg-[#5a4de0] px-4 py-2 rounded-lg text-[#20243A]">
          <Plus size={18} />
          Add Bank Account
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Connected Banks</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            {new Set(bankAccounts.map(a => a.bankName)).size}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Bank Accounts</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            {bankAccounts.length}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Status</p>
          <h2 className="text-xl font-bold text-green-400 mt-2">
            Ready for Integration
          </h2>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="grid grid-cols-2 gap-6">
        {bankAccounts.map((account, index) => (
          <div
            key={index}
            className="bg-white border border-[#ECECF3] rounded-2xl p-6 hover:border-[#20243A] transition-all"
          >
            <div className="flex justify-between items-start">

              <div className="flex gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#20243A]/10 flex items-center justify-center">
                  <Building2
                    size={28}
                    className="text-[#20243A]"
                  />
                </div>

                <div>
                  <h2 className="text-xl text-[#20243A] font-semibold">
                    {account.bankName}
                  </h2>

                  <p className="text-[#666B84]">
                    {account.accountName}
                  </p>

                  <p className="text-[#666B84] text-sm mt-1">
                    {account.accountNumber}
                  </p>

                  <p className="text-[#666B84] text-sm">
                    Currency: {account.currency}
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400">
                {account.status}
              </span>
            </div>

            <div className="mt-6 flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F8F9FC] hover:bg-[#ECECF3] text-[#20243A]">
                <Link2 size={16} />
                Connect API
              </button>

              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F8F9FC] hover:bg-[#ECECF3] text-[#20243A]">
                <Edit size={16} />
                Edit
              </button>

              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400">
                <Trash2 size={16} />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
