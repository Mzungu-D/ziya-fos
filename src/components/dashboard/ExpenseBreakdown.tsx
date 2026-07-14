import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const data = [
  { name: "Operations", value: 35 },
  { name: "Payroll", value: 30 },
  { name: "Marketing", value: 15 },
  { name: "Technology", value: 12 },
  { name: "Other", value: 8 },
];

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

export default function ExpenseBreakdown() {
  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-1">
        Expense Breakdown
      </h2>

      <p className="text-slate-400 text-sm mb-6">
        Distribution of monthly expenses
      </p>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={70}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3 mt-4">
        {data.map((item, index) => (
          <div
            key={item.name}
            className="flex justify-between items-center"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: COLORS[index],
                }}
              />

              <span className="text-slate-300">
                {item.name}
              </span>
            </div>

            <span className="text-white font-semibold">
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}