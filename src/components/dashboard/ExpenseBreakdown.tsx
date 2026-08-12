import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Operations", value: 35 },
  { name: "Payroll",    value: 30 },
  { name: "Marketing",  value: 15 },
  { name: "Technology", value: 12 },
  { name: "Other",      value: 8  },
];

const COLORS = ["#20243A", "#16A34A", "#F59E0B", "#EF4444", "#94A3B8"];

export default function ExpenseBreakdown() {
  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <h2 className="text-xl font-bold text-[#20243A] mb-1">Expense Breakdown</h2>
      <p className="text-[#666B84] text-sm mb-6">Distribution of monthly expenses</p>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value">
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3 mt-4">
        {data.map((item, index) => (
          <div key={item.name} className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
              <span className="text-[#666B84]">{item.name}</span>
            </div>
            <span className="text-[#20243A] font-semibold">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
