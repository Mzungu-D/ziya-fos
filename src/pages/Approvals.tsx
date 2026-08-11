const approvals = [
  {
    id: "APR-001",
    module: "Procurement",
    description: "Purchase of office laptops",
    amount: "KES 850,000",
    requestedBy: "IT Department",
    status: "Pending",
  },
  {
    id: "APR-002",
    module: "Expenses",
    description: "Office transport reimbursement",
    amount: "KES 78,000",
    requestedBy: "Operations",
    status: "Approved",
  },
  {
    id: "APR-003",
    module: "Payroll",
    description: "July payroll processing",
    amount: "KES 355,000",
    requestedBy: "HR Department",
    status: "Rejected",
  },
];

export default function Approvals() {
  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold text-[#20243A]">
          Approvals
        </h1>

        <p className="text-[#666B84] mt-2">
          Review and approve financial requests.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">

          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">ID</th>
              <th className="text-left p-4">Module</th>
              <th className="text-left p-4">Description</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-left p-4">Requested By</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {approvals.map((approval) => (
              <tr
                key={approval.id}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-blue-400">
                  {approval.id}
                </td>

                <td className="p-4 text-[#20243A]">
                  {approval.module}
                </td>

                <td className="p-4 text-[#666B84]">
                  {approval.description}
                </td>

                <td className="p-4 text-right text-[#20243A]">
                  {approval.amount}
                </td>

                <td className="p-4 text-[#666B84]">
                  {approval.requestedBy}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      approval.status === "Approved"
                        ? "bg-green-500/20 text-green-400"
                        : approval.status === "Rejected"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {approval.status}
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