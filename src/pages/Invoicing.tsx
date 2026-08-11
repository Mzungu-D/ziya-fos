import { Plus, Search, Download } from "lucide-react";

const invoices = [
  {
    invoice: "INV-2025-00124",
    customer: "Mombasa Fresh Foods Ltd",
    amount: "KES 2,450,000",
    dueDate: "2026-07-25",
    status: "Paid",
  },
  {
    invoice: "INV-2025-00125",
    customer: "Coast Logistics Ltd",
    amount: "KES 1,250,000",
    dueDate: "2026-07-20",
    status: "Pending",
  },
  {
    invoice: "INV-2025-00126",
    customer: "Blue Ocean Traders",
    amount: "KES 850,000",
    dueDate: "2026-07-18",
    status: "Overdue",
  },
];

export default function Invoicing() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Invoicing
          </h1>

          <p className="text-[#666B84] mt-2">
            Create, manage and track invoices.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-[#F8F9FC] hover:bg-[#ECECF3] px-4 py-2 rounded-lg text-[#20243A]">
            <Download size={18} />
            Export
          </button>

          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-[#20243A]">
            <Plus size={18} />
            New Invoice
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-4">
        <div className="flex items-center bg-white rounded-lg px-3">
          <Search size={18} className="text-[#666B84]" />

          <input
            type="text"
            placeholder="Search invoices..."
            className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
          />
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">Invoice No</th>
              <th className="text-left p-4">Customer</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-left p-4">Due Date</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.invoice}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-blue-400">
                  {invoice.invoice}
                </td>

                <td className="p-4 text-[#20243A]">
                  {invoice.customer}
                </td>

                <td className="p-4 text-right text-[#20243A] font-semibold">
                  {invoice.amount}
                </td>

                <td className="p-4 text-[#666B84]">
                  {invoice.dueDate}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      invoice.status === "Paid"
                        ? "bg-green-500/20 text-green-400"
                        : invoice.status === "Pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
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