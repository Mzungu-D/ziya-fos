import { Plus, Search, Download } from "lucide-react";

const expenses = [
  {
    id: "EXP-2025-001",
    category: "Office Rent",
    amount: "KES 250,000",
    date: "2026-07-01",
    status: "Approved",
  },
  {
    id: "EXP-2025-002",
    category: "Internet Services",
    amount: "KES 35,000",
    date: "2026-07-03",
    status: "Pending",
  },
  {
    id: "EXP-2025-003",
    category: "Fuel & Transport",
    amount: "KES 78,000",
    date: "2026-07-05",
    status: "Approved",
  },
  {
    id: "EXP-2025-004",
    category: "Office Supplies",
    amount: "KES 18,500",
    date: "2026-07-06",
    status: "Rejected",
  },
];

export default function Expenses() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Expenses
          </h1>

          <p className="text-[#666B84] mt-2">
            Track and manage operational expenses.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-[#F8F9FC] hover:bg-[#ECECF3] px-4 py-2 rounded-lg text-[#20243A]">
            <Download size={18} />
            Export
          </button>

          <button className="flex items-center gap-2 bg-[#6D5DF6] hover:bg-[#5a4de0] px-4 py-2 rounded-lg text-[#20243A]">
            <Plus size={18} />
            New Expense
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl p-4">
        <div className="flex items-center bg-white rounded-lg px-3">
          <Search size={18} className="text-[#666B84]" />

          <input
            type="text"
            placeholder="Search expenses..."
            className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">Expense ID</th>
              <th className="text-left p-4">Category</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {expenses.map((expense) => (
              <tr
                key={expense.id}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-[#6D5DF6]">
                  {expense.id}
                </td>

                <td className="p-4 text-[#20243A]">
                  {expense.category}
                </td>

                <td className="p-4 text-right text-[#20243A] font-semibold">
                  {expense.amount}
                </td>

                <td className="p-4 text-[#666B84]">
                  {expense.date}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      expense.status === "Approved"
                        ? "bg-green-500/20 text-green-400"
                        : expense.status === "Pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {expense.status}
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