import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* =========================================================
   ROUTES
========================================================= */

/* Authentication, Users & Organizations */
import authRoutes from "./routes/auth.routes";
import protectedRoutes from "./routes/protected.routes";
import userRoutes from "./routes/user.routes";
import organizationRoutes from "./routes/organization.routes";
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
import invoiceRoutes from "./routes/invoice.routes";
import mpesaRoutes from "./routes/mpesa.routes";
import portfolioCompanyRoutes from "./routes/portfolioCompany.routes";
import investmentRoutes from "./routes/investment.routes";

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
   USER MANAGEMENT
========================================================= */

app.use(
  "/api/users",
  userRoutes
);

/* =========================================================
   ORGANIZATION / TENANT MANAGEMENT
========================================================= */

/*
 * Tenant-aware organization endpoints:
 *
 * GET  /api/organizations
 * GET  /api/organizations/current
 * POST /api/organizations/switch
 *
 * Organization access is determined from authenticated
 * user membership.
 *
 * Tenant isolation remains enforced by the authenticated
 * organization context.
 */
app.use(
  "/api/organizations",
  organizationRoutes
);

/* =========================================================
   ZIYA PLATFORM ADMINISTRATION
========================================================= */

/*
 * Platform-level administration is completely separate
 * from tenant-level administration.
 *
 * Tenant OWNER access does not grant platform access.
 *
 * PLATFORM_ADMIN is required by platform.routes.ts.
 *
 * POST /api/platform/organizations
 *
 * Provisions:
 * - Organization
 * - Initial organization OWNER
 * - OrganizationMember relationship
 */
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

/*
 * Accounting and operational reports:
 *
 * /api/financial-reports/receivables-aging
 * /api/financial-reports/payables-aging
 * /api/financial-reports/customer-balances
 * /api/financial-reports/vendor-payables
 */
app.use(
  "/api/financial-reports",
  financialReportRoutes
);

/*
 * Cash, bank and payment reports:
 *
 * /api/financial-reports/cash-position
 * /api/financial-reports/bank-summary
 * /api/financial-reports/bank-reconciliation
 * /api/financial-reports/mpesa
 */
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

app.use(
  "/api/bank-accounts",
  bankAccountRoutes
);

app.use(
  "/api/invoices",
  invoiceRoutes
);

app.use(
  "/api/mpesa",
  mpesaRoutes
);

/* =========================================================
   PORTFOLIO MANAGEMENT
========================================================= */

/*
 * Portfolio companies are NOT FOS tenants.
 *
 * Creating a PortfolioCompany does not create:
 * - an Organization
 * - an OrganizationMember
 * - login credentials
 *
 * These remain Ziya portfolio/investment records.
 */
app.use(
  "/api/portfolio-companies",
  portfolioCompanyRoutes
);

app.use(
  "/api/investments",
  investmentRoutes
);

/* =========================================================
   FRONTEND
========================================================= */

const frontendPath = path.join(
  __dirname,
  "../dist"
);

app.use(
  express.static(frontendPath)
);

/* =========================================================
   REACT ROUTER FALLBACK
========================================================= */

/*
 * Keep this AFTER every API route.
 *
 * Otherwise an API request that does not match correctly
 * could receive index.html instead of a JSON response.
 */
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