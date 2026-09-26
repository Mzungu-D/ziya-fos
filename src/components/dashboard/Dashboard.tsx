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

import {
  getOrganizationRole,
  getSession,
} from "../../lib/auth";

interface OrganizationInfo {
  id?: string;
  name?: string;
  legalName?: string;
}

function getStoredOrganization(): OrganizationInfo | null {
  try {
    const raw =
      localStorage.getItem("organization") ??
      sessionStorage.getItem("organization");

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

    return parsed as OrganizationInfo;
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
  organization: OrganizationInfo | null
): string {
  const organizationName =
    organization?.name?.trim();

  if (organizationName) {
    return organizationName;
  }

  const legalName =
    organization?.legalName?.trim();

  if (legalName) {
    return legalName;
  }

  return "your organization";
}

function formatRoleName(
  role: string | null | undefined
): string {
  if (!role) {
    return "Dashboard";
  }

  const normalizedRole =
    role.trim().toUpperCase();

  const roleNames: Record<string, string> = {
    OWNER: "Dashboard",
    FINANCE_MANAGER:
      "Finance Manager Dashboard",
    ACCOUNTANT:
      "Accountant Dashboard",
    FINANCE_OFFICER:
      "Finance Officer Dashboard",
    ACCOUNTS_PAYABLE:
      "Accounts Payable Dashboard",
    ACCOUNTS_PAYABLE_OFFICER:
      "Accounts Payable Dashboard",
    ACCOUNTS_RECEIVABLE:
      "Accounts Receivable Dashboard",
    ACCOUNTS_RECEIVABLE_OFFICER:
      "Accounts Receivable Dashboard",
    PROCUREMENT_OFFICER:
      "Procurement Dashboard",
    HR_MANAGER:
      "HR Manager Dashboard",
    ASSET_MANAGER:
      "Asset Manager Dashboard",
    APPROVER:
      "Approver Dashboard",
    AUDITOR:
      "Auditor Dashboard",
    VIEWER:
      "Viewer Dashboard",
    CUSTOM:
      "Custom Workspace",
  };

  if (roleNames[normalizedRole]) {
    return roleNames[normalizedRole];
  }

  return `${normalizedRole
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ")} Dashboard`;
}

export default function Dashboard() {
  const session = useMemo(
    () => getSession(),
    []
  );

  const organization = useMemo(
    () => getStoredOrganization(),
    []
  );

  const greeting = useMemo(
    () =>
      getGreeting(
        new Date().getHours()
      ),
    []
  );

  const organizationName = useMemo(
    () =>
      getOrganizationName(
        organization
      ),
    [organization]
  );

  const organizationRole = useMemo(
    () => getOrganizationRole(),
    []
  );

  const dashboardTitle = useMemo(
    () =>
      formatRoleName(
        organizationRole ??
          session?.user?.organizationRole
      ),
    [
      organizationRole,
      session?.user?.organizationRole,
    ]
  );

  return (
    <>
      {/* =====================================================
          ORGANIZATION WELCOME
      ===================================================== */}

      <section className="mb-8">
        <h2 className="text-4xl font-bold text-[#20243A]">
          {dashboardTitle}
        </h2>

        <p className="mt-2 text-[#666B84]">
          {greeting},{" "}
          {organizationName}
        </p>

        <p className="mt-1 text-sm text-[#8A90A6]">
          Welcome to{" "}
          <span className="font-medium text-[#666B84]">
            {organizationName}
          </span>{" "}
          Financial Operating System.
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