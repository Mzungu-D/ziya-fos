import { Plus } from "lucide-react";

const taxes = [
  {
    tax: "VAT Return",
    period: "June 2026",
    amount: "KES 1,250,000",
    dueDate: "2026-07-20",
    status: "Pending",
  },
  {
    tax: "PAYE",
    period: "June 2026",
    amount: "KES 540,000",
    dueDate: "2026-07-09",
    status: "Submitted",
  },
  {
    tax: "Withholding Tax",
    period: "June 2026",
    amount: "KES 125,000",
    dueDate: "2026-07-20",
    status: "Pending",
  },
];

export default function TaxManagement() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Tax Management
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage tax obligations, filings and compliance.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-[#20243A]">
          <Plus size={18} />
          New Tax Filing
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Upcoming Filings</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            2
          </h2>
        </div>

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Submitted Returns</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            1
          </h2>
        </div>

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Outstanding Tax</p>
          <h2 className="text-3xl font-bold text-red-400 mt-2">
            KES 1,375,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Compliance Status</p>
          <h2 className="text-2xl font-bold text-green-400 mt-2">
            Good
          </h2>
        </div>

      </div>

      {/* Tax Table */}
      <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">Tax Type</th>
              <th className="text-left p-4">Period</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-left p-4">Due Date</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {taxes.map((tax) => (
              <tr
                key={tax.tax + tax.period}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-[#20243A]">
                  {tax.tax}
                </td>

                <td className="p-4 text-[#666B84]">
                  {tax.period}
                </td>

                <td className="p-4 text-right text-[#20243A]">
                  {tax.amount}
                </td>

                <td className="p-4 text-[#666B84]">
                  {tax.dueDate}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      tax.status === "Submitted"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {tax.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>

    </div>
  );
}