const transactions = [
  { id: "INV-2025-00124", type: "Customer Payment",   amount: "+KES 2,450,000", date: "Jun 30, 2025", color: "text-[#16A34A]" },
  { id: "BILL-2025-00567", type: "Supplier Payment",  amount: "-KES 1,250,000", date: "Jun 30, 2025", color: "text-[#EF4444]" },
  { id: "EXP-2025-00987",  type: "Office Expenses",   amount: "-KES 125,000",   date: "Jun 29, 2025", color: "text-[#EF4444]" },
  { id: "INV-2025-00123",  type: "Customer Payment",  amount: "+KES 3,120,000", date: "Jun 29, 2025", color: "text-[#16A34A]" },
  { id: "PAY-2025-00654",  type: "Payroll Processing", amount: "-KES 4,850,000", date: "Jun 28, 2025", color: "text-[#EF4444]" },
];

export default function RecentTransactions() {
  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#20243A]">Recent Transactions</h2>
        <button className="text-[#20243A] text-sm font-medium hover:text-[#5a4de0] transition">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex justify-between items-center border-b border-[#ECECF3] pb-3 last:border-0 last:pb-0">
            <div>
              <p className="text-[#20243A] font-medium text-sm">{tx.id}</p>
              <p className="text-[#666B84] text-sm">{tx.type}</p>
            </div>
            <div className="text-right">
              <p className={`font-semibold text-sm ${tx.color}`}>{tx.amount}</p>
              <p className="text-[#666B84] text-sm">{tx.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
