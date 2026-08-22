import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* =========================================================
   ROUTES
========================================================= */

/* Authentication, Users, Roles & Organizations */
import authRoutes from "./routes/auth.routes";
import protectedRoutes from "./routes/protected.routes";
import userRoutes from "./routes/user.routes";
import roleRoutes from "./routes/role.routes";
import organizationRoutes from "./routes/organization.routes";
import settingsRoutes from "./routes/settings.routes";
import platformOrganizationRoutes from "./routes/platform.organization.routes";
import platformRoutes from "./routes/platform.routes";

/* Core Financial Engine */
import accountRoutes from "./routes/account.routes";
import journalRoutes from "./routes/journal.routes";
import ledgerRoutes from "./routes/ledger.routes";
import trialBalanceRoutes from "./routes/trialbalance.routes";
import incomeStatementRoutes from "./routes/incomeStatement.routes";
import balanceSheetRoutes from "./routes/balanceSheet.routes";
import cashFlowRoutes from "./routes/cashFlow.routes";

/* Financial Reporting */
import financialReportRoutes from "./routes/financialReport.routes";
import cashReportsRoutes from "./routes/cashReports.routes";

/* Business Operations */
import accountsReceivableRoutes from "./routes/accountsReceivable.routes";
import accountsPayableRoutes from "./routes/accountsPayable.routes";
import vendorRoutes from "./routes/vendor.routes";
import expenseRoutes from "./routes/expense.routes";
import documentRoutes from "./routes/document.routes";
import bankAccountRoutes from "./routes/bankAccount.routes";
import bankBalanceRoutes from "./routes/bankBalance.routes";
import invoiceRoutes from "./routes/invoice.routes";
import mpesaRoutes from "./routes/mpesa.routes";
import portfolioCompanyRoutes from "./routes/portfolioCompany.routes";
import investmentRoutes from "./routes/investment.routes";
import bankPaymentRoutes from "./routes/bankPayment.routes";
import procurementRoutes from "./routes/procurement.routes";

/* Dashboard / Transactions */
import transactionRoutes from "./routes/transaction.routes";

/* HR & Payroll */
import employeeRoutes from "./routes/employee.routes";
import payrollRoutes from "./routes/payroll.routes";

/* Assets */
import assetRoutes from "./routes/asset.routes";
import assetAssignmentRoutes from "./routes/assetAssignment.routes";

/* Tax Management */
import taxRoutes from "./routes/tax.routes";

/* Budget Management */
import budgetRoutes from "./routes/budget.routes";

/* Approvals */
import approvalRoutes from "./routes/approval.routes";

/* Fraud Detection */
import fraudDetectionRoutes from "./routes/fraudDetection.routes";

/* =========================================================
   APP SETUP
========================================================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* =========================================================
   GLOBAL MIDDLEWARE
========================================================= */

app.use(cors());

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/* =========================================================
   AUTHENTICATION
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   PROTECTED BASE ROUTES
========================================================= */

app.use(
  "/api",
  protectedRoutes
);

/* =========================================================
   TENANT USER MANAGEMENT
========================================================= */

app.use(
  "/api/users",
  userRoutes
);

/* =========================================================
   TENANT ROLE MANAGEMENT
========================================================= */

app.use(
  "/api/roles",
  roleRoutes
);

/* =========================================================
   TENANT SETTINGS
========================================================= */

/*
 * Tenant-only Settings.
 *
 * This is intentionally separate from the platform
 * administration routes below.
 *
 * Endpoints:
 *
 * GET    /api/settings
 * PATCH  /api/settings/profile
 * GET    /api/settings/sessions
 * DELETE /api/settings/sessions/:sessionId
 *
 * Authentication and tenant isolation are handled
 * inside settings.routes.ts / settings.controller.ts.
 */

app.use(
  "/api/settings",
  settingsRoutes
);

/* =========================================================
   ORGANIZATION / TENANT MANAGEMENT
========================================================= */

app.use(
  "/api/organizations",
  organizationRoutes
);

/* =========================================================
   ZIYA PLATFORM ADMINISTRATION
========================================================= */

/*
 * Platform organization routes are mounted BEFORE the
 * generic platform router so /api/platform/organizations
 * is matched first.
 *
 * GET    /api/platform/organizations
 * GET    /api/platform/organizations/:id
 * POST   /api/platform/organizations
 * PATCH  /api/platform/organizations/:id
 * DELETE /api/platform/organizations/:id
 * PATCH  /api/platform/organizations/:id/approve
 * PATCH  /api/platform/organizations/:id/suspend
 * PATCH  /api/platform/organizations/:id/activate
 */

app.use(
  "/api/platform/organizations",
  platformOrganizationRoutes
);

app.use(
  "/api/platform",
  platformRoutes
);

/* =========================================================
   CORE FINANCIAL ENGINE
========================================================= */

app.use(
  "/api/accounts",
  accountRoutes
);

app.use(
  "/api/journals",
  journalRoutes
);

app.use(
  "/api/ledger",
  ledgerRoutes
);

app.use(
  "/api/trial-balance",
  trialBalanceRoutes
);

app.use(
  "/api/income-statement",
  incomeStatementRoutes
);

app.use(
  "/api/balance-sheet",
  balanceSheetRoutes
);

app.use(
  "/api/cash-flow",
  cashFlowRoutes
);

/* =========================================================
   FINANCIAL REPORTING ENGINE
========================================================= */

app.use(
  "/api/financial-reports",
  financialReportRoutes
);

app.use(
  "/api/financial-reports",
  cashReportsRoutes
);

/* =========================================================
   BUSINESS OPERATIONS
========================================================= */

app.use(
  "/api/accounts-receivable",
  accountsReceivableRoutes
);

app.use(
  "/api/accounts-payable",
  accountsPayableRoutes
);

app.use(
  "/api/vendors",
  vendorRoutes
);

app.use(
  "/api/expenses",
  expenseRoutes
);

/* =========================================================
   PROCUREMENT

   Tenant-scoped procurement workflow.

   Routes:
   GET    /api/procurement
   GET    /api/procurement/:id
   POST   /api/procurement
   PUT    /api/procurement/:id
   PATCH  /api/procurement/:id/status

   Authentication and tenant permission
   enforcement are handled inside
   procurement.routes.ts.
========================================================= */

app.use(
  "/api/procurement",
  procurementRoutes
);

/* =========================================================
   DOCUMENT MANAGEMENT
========================================================= */

app.use(
  "/api/documents",
  documentRoutes
);

/* =========================================================
   BANK ACCOUNTS
========================================================= */

app.use(
  "/api/bank-accounts",
  bankAccountRoutes
);

/* =========================================================
   BANK BALANCE SYNCHRONIZATION
========================================================= */

app.use(
  "/api/bank-balances",
  bankBalanceRoutes
);

/* =========================================================
   BANK PAYMENTS
========================================================= */

app.use(
  "/api/bank-payments",
  bankPaymentRoutes
);

/* =========================================================
   INVOICES
========================================================= */

app.use(
  "/api/invoices",
  invoiceRoutes
);

/* =========================================================
   M-PESA
========================================================= */

app.use(
  "/api/mpesa",
  mpesaRoutes
);

/* =========================================================
   PORTFOLIO MANAGEMENT
========================================================= */

app.use(
  "/api/portfolio-companies",
  portfolioCompanyRoutes
);

app.use(
  "/api/investments",
  investmentRoutes
);

/* =========================================================
   DASHBOARD TRANSACTIONS
========================================================= */

/*
 * Returns recent transactions belonging only to the
 * authenticated user's organization.
 *
 * GET /api/transactions
 * GET /api/transactions?limit=5
 *
 * Authentication and permission checks are handled inside
 * transaction.routes.ts.
 */

app.use(
  "/api/transactions",
  transactionRoutes
);

/* =========================================================
   HR MANAGEMENT
========================================================= */

/*
 * Employee management endpoints.
 *
 * GET    /api/employees
 * GET    /api/employees/:id
 * POST   /api/employees
 * PATCH  /api/employees/:id
 * DELETE /api/employees/:id
 *
 * Authentication and organization isolation are handled
 * inside employee.routes.ts / employee.controller.ts.
 */

app.use(
  "/api/employees",
  employeeRoutes
);

/* =========================================================
   PAYROLL
========================================================= */

/*
 * Payroll processing endpoints.
 *
 * Authentication and organization isolation are handled
 * inside payroll.routes.ts / payroll.controller.ts.
 */

app.use(
  "/api/payroll",
  payrollRoutes
);

/* =========================================================
   TAX MANAGEMENT
========================================================= */

/*
 * Tax obligations, filings and payments.
 *
 * Authentication and organization isolation are handled
 * inside tax.routes.ts / tax.controller.ts.
 */

app.use(
  "/api/tax",
  taxRoutes
);

/* =========================================================
   BUDGET MANAGEMENT
========================================================= */

/*
 * Budget creation, retrieval, updating and deletion.
 *
 * Authentication and organization isolation are handled
 * inside budget.routes.ts / budget.controller.ts.
 */

app.use(
  "/api/budgets",
  budgetRoutes
);

/* =========================================================
   APPROVALS
========================================================= */

app.use(
  "/api/approvals",
  approvalRoutes
);

/* =========================================================
   ASSETS
========================================================= */

/*
 * Fixed asset management endpoints.
 *
 * GET    /api/assets
 * GET    /api/assets/:id
 * POST   /api/assets
 * PATCH  /api/assets/:id
 * DELETE /api/assets/:id
 *
 * Authentication and organization isolation are handled
 * inside asset.routes.ts / asset.controller.ts.
 */

app.use(
  "/api/assets",
  assetRoutes
);

/* =========================================================
   ASSET ASSIGNMENTS
========================================================= */

/*
 * Employee asset assignment endpoints.
 *
 * GET    /api/asset-assignments/assets/:assetId/current
 * GET    /api/asset-assignments/assets/:assetId/history
 * POST   /api/asset-assignments/assets/:assetId/assign
 * POST   /api/asset-assignments/assets/:assetId/return
 * POST   /api/asset-assignments/assets/:assetId/reassign
 * GET    /api/asset-assignments/employees/:employeeId/assets
 *
 * Authentication and organization isolation are handled
 * inside assetAssignment.routes.ts /
 * assetAssignment.controller.ts.
 */

app.use(
  "/api/asset-assignments",
  assetAssignmentRoutes
);

/* =========================================================
   FRAUD DETECTION
========================================================= */

app.use(
  "/api/fraud-detection",
  fraudDetectionRoutes
);

/* =========================================================
   FRONTEND
========================================================= */

const frontendPath =
  path.join(
    __dirname,
    "../dist"
  );

app.use(
  express.static(
    frontendPath
  )
);

/* =========================================================
   REACT ROUTER FALLBACK
   Keep this AFTER every API route.
========================================================= */

/*
 * Express 5 requires a named wildcard parameter.
 *
 * DO NOT change this back to:
 *
 * app.get("/(.*)", ...)
 *
 * That pattern causes the path-to-regexp crash seen
 * in the Railway deployment logs.
 */

app.get(
  "/{*splat}",
  (_req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default app;