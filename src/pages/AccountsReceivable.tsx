import { Plus, Search } from "lucide-react";

const receivables = [
  {
    customer: "Mombasa Traders Ltd",
    invoice: "AR-0001",
    amount: "KES 850,000",
    dueDate: "2026-07-25",
    status: "Outstanding",
  },
  {
    customer: "Coastal Supplies Ltd",
    invoice: "AR-0002",
    amount: "KES 420,000",
    dueDate: "2026-07-18",
    status: "Partially Paid",
  },
  {
    customer: "Kilifi Enterprises",
    invoice: "AR-0003",
    amount: "KES 1,250,000",
    dueDate: "2026-07-10",
    status: "Overdue",
  },
  {
    customer: "Ocean Logistics",
    invoice: "AR-0004",
    amount: "KES 675,000",
    dueDate: "2026-07-30",
    status: "Outstanding",
  },
];

export default function AccountsReceivable() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Accounts Receivable
          </h1>

          <p className="text-slate-400 mt-2">
            Track customer invoices and incoming payments.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          New Invoice
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />

          <input
            type="text"
            placeholder="Search invoices..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>
      </div>

      {/* Receivables Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Customer</th>
              <th className="text-left p-4">Invoice</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-left p-4">Due Date</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {receivables.map((invoice) => (
              <tr
                key={invoice.invoice}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-white">
                  {invoice.customer}
                </td>

                <td className="p-4 text-blue-400">
                  {invoice.invoice}
                </td>

                <td className="p-4 text-right text-white font-semibold">
                  {invoice.amount}
                </td>

                <td className="p-4 text-slate-300">
                  {invoice.dueDate}
                </td>

                <td className="p-4">
                  <span
                    className={`
                      px-3 py-1 rounded-full text-sm
                      ${
                        invoice.status === "Outstanding"
                          ? "bg-blue-500/20 text-blue-400"
                          : invoice.status === "Partially Paid"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                      }
                    `}
                  >
                    {invoice.status}
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