import {
  Plus,
  TrendingUp,
  TrendingDown,
  Target,
} from "lucide-react";

const budgets = [
  {
    department: "Finance",
    budget: "KES 5,000,000",
    actual: "KES 4,200,000",
    variance: "KES 800,000",
    status: "Under Budget",
  },
  {
    department: "Technology",
    budget: "KES 8,000,000",
    actual: "KES 8,500,000",
    variance: "-KES 500,000",
    status: "Over Budget",
  },
  {
    department: "Operations",
    budget: "KES 6,000,000",
    actual: "KES 5,200,000",
    variance: "KES 800,000",
    status: "Under Budget",
  },
];

export default function BudgetForecasting() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Budgeting & Forecasting
          </h1>

          <p className="text-slate-400 mt-2">
            Manage budgets, forecasts and financial planning.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          New Budget
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-6">

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Total Budget</p>
          <h2 className="text-3xl font-bold text-white mt-2">
            KES 19,000,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Actual Spend</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            KES 17,900,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Forecast Accuracy</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            94%
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Variance</p>
          <h2 className="text-3xl font-bold text-blue-400 mt-2">
            KES 1,100,000
          </h2>
        </div>

      </div>

      {/* Budget Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Department</th>
              <th className="text-right p-4">Budget</th>
              <th className="text-right p-4">Actual</th>
              <th className="text-right p-4">Variance</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {budgets.map((budget) => (
              <tr
                key={budget.department}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-white">
                  {budget.department}
                </td>

                <td className="p-4 text-right text-white">
                  {budget.budget}
                </td>

                <td className="p-4 text-right text-white">
                  {budget.actual}
                </td>

                <td className="p-4 text-right text-white">
                  {budget.variance}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      budget.status === "Under Budget"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {budget.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Forecast Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <Target className="text-blue-400" size={28} />

          <h2 className="text-xl font-bold text-white">
            AI Forecast
          </h2>
        </div>

        <p className="text-slate-300">
          Based on current spending trends, projected year-end expenditure is:
        </p>

        <h3 className="text-3xl font-bold text-green-400 mt-4">
          KES 72,500,000
        </h3>
      </div>

    </div>
  );
}