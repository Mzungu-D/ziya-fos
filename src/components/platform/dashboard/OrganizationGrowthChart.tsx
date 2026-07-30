import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const data = [
  { month: "Jan", organizations: 4 },
  { month: "Feb", organizations: 7 },
  { month: "Mar", organizations: 10 },
  { month: "Apr", organizations: 15 },
  { month: "May", organizations: 19 },
  { month: "Jun", organizations: 24 },
  { month: "Jul", organizations: 30 },
];

export default function OrganizationGrowthChart() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          Organization Growth
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Monthly tenant registrations across the platform.
        </p>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="4 4" stroke="#334155" />

            <XAxis
              dataKey="month"
              tick={{ fill: "#94A3B8" }}
            />

            <YAxis
              tick={{ fill: "#94A3B8" }}
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="organizations"
              stroke="#F59E0B"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}