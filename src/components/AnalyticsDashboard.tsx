import {
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface AnalyticsDashboardProps {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export default function AnalyticsDashboard({
  totalRevenue,
  totalExpenses,
  netProfit,
}: AnalyticsDashboardProps) {
  const totalVolume = totalRevenue + totalExpenses;

  const revenuePercentage =
    totalVolume > 0
      ? (totalRevenue / totalVolume) * 100
      : 0;

  const expensePercentage =
    totalVolume > 0
      ? (totalExpenses / totalVolume) * 100
      : 0;

  return (
    <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />

          <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
            Intelligence Analytics Dashboard
          </h3>
        </div>

        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Operational Engine Online
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">

        {/* Visual Analytics Ratio Meter */}
        <div className="flex flex-col gap-3">

          <div className="flex justify-between text-xs font-semibold">

            <span className="text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Revenue Split ({revenuePercentage.toFixed(0)}%)
            </span>

            <span className="text-rose-400 flex items-center gap-1">
              Expense Split ({expensePercentage.toFixed(0)}%)
              <ArrowDownRight className="w-3.5 h-3.5" />
            </span>

          </div>

          <div className="w-full h-3.5 bg-white rounded-full overflow-hidden flex border border-[#ECECF3]">

            {totalVolume === 0 ? (
              <div className="w-full h-full bg-[#F8F9FC]/40 opacity-50"></div>
            ) : (
              <>
                <div
                  style={{ width: `${revenuePercentage}%` }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                />

                <div
                  style={{ width: `${expensePercentage}%` }}
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-500"
                />
              </>
            )}

          </div>
        </div>

        {/* Efficiency Calculation Box */}
        <div className="bg-black/20 border border-[#ECECF3]/80 rounded-xl p-3.5 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>

            <div>
              <p className="text-[10px] text-[#666B84] uppercase tracking-wide font-medium">
                Net Efficiency Margin
              </p>

              <p className="text-sm font-black text-[#20243A] mt-0.5">
                {totalRevenue > 0
                  ? ((netProfit / totalRevenue) * 100).toFixed(1) + "%"
                  : "0.0%"}
              </p>
            </div>

          </div>

          <div className="text-right">

            <p className="text-[9px] text-[#666B84] uppercase font-mono">
              Status
            </p>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                netProfit >= 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              }`}
            >
              {netProfit >= 0
                ? "OPTIMAL"
                : "DEFICIT"}
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}