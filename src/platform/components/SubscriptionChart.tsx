import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
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
    color: "#3B82F6",
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

export default function SubscriptionChart() {
  return (
    <div className="rounded-3xl border border-[#ECECF3] bg-white p-6 shadow-sm">

      <h2 className="text-lg font-semibold text-[#20243A]">
        Subscription Overview
      </h2>

      <div className="mt-6 h-72">

        <ResponsiveContainer>

          <PieChart>

            <Pie
              data={data}
              innerRadius={70}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >

              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                />
              ))}

            </Pie>

          </PieChart>

        </ResponsiveContainer>

      </div>

      <div className="space-y-3">

        {data.map((item) => (

          <div
            key={item.name}
            className="flex items-center justify-between"
          >

            <div className="flex items-center gap-3">

              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: item.color,
                }}
              />

              <span className="text-sm text-slate-600">
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