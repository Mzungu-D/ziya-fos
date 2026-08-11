const rows = [
  {
    title: "Total Revenue",
    value: "KES 45,678,900",
    color: "text-[#20243A]",
  },
  {
    title: "Cost of Goods Sold",
    value: "-KES 15,120,400",
    color: "text-red-400",
  },
  {
    title: "Gross Profit",
    value: "KES 30,558,500",
    color: "text-green-400",
  },
  {
    title: "Operating Expenses",
    value: "-KES 10,218,000",
    color: "text-red-400",
  },
  {
    title: "Net Profit",
    value: "KES 20,338,400",
    color: "text-green-400",
  },
  {
    title: "Net Profit Margin",
    value: "44.5%",
    color: "text-blue-400",
  },
];

export default function ProfitLossSummary() {
  return (
    <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#20243A]">
          Profit & Loss Summary
        </h2>

        <button className="text-sm text-[#666B84] bg-[#F8F9FC] px-3 py-2 rounded-lg">
          This Month
        </button>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.title}
            className="flex justify-between items-center border-b border-[#ECECF3] pb-3"
          >
            <span className="text-[#666B84]">
              {row.title}
            </span>

            <span className={`font-semibold ${row.color}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <button className="mt-6 text-blue-400 hover:text-blue-300 transition">
        View Full P&L Statement →
      </button>
    </div>
  );
}