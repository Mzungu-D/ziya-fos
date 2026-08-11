import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Activity,
  BarChart3,
} from "lucide-react";

const insights = [
  {
    title: "Revenue Growth",
    value: "+18.4%",
    trend: "positive",
  },
  {
    title: "Expense Growth",
    value: "+6.2%",
    trend: "negative",
  },
  {
    title: "Cash Flow Health",
    value: "92%",
    trend: "positive",
  },
  {
    title: "Budget Utilization",
    value: "84%",
    trend: "positive",
  },
];

export default function AnalyticsInsights() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#20243A]">
          Analytics & Insights
        </h1>

        <p className="text-[#666B84] mt-2">
          Analyze business performance and financial trends.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-6">
        {insights.map((item) => (
          <div
            key={item.title}
            className="bg-white border border-[#ECECF3] rounded-2xl p-6"
          >
            <p className="text-[#666B84]">
              {item.title}
            </p>

            <div className="flex items-center justify-between mt-4">
              <h2 className="text-3xl font-bold text-[#20243A]">
                {item.value}
              </h2>

              {item.trend === "positive" ? (
                <TrendingUp className="text-green-400" />
              ) : (
                <TrendingDown className="text-red-400" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-2 gap-6">

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="text-green-400" />
            <h2 className="text-xl font-semibold text-[#20243A]">
              Revenue Insight
            </h2>
          </div>

          <p className="text-[#666B84]">
            Revenue increased by 18.4% compared to the previous quarter,
            primarily driven by improved collections and portfolio growth.
          </p>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <PieChart className="text-[#6D5DF6]" />
            <h2 className="text-xl font-semibold text-[#20243A]">
              Expense Insight
            </h2>
          </div>

          <p className="text-[#666B84]">
            Operating expenses remain within budget targets with technology
            expenses representing the largest cost category.
          </p>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-yellow-400" />
            <h2 className="text-xl font-semibold text-[#20243A]">
              Portfolio Insight
            </h2>
          </div>

          <p className="text-[#666B84]">
            Portfolio companies are performing above expected repayment levels
            with strong cash recovery trends.
          </p>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="text-purple-400" />
            <h2 className="text-xl font-semibold text-[#20243A]">
              Forecast Insight
            </h2>
          </div>

          <p className="text-[#666B84]">
            Current financial projections indicate positive year-end growth
            if spending trends remain stable.
          </p>
        </div>

      </div>

    </div>
  );
}