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
import bankAccountRoutes from "./routes/bankAccount.routes";
import bankBalanceRoutes from "./routes/bankBalance.routes";
import invoiceRoutes from "./routes/invoice.routes";
import mpesaRoutes from "./routes/mpesa.routes";
import portfolioCompanyRoutes from "./routes/portfolioCompany.routes";
import investmentRoutes from "./routes/investment.routes";
import bankPaymentRoutes from "./routes/bankPayment.routes";

/* Dashboard / Transactions */
import transactionRoutes from "./routes/transaction.routes";

/* HR & Payroll */
import employeeRoutes from "./routes/employee.routes";
import payrollRoutes from "./routes/payroll.routes";

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

app.get(
  /(.*)/,
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