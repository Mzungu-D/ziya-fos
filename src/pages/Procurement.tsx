import {
  Plus,
  Search,
} from "lucide-react";

const requests = [
  {
    requestId: "PR-2026-001",
    item: "Office Laptops",
    department: "Technology",
    amount: "KES 850,000",
    status: "Approved",
  },
  {
    requestId: "PR-2026-002",
    item: "Office Furniture",
    department: "Operations",
    amount: "KES 320,000",
    status: "Pending",
  },
  {
    requestId: "PR-2026-003",
    item: "Internet Services",
    department: "Technology",
    amount: "KES 120,000",
    status: "Ordered",
  },
];

export default function Procurement() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Procurement
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage purchase requests, orders and procurement workflows.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-[#6D5DF6] hover:bg-[#5a4de0] px-4 py-2 rounded-lg text-[#20243A]">
          <Plus size={18} />
          New Request
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Open Requests</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">3</h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Approved</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">1</h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Pending</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">1</h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Ordered</p>
          <h2 className="text-3xl font-bold text-[#6D5DF6] mt-2">1</h2>
        </div>

      </div>

      {/* Search */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl p-4">
        <div className="flex items-center bg-white rounded-lg px-3">
          <Search size={18} className="text-[#666B84]" />

          <input
            type="text"
            placeholder="Search procurement requests..."
            className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">Request ID</th>
              <th className="text-left p-4">Item</th>
              <th className="text-left p-4">Department</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {requests.map((request) => (
              <tr
                key={request.requestId}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-[#6D5DF6]">
                  {request.requestId}
                </td>

                <td className="p-4 text-[#20243A]">
                  {request.item}
                </td>

                <td className="p-4 text-[#666B84]">
                  {request.department}
                </td>

                <td className="p-4 text-right text-[#20243A]">
                  {request.amount}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      request.status === "Approved"
                        ? "bg-green-500/20 text-green-400"
                        : request.status === "Pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-[#6D5DF6]/20 text-[#6D5DF6]"
                    }`}
                  >
                    {request.status}
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