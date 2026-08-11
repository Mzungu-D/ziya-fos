import {
  Plus,
  Smartphone,
  Link2,
  Edit,
  Trash2,
} from "lucide-react";

const mpesaAccounts = [
  {
    type: "Paybill",
    number: "123456",
    purpose: "Loan Repayments",
    status: "Connected",
  },
  {
    type: "Till Number",
    number: "654321",
    purpose: "Merchant Collections",
    status: "Connected",
  },
];

export default function MpesaIntegration() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            M-Pesa Integration
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage Paybills, Till Numbers and M-Pesa integrations.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-[#20243A]">
          <Plus size={18} />
          Add M-Pesa Account
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Connected Accounts</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            {mpesaAccounts.length}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Active Integrations</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            {mpesaAccounts.filter(a => a.status === "Connected").length}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Status</p>
          <h2 className="text-xl font-bold text-green-400 mt-2">
            Ready for Integration
          </h2>
        </div>
      </div>

      {/* Accounts */}
      <div className="grid grid-cols-2 gap-6">
        {mpesaAccounts.map((account, index) => (
          <div
            key={index}
            className="bg-white border border-[#ECECF3] rounded-2xl p-6 hover:border-green-500 transition-all"
          >
            <div className="flex justify-between items-start">

              <div className="flex gap-4">
                <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Smartphone
                    size={28}
                    className="text-green-400"
                  />
                </div>

                <div>
                  <h2 className="text-xl text-[#20243A] font-semibold">
                    {account.type}
                  </h2>

                  <p className="text-[#666B84]">
                    {account.number}
                  </p>

                  <p className="text-[#666B84] text-sm mt-1">
                    {account.purpose}
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