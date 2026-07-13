import KPICards from "./KPICards";
import CashFlowChart from "./CashFlowChart";
import FinancialAssistant from "./FinancialAssistant";
import FinancialHealthScore from "./FinancialHealthScore";
import ExpenseBreakdown from "./ExpenseBreakdown";
import ProfitLossSummary from "./ProfitLossSummary";
import RecentTransactions from "./RecentTransactions";
import ActivityFeed from "./ActivityFeed";
import QuickActions from "./QuickActions";
import UpcomingPayments from "./UpcomingPayments";

export default function Dashboard() {
  return (
    <>
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-white">
          Good morning 👋
        </h2>

        <p className="text-slate-400 mt-2">
          Here's what's happening with your finances today.
        </p>
      </div>

      {/* KPI Cards */}
      <KPICards />

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6 mt-6">

        {/* LEFT SIDE */}
        <div className="col-span-8 space-y-6">

          <CashFlowChart />

          <div className="grid grid-cols-2 gap-6">
            <ExpenseBreakdown />
            <ProfitLossSummary />
          </div>

          <QuickActions />

        </div>

        {/* RIGHT SIDE */}
        <div className="col-span-4 space-y-6">

          <FinancialAssistant />

          <FinancialHealthScore />

          <RecentTransactions />

          <ActivityFeed />

          <UpcomingPayments />

        </div>

      </div>
    </>
  );
}