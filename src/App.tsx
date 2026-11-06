import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

/* Public Website */
import PublicLayout from "./components/public/PublicLayout";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Solutions from "./pages/Solutions";
import About from "./pages/About";
import OpenAccount from "./pages/OpenAccount";

/* Authentication */
import Login from "./pages/Login";
import OtpForm from "./pages/OtpForm";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvitation from "./pages/AcceptInvitation";
import RequireSession from "./components/auth/RequireSession";
import RequireOwner from "./components/auth/RequireOwner";
import RequirePermission from "./components/auth/RequirePermission";

/* Authentication / tenant authorization */
import {
  getOrganizationRole,
  getPermissions,
} from "./lib/auth";

/* =========================================================
   PLATFORM ADMINISTRATION
========================================================= */

import PlatformLayout from "./platform/PlatformLayout";
import PlatformDashboard from "./platform/PlatformDashboard";
import Organizations from "./platform/pages/Organizations";
import PlatformOrganizationDetails from "./platform/pages/PlatformOrganizationDetails";
import PlatformOrganizationWorkspace from "./platform/pages/PlatformOrganizationWorkspace";
import PlatformUsers from "./platform/pages/PlatformUsers";
import PlatformSettings from "./platform/pages/PlatformSettings";
import SecurityCenter from "./platform/pages/SecurityCenter";
import AuditLogs from "./platform/pages/AuditLogs";
import SystemHealth from "./platform/pages/SystemHealth";
import Integrations from "./platform/pages/Integrations";
import Billing from "./platform/pages/Billing";
import AIControlCenter from "./platform/pages/AIControlCenter";
import Reports from "./platform/pages/Reports";
import Subscriptions from "./platform/pages/Subscriptions";
import Licensing from "./platform/pages/Licensing";
import Support from "./platform/pages/Support";
import PlatformAdminProfile from "./platform/pages/PlatformAdminProfile";
import FosConfigurationTemplate from "./platform/pages/FosConfigurationTemplate";

/* =========================================================
   TENANT DASHBOARD
========================================================= */

import Dashboard from "./components/dashboard/Dashboard";
import DashboardLayout from "./components/layout/DashboardLayout";

/* =========================================================
   CORE FINANCIAL
========================================================= */

import ChartOfAccounts from "./pages/ChartOfAccounts";
import FinancialReports from "./pages/FinancialReports";
import ReportViewer from "./pages/ReportViewer";
import GeneralLedger from "./pages/GeneralLedger";
import JournalEntries from "./pages/JournalEntries";
import TrialBalance from "./pages/TrialBalance";

/* =========================================================
   BUSINESS OPERATIONS
========================================================= */

import AccountsPayable from "./pages/AccountsPayable";
import AccountsReceivable from "./pages/AccountsReceivable";
import BankIntegration from "./pages/BankIntegration";
import CashBank from "./pages/CashBank";
import BankStatements from "./pages/BankStatements";
import Expenses from "./pages/Expenses";
import Invoicing from "./pages/Invoicing";
import MpesaIntegration from "./pages/MpesaIntegration";
import MpesaSettings from "./pages/MpesaSettings";
import PortfolioCompanies from "./pages/PortfolioCompanies";
import ViewPortfolioCompany from "./pages/ViewPortfolioCompany";
import EditPortfolioCompany from "./pages/EditPortfolioCompany";
import Vendors from "./pages/Vendors";

/* =========================================================
   ADVANCED MODULES
========================================================= */

import Assets from "./pages/Assets";
import AssetAssignments from "./pages/AssetAssignments";
import BudgetForecasting from "./pages/BudgetForecasting";
import HRManagement from "./pages/HRManagement";
import Payroll from "./pages/Payroll";
import Procurement from "./pages/Procurement";
import TaxManagement from "./pages/TaxManagement";

/* =========================================================
   INTELLIGENCE
========================================================= */

import AnalyticsInsights from "./pages/AnalyticsInsights";
import FraudDetection from "./pages/FraudDetection";

/* =========================================================
   WORKFLOW & CONTROL
========================================================= */

import Approvals from "./pages/Approvals";
import AuditTrails from "./pages/AuditTrails";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import UsersAccess from "./pages/UsersAccess";

/* =========================================================
   TENANT LANDING
========================================================= */

/**
 * OWNERs enter the financial dashboard.
 *
 * Non-owner tenant members never enter the dashboard.
 * Instead, they are redirected to the first module for
 * which their current tenant membership has permission.
 *
 * The backend remains the authoritative authorization
 * boundary. This component only determines the correct
 * frontend landing destination.
 */
function TenantLanding() {
  const organizationRole =
    getOrganizationRole()
      ?.trim()
      .toUpperCase();

  /*
   * OWNER has full tenant access and is the only role
   * allowed to use the financial dashboard.
   */
  if (organizationRole === "OWNER") {
    return <Dashboard />;
  }

  const permissions = getPermissions();

  /*
   * "*" is reserved for full tenant access.
   * OWNER is handled above explicitly.
   */
  const hasWildcard =
    permissions.includes("*");

  if (hasWildcard) {
    return <Dashboard />;
  }

  /*
   * Ordered landing destinations.
   *
   * The first matching permission becomes the user's
   * workspace landing page.
   */
  const landingRoutes = [
    {
      permission: "account.view",
      path: "/dashboard/chart-of-accounts",
    },
    {
      permission: "ledger.view",
      path: "/dashboard/general-ledger",
    },
    {
      permission: "journal.view",
      path: "/dashboard/journal-entries",
    },
    {
      permission: "reports.view",
      path: "/dashboard/trial-balance",
    },
    {
      permission: "accountsPayable.view",
      path: "/dashboard/accounts-payable",
    },
    {
      permission: "accountsReceivable.view",
      path: "/dashboard/accounts-receivable",
    },
    {
      permission: "invoice.view",
      path: "/dashboard/invoicing",
    },
    {
      permission: "expense.view",
      path: "/dashboard/expenses",
    },
    {
      permission: "bankAccount.view",
      path: "/dashboard/cash-bank",
    },
    {
      permission: "mpesa.view",
      path: "/dashboard/mpesa-integration",
    },
    {
      permission: "portfolioCompany.view",
      path: "/dashboard/portfolio-companies",
    },
    {
      permission: "vendor.view",
      path: "/dashboard/vendors",
    },
    {
      permission: "employee.view",
      path: "/dashboard/hr-management",
    },
    {
      permission: "payroll.view",
      path: "/dashboard/payroll",
    },
    {
      permission: "procurement.view",
      path: "/dashboard/procurement",
    },
    {
      permission: "asset.view",
      path: "/dashboard/assets",
    },
    {
      permission: "assetAssignment.view",
      path: "/dashboard/assets/assignments",
    },
    {
      permission: "tax.view",
      path: "/dashboard/tax-management",
    },
    {
      permission: "budget.view",
      path: "/dashboard/budgeting",
    },
    {
      permission: "fraud.view",
      path: "/dashboard/fraud-detection",
    },
    {
      permission: "approval.view",
      path: "/dashboard/approvals",
    },
    {
      permission: "document.view",
      path: "/dashboard/documents",
    },
  ] as const;

  const landingRoute =
    landingRoutes.find(
      ({ permission }) =>
        permissions.includes(permission),
    );

  if (landingRoute) {
    return (
      <Navigate
        to={landingRoute.path}
        replace
      />
    );
  }

  /*
   * A tenant with no module permissions must not
   * see the financial dashboard.
   *
   * Returning to login prevents an unassigned user
   * from entering the tenant workspace.
   */
  return (
    <Navigate
      to="/login"
      replace
      state={{
        reason: "NO_MODULE_ACCESS",
      }}
    />
  );
}

/* =========================================================
   APPLICATION
========================================================= */

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =====================================================
            PUBLIC INVITATION
        ===================================================== */}

        <Route
          path="/invite/:token"
          element={<AcceptInvitation />}
        />

        {/* =====================================================
            PUBLIC ZIYA FOS OUTER LAYER
        ===================================================== */}

        <Route element={<PublicLayout />}>
          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/products"
            element={<Products />}
          />

          <Route
            path="/solutions"
            element={<Solutions />}
          />

          <Route
            path="/about"
            element={<About />}
          />

          <Route
            path="/open-account"
            element={<OpenAccount />}
          />
        </Route>

        {/* =====================================================
            AUTHENTICATION
        ===================================================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/otp"
          element={<OtpForm />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* =====================================================
            PLATFORM ADMINISTRATION
        ===================================================== */}

        <Route
          element={
            <RequireSession sessionType="PLATFORM" />
          }
        >
          <Route
            path="/platform"
            element={<PlatformLayout />}
          >
            <Route
              index
              element={<PlatformDashboard />}
            />

            <Route
              path="organizations"
              element={<Organizations />}
            />

            <Route
              path="organizations/:id"
              element={
                <PlatformOrganizationDetails />
              }
            />

            <Route
              path="workspace/:id"
              element={
                <PlatformOrganizationWorkspace />
              }
            />

            <Route
              path="users"
              element={<PlatformUsers />}
            />

            <Route
              path="settings"
              element={<PlatformSettings />}
            />

            <Route
              path="fos-configuration"
              element={<FosConfigurationTemplate />}
            />

            <Route
              path="security"
              element={<SecurityCenter />}
            />

            <Route
              path="audit-logs"
              element={<AuditLogs />}
            />

            <Route
              path="system-health"
              element={<SystemHealth />}
            />

            <Route
              path="integrations"
              element={<Integrations />}
            />

            <Route
              path="subscriptions"
              element={<Subscriptions />}
            />

            <Route
              path="licensing"
              element={<Licensing />}
            />

            <Route
              path="billing"
              element={<Billing />}
            />

            <Route
              path="reports"
              element={<Reports />}
            />

            <Route
              path="ai-control"
              element={<AIControlCenter />}
            />

            <Route
              path="support"
              element={<Support />}
            />

            <Route
              path="profile"
              element={<PlatformAdminProfile />}
            />
          </Route>
        </Route>

        {/* =====================================================
            TENANT WORKSPACE
        ===================================================== */}

        <Route
          element={
            <RequireSession sessionType="TENANT" />
          }
        >
          <Route
            path="/dashboard"
            element={<DashboardLayout />}
          >

            {/* =================================================
                DASHBOARD
                OWNER ONLY
            ================================================= */}

            <Route
              index
              element={<TenantLanding />}
            />

            {/* =================================================
                CORE FINANCIAL
            ================================================= */}

            <Route
              element={
                <RequirePermission
                  permissions={["account.view"]}
                />
              }
            >
              <Route
                path="chart-of-accounts"
                element={<ChartOfAccounts />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["ledger.view"]}
                />
              }
            >
              <Route
                path="general-ledger"
                element={<GeneralLedger />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["journal.view"]}
                />
              }
            >
              <Route
                path="journal-entries"
                element={<JournalEntries />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["reports.view"]}
                />
              }
            >
              <Route
                path="trial-balance"
                element={<TrialBalance />}
              />

              <Route
                path="financial-reports"
                element={<FinancialReports />}
              />

              <Route
                path="financial-reports/:reportType"
                element={<ReportViewer />}
              />
            </Route>

            {/* =================================================
                BUSINESS OPERATIONS
            ================================================= */}

            <Route
              element={
                <RequirePermission
                  permissions={[
                    "accountsPayable.view",
                  ]}
                />
              }
            >
              <Route
                path="accounts-payable"
                element={<AccountsPayable />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={[
                    "accountsReceivable.view",
                  ]}
                />
              }
            >
              <Route
                path="accounts-receivable"
                element={<AccountsReceivable />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["invoice.view"]}
                />
              }
            >
              <Route
                path="invoicing"
                element={<Invoicing />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["expense.view"]}
                />
              }
            >
              <Route
                path="expenses"
                element={<Expenses />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={[
                    "bankAccount.view",
                  ]}
                />
              }
            >
              <Route
                path="cash-bank"
                element={<CashBank />}
              />

              <Route
                path="bank-statements"
                element={<BankStatements />}
              />

              <Route
                path="bank-integration"
                element={<BankIntegration />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["mpesa.view"]}
                />
              }
            >
              <Route
                path="mpesa-integration"
                element={<MpesaIntegration />}
              />

              <Route
                path="mpesa-settings"
                element={<MpesaSettings />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={[
                    "portfolioCompany.view",
                  ]}
                />
              }
            >
              <Route
                path="portfolio-companies"
                element={<PortfolioCompanies />}
              />

              <Route
                path="portfolio-companies/:id"
                element={
                  <ViewPortfolioCompany />
                }
              />

              <Route
                path="edit-portfolio-company/:id"
                element={
                  <EditPortfolioCompany />
                }
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["vendor.view"]}
                />
              }
            >
              <Route
                path="vendors"
                element={<Vendors />}
              />
            </Route>

            {/* =================================================
                ADVANCED MODULES
            ================================================= */}

            <Route
              element={
                <RequirePermission
                  permissions={["employee.view"]}
                />
              }
            >
              <Route
                path="hr-management"
                element={<HRManagement />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["payroll.view"]}
                />
              }
            >
              <Route
                path="payroll"
                element={<Payroll />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={[
                    "procurement.view",
                  ]}
                />
              }
            >
              <Route
                path="procurement"
                element={<Procurement />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["asset.view"]}
                />
              }
            >
              <Route
                path="assets"
                element={<Assets />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={[
                    "assetAssignment.view",
                  ]}
                />
              }
            >
              <Route
                path="assets/assignments"
                element={<AssetAssignments />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["tax.view"]}
                />
              }
            >
              <Route
                path="tax-management"
                element={<TaxManagement />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["budget.view"]}
                />
              }
            >
              <Route
                path="budgeting"
                element={<BudgetForecasting />}
              />
            </Route>

            {/* =================================================
                INTELLIGENCE
            ================================================= */}

            <Route
              element={
                <RequirePermission
                  permissions={["reports.view"]}
                />
              }
            >
              <Route
                path="analytics"
                element={<AnalyticsInsights />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["fraud.view"]}
                />
              }
            >
              <Route
                path="fraud-detection"
                element={<FraudDetection />}
              />
            </Route>

            {/* =================================================
                WORKFLOW & CONTROL
            ================================================= */}

            <Route
              element={
                <RequirePermission
                  permissions={["approval.view"]}
                />
              }
            >
              <Route
                path="approvals"
                element={<Approvals />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={[
                    "reports.view",
                    "users.view",
                  ]}
                />
              }
            >
              <Route
                path="audit-trails"
                element={<AuditTrails />}
              />
            </Route>

            <Route
              element={
                <RequirePermission
                  permissions={["document.view"]}
                />
              }
            >
              <Route
                path="documents"
                element={<Documents />}
              />
            </Route>

            {/* =================================================
                SYSTEM / USER ACCESS
                PERMISSION CONTROLLED
            ================================================= */}

            <Route
              element={
                <RequirePermission
                  permissions={["users.view"]}
                />
              }
            >
              <Route
                path="user-access"
                element={<UsersAccess />}
              />
            </Route>

            {/* =================================================
                SYSTEM SETTINGS
                OWNER ONLY
            ================================================= */}

            <Route element={<RequireOwner />}>
              <Route
                path="settings"
                element={<Settings />}
              />
            </Route>

          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;