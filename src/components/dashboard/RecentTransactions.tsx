const transactions = [
  {
    id: "INV-2025-00124",
    type: "Customer Payment",
    amount: "+KES 2,450,000",
    date: "Jun 30, 2025",
    color: "text-green-400",
  },
  {
    id: "BILL-2025-00567",
    type: "Supplier Payment",
    amount: "-KES 1,250,000",
    date: "Jun 30, 2025",
    color: "text-red-400",
  },
  {
    id: "EXP-2025-00987",
    type: "Office Expenses",
    amount: "-KES 125,000",
    date: "Jun 29, 2025",
    color: "text-red-400",
  },
  {
    id: "INV-2025-00123",
    type: "Customer Payment",
    amount: "+KES 3,120,000",
    date: "Jun 29, 2025",
    color: "text-green-400",
  },
  {
    id: "PAY-2025-00654",
    type: "Payroll Processing",
    amount: "-KES 4,850,000",
    date: "Jun 28, 2025",
    color: "text-red-400",
  },
];

export default function RecentTransactions() {
  return (
    <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#20243A]">
          Recent Transactions
        </h2>

        <button className="text-blue-400 text-sm hover:text-blue-300">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex justify-between items-center border-b border-[#ECECF3] pb-3"
          >
            <div>
              <p className="text-[#20243A] font-medium">{tx.id}</p>
              <p className="text-[#666B84] text-sm">{tx.type}</p>
            </div>

            <div className="text-right">
              <p className={`font-semibold ${tx.color}`}>
                {tx.amount}
              </p>

              <p className="text-[#666B84] text-sm">
                {tx.date}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}