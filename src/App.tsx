import { BrowserRouter, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import OtpForm from "./pages/OtpForm";

import Dashboard from "./components/dashboard/Dashboard";
import DashboardLayout from "./components/layout/DashboardLayout";

/* Core Financial */
import ChartOfAccounts from "./pages/ChartOfAccounts";
import FinancialReports from "./pages/FinancialReports";
import GeneralLedger from "./pages/GeneralLedger";
import JournalEntries from "./pages/JournalEntries";
import TrialBalance from "./pages/TrialBalance";

/* Business Operations */
import AccountsPayable from "./pages/AccountsPayable";
import AccountsReceivable from "./pages/AccountsReceivable";
import BankIntegration from "./pages/BankIntegration";
import CashBank from "./pages/CashBank";
import Expenses from "./pages/Expenses";
import Invoicing from "./pages/Invoicing";
import MpesaIntegration from "./pages/MpesaIntegration";
import PortfolioCompanies from "./pages/PortfolioCompanies";
import Vendors from "./pages/Vendors";

/* Advanced Modules */
import Assets from "./pages/Assets";
import BudgetForecasting from "./pages/BudgetForecasting";
import HRManagement from "./pages/HRManagement";
import Payroll from "./pages/Payroll";
import Procurement from "./pages/Procurement";
import TaxManagement from "./pages/TaxManagement";

/* Intelligence */
import AnalyticsInsights from "./pages/AnalyticsInsights";
import FraudDetection from "./pages/FraudDetection";

/* Workflow & Control */
import Approvals from "./pages/Approvals";
import AuditTrails from "./pages/AuditTrails";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Authentication */}
        <Route path="/" element={<Login />} />
        <Route path="/otp" element={<OtpForm />} />

        {/* Dashboard Layout */}
        <Route path="/dashboard" element={<DashboardLayout />}>

          {/* Dashboard Home */}
          <Route index element={<Dashboard />} />

          {/* Core Financial */}
          <Route path="general-ledger" element={<GeneralLedger />} />
          <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="journal-entries" element={<JournalEntries />} />
          <Route path="trial-balance" element={<TrialBalance />} />
          <Route path="financial-reports" element={<FinancialReports />} />

          {/* Business Operations */}
          <Route path="accounts-payable" element={<AccountsPayable />} />
          <Route path="accounts-receivable" element={<AccountsReceivable />} />
          <Route path="invoicing" element={<Invoicing />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="cash-bank" element={<CashBank />} />
          <Route path="bank-integration" element={<BankIntegration />} />
          <Route path="mpesa-integration" element={<MpesaIntegration />} />
          <Route path="portfolio-companies" element={<PortfolioCompanies />} />
          <Route path="vendors" element={<Vendors />} />

          {/* Advanced Modules */}
          <Route path="hr-management" element={<HRManagement />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="procurement" element={<Procurement />} />
          <Route path="assets" element={<Assets />} />
          <Route path="tax-management" element={<TaxManagement />} />
          <Route path="budgeting" element={<BudgetForecasting />} />

          {/* Intelligence */}
          <Route path="analytics" element={<AnalyticsInsights />} />
          <Route path="fraud-detection" element={<FraudDetection />} />

          {/* Workflow & Control */}
          <Route path="approvals" element={<Approvals />} />
          <Route path="audit-trails" element={<AuditTrails />} />
          <Route path="documents" element={<Documents />} />
          <Route path="settings" element={<Settings />} />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;