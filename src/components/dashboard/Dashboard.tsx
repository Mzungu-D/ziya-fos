import { useMemo } from "react";

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
import { getOrganizationRole } from "../../lib/auth";

interface AuthenticatedUser {
  organizationId?: string;
  organizationRole?: string | null;
  organization?: {
    id?: string;
    name?: string;
    legalName?: string;
  };
}

function getAuthenticatedUser(): AuthenticatedUser | null {
  try {
    const raw =
      localStorage.getItem("user") ??
      localStorage.getItem("authUser") ??
      localStorage.getItem("currentUser");

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    return parsed as AuthenticatedUser;
  } catch {
    return null;
  }
}

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }

  return "Good night";
}

function getOrganizationName(
  user: AuthenticatedUser | null
): string {
  return (
    user?.organization?.name?.trim() ||
    user?.organization?.legalName?.trim() ||
    "Your"
  );
}

function formatRoleName(role: string | null | undefined): string {
  if (!role) {
    return "Dashboard";
  }

  const normalizedRole = role.trim().toUpperCase();

  const roleNames: Record<string, string> = {
    OWNER: "Dashboard",
    FINANCE_MANAGER: "Finance Manager Dashboard",
    ACCOUNTANT: "Accountant Dashboard",
    FINANCE_OFFICER: "Finance Officer Dashboard",
    ACCOUNTS_PAYABLE: "Accounts Payable Dashboard",
    ACCOUNTS_PAYABLE_OFFICER: "Accounts Payable Dashboard",
    ACCOUNTS_RECEIVABLE: "Accounts Receivable Dashboard",
    ACCOUNTS_RECEIVABLE_OFFICER: "Accounts Receivable Dashboard",
    PROCUREMENT_OFFICER: "Procurement Dashboard",
    HR_MANAGER: "HR Manager Dashboard",
    ASSET_MANAGER: "Asset Manager Dashboard",
    APPROVER: "Approver Dashboard",
    AUDITOR: "Auditor Dashboard",
    VIEWER: "Viewer Dashboard",
    CUSTOM: "Custom Workspace",
  };

  if (roleNames[normalizedRole]) {
    return roleNames[normalizedRole];
  }

  return `${normalizedRole
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ")} Dashboard`;
}

export default function Dashboard() {
  const user = useMemo(
    () => getAuthenticatedUser(),
    []
  );

  const greeting = useMemo(
    () => getGreeting(new Date().getHours()),
    []
  );

  const organizationName = useMemo(
    () => getOrganizationName(user),
    [user]
  );

  const organizationRole = useMemo(
    () => getOrganizationRole(),
    []
  );

  const dashboardTitle = useMemo(
    () => formatRoleName(
      organizationRole ?? user?.organizationRole
    ),
    [organizationRole, user]
  );

  const hasOrganization =
    organizationName !== "Your";

  return (
    <>
      {/* =====================================================
          ROLE-AWARE TENANT WELCOME
      ===================================================== */}

      <section className="mb-8">
        <h2 className="text-4xl font-bold text-[#20243A]">
          {dashboardTitle}
        </h2>

        <p className="mt-2 text-[#666B84]">
          {hasOrganization
            ? `${greeting}, welcome to ${organizationName} Financial Operating System.`
            : `${greeting}. Here's what's happening with your finances today.`}
        </p>
      </section>

      {/* =====================================================
          KPI CARDS
      ===================================================== */}

      <KPICards />

      {/* =====================================================
          DASHBOARD CONTENT
      ===================================================== */}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT SIDE */}

        <div className="space-y-6 xl:col-span-8">
          <CashFlowChart />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ExpenseBreakdown />
            <ProfitLossSummary />
          </div>

          <QuickActions />
        </div>

        {/* RIGHT SIDE */}

        <div className="space-y-6 xl:col-span-4">
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