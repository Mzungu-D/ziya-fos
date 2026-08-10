import {
  BrowserRouter,
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
import RequireSession from "./components/auth/RequireSession";

/* ===========================
   PLATFORM ADMINISTRATION
=========================== */

import PlatformLayout              from "./platform/PlatformLayout";
import PlatformDashboard           from "./platform/PlatformDashboard";

import Organizations               from "./platform/pages/Organizations";
import PlatformOrganizationDetails from "./platform/pages/PlatformOrganizationDetails";
import PlatformOrganizationWorkspace from "./platform/pages/PlatformOrganizationWorkspace";
import PlatformUsers               from "./platform/pages/PlatformUsers";
import PlatformSettings            from "./platform/pages/PlatformSettings";
import SecurityCenter              from "./platform/pages/SecurityCenter";
import AuditLogs                   from "./platform/pages/AuditLogs";
import SystemHealth                from "./platform/pages/SystemHealth";
import Integrations                from "./platform/pages/Integrations";
import Billing                     from "./platform/pages/Billing";
import AIControlCenter             from "./platform/pages/AIControlCenter";
import Reports                     from "./platform/pages/Reports";
import Subscriptions               from "./platform/pages/Subscriptions";
import Licensing                   from "./platform/pages/Licensing";
import Support                     from "./platform/pages/Support";
import PlatformAdminProfile        from "./platform/pages/PlatformAdminProfile";

/* Existing Dashboard */
import Dashboard       from "./components/dashboard/Dashboard";
import DashboardLayout from "./components/layout/DashboardLayout";

/* Core Financial */
import ChartOfAccounts  from "./pages/ChartOfAccounts";
import FinancialReports from "./pages/FinancialReports";
import ReportViewer     from "./pages/ReportViewer";
import GeneralLedger    from "./pages/GeneralLedger";
import JournalEntries   from "./pages/JournalEntries";
import TrialBalance     from "./pages/TrialBalance";

/* Business Operations */
import AccountsPayable      from "./pages/AccountsPayable";
import AccountsReceivable   from "./pages/AccountsReceivable";
import BankIntegration      from "./pages/BankIntegration";
import CashBank             from "./pages/CashBank";
import Expenses             from "./pages/Expenses";
import Invoicing            from "./pages/Invoicing";
import MpesaIntegration     from "./pages/MpesaIntegration";
import PortfolioCompanies   from "./pages/PortfolioCompanies";
import ViewPortfolioCompany from "./pages/ViewPortfolioCompany";
import EditPortfolioCompany from "./pages/EditPortfolioCompany";
import Vendors              from "./pages/Vendors";

/* Advanced Modules */
import Assets            from "./pages/Assets";
import BudgetForecasting from "./pages/BudgetForecasting";
import HRManagement      from "./pages/HRManagement";
import Payroll           from "./pages/Payroll";
import Procurement       from "./pages/Procurement";
import TaxManagement     from "./pages/TaxManagement";

/* Intelligence */
import AnalyticsInsights from "./pages/AnalyticsInsights";
import FraudDetection    from "./pages/FraudDetection";

/* Workflow & Control */
import Approvals   from "./pages/Approvals";
import AuditTrails from "./pages/AuditTrails";
import Documents   from "./pages/Documents";
import Settings    from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ==========================================
            PUBLIC ZIYA FOS OUTER LAYER
        ========================================== */}

        <Route element={<PublicLayout />}>
          <Route path="/"             element={<Home />}        />
          <Route path="/products"     element={<Products />}    />
          <Route path="/solutions"    element={<Solutions />}   />
          <Route path="/about"        element={<About />}       />
          <Route path="/open-account" element={<OpenAccount />} />
        </Route>

        {/* ==========================================
            AUTHENTICATION
        ========================================== */}

        <Route path="/login"    element={<Login />}    />
        <Route path="/otp"      element={<OtpForm />}  />
        <Route path="/register" element={<Register />} />

        {/* ==========================================
            PLATFORM ADMINISTRATION
        ========================================== */}

        <Route element={<RequireSession sessionType="PLATFORM" />}>
          <Route path="/platform" element={<PlatformLayout />}>

            <Route index element={<PlatformDashboard />} />

            <Route path="organizations"     element={<Organizations />}                 />
            <Route path="organizations/:id" element={<PlatformOrganizationDetails />}   />
            <Route path="workspace/:id"     element={<PlatformOrganizationWorkspace />} />

            <Route path="users"         element={<PlatformUsers />}        />
            <Route path="settings"      element={<PlatformSettings />}     />
            <Route path="security"      element={<SecurityCenter />}       />
            <Route path="audit-logs"    element={<AuditLogs />}            />
            <Route path="system-health" element={<SystemHealth />}         />
            <Route path="integrations"  element={<Integrations />}         />
            <Route path="subscriptions" element={<Subscriptions />}        />
            <Route path="licensing"     element={<Licensing />}            />
            <Route path="billing"       element={<Billing />}              />
            <Route path="reports"       element={<Reports />}              />
            <Route path="ai-control"    element={<AIControlCenter />}      />
            <Route path="support"       element={<Support />}              />
            <Route path="profile"       element={<PlatformAdminProfile />} />

          </Route>
        </Route>

        {/* ==========================================
            TENANT DASHBOARD
        ========================================== */}

        <Route element={<RequireSession sessionType="TENANT" />}>
          <Route path="/dashboard" element={<DashboardLayout />}>

            <Route index element={<Dashboard />} />

            {/* Core Financial */}
            <Route path="chart-of-accounts"  element={<ChartOfAccounts />}  />
            <Route path="general-ledger"     element={<GeneralLedger />}    />
            <Route path="journal-entries"    element={<JournalEntries />}   />
            <Route path="trial-balance"      element={<TrialBalance />}     />
            <Route path="financial-reports"  element={<FinancialReports />} />
            <Route path="financial-reports/:reportType" element={<ReportViewer />} />

            {/* Business Operations */}
            <Route path="accounts-payable"    element={<AccountsPayable />}    />
            <Route path="accounts-receivable" element={<AccountsReceivable />} />
            <Route path="invoicing"           element={<Invoicing />}          />
            <Route path="expenses"            element={<Expenses />}           />
            <Route path="cash-bank"           element={<CashBank />}           />
            <Route path="bank-integration"    element={<BankIntegration />}    />
            <Route path="mpesa-integration"   element={<MpesaIntegration />}   />
            <Route path="portfolio-companies"         element={<PortfolioCompanies />}   />
            <Route path="portfolio-companies/:id"     element={<ViewPortfolioCompany />} />
            <Route path="edit-portfolio-company/:id"  element={<EditPortfolioCompany />} />
            <Route path="vendors" element={<Vendors />} />

            {/* Advanced Modules */}
            <Route path="hr-management"  element={<HRManagement />}     />
            <Route path="payroll"        element={<Payroll />}          />
            <Route path="procurement"    element={<Procurement />}      />
            <Route path="assets"         element={<Assets />}           />
            <Route path="tax-management" element={<TaxManagement />}    />
            <Route path="budgeting"      element={<BudgetForecasting />} />

            {/* Intelligence */}
            <Route path="analytics"       element={<AnalyticsInsights />} />
            <Route path="fraud-detection" element={<FraudDetection />}   />

            {/* Workflow & Control */}
            <Route path="approvals"    element={<Approvals />}   />
            <Route path="audit-trails" element={<AuditTrails />} />
            <Route path="documents"    element={<Documents />}   />
            <Route path="settings"     element={<Settings />}    />

          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;