import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const data = [
  {
    name: "Enterprise",
    value: 12,
    color: "#6D5DF6",
  },
  {
    name: "Professional",
    value: 8,
    color: "#2563EB",
  },
  {
    name: "Starter",
    value: 5,
    color: "#F59E0B",
  },
  {
    name: "Trial",
    value: 2,
    color: "#22C55E",
  },
];

const total = data.reduce((sum, item) => sum + item.value, 0);

export default function SubscriptionChart() {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

      <div className="mb-6">

        <h2 className="text-lg font-semibold text-[#20243A]">
          Subscription Overview
        </h2>

        <p className="mt-1 text-sm text-[#666B84]">
          Distribution of active subscription plans
        </p>

      </div>

      <div className="relative h-[280px]">

        <ResponsiveContainer width="100%" height="100%">

          <PieChart>

            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={95}
              strokeWidth={4}
              stroke="#FFFFFF"
            >

              {data.map((entry) => (

                <Cell
                  key={entry.name}
                  fill={entry.color}
                />

              ))}

            </Pie>

            <Tooltip />

            <Legend
              verticalAlign="bottom"
              iconType="circle"
            />

          </PieChart>

        </ResponsiveContainer>

        {/* Center Total */}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">

          <p className="text-xs uppercase tracking-wider text-[#9AA3B2]">
            Total
          </p>

          <h2 className="mt-1 text-4xl font-bold text-[#20243A]">
            {total}
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Organizations
          </p>

        </div>

      </div>

      {/* Summary */}

      <div className="mt-6 space-y-3">

        {data.map((item) => (

          <div
            key={item.name}
            className="flex items-center justify-between"
          >

            <div className="flex items-center gap-3">

              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: item.color,
                }}
              />

              <span className="text-sm text-[#666B84]">
                {item.name}
              </span>

            </div>

            <span className="font-semibold text-[#20243A]">
              {item.value}
            </span>

          </div>

        ))}

      </div>

    </div>
  );
}