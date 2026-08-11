import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const data = [
  { month: "Jan", inflow: 1200000, outflow: 800000 },
  { month: "Feb", inflow: 1500000, outflow: 950000 },
  { month: "Mar", inflow: 1700000, outflow: 1200000 },
  { month: "Apr", inflow: 2100000, outflow: 1500000 },
  { month: "May", inflow: 2400000, outflow: 1650000 },
  { month: "Jun", inflow: 2600000, outflow: 1800000 },
];

export default function CashFlowChart() {
  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">
            Cash Flow Overview
          </h2>
          <p className="text-[#666B84] text-sm">
            Monthly Cash Inflow vs Outflow
          </p>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid stroke="#1e293b" />

            <XAxis
              dataKey="month"
              stroke="#94a3b8"
            />

            <YAxis
              stroke="#94a3b8"
            />

            <Tooltip />

            <Area
              type="monotone"
              dataKey="inflow"
              stroke="#22c55e"
              fill="#22c55e33"
              strokeWidth={3}
            />

            <Area
              type="monotone"
              dataKey="outflow"
              stroke="#ef4444"
              fill="#ef444433"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}