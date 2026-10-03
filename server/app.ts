import express from "express";
import cors, { type CorsOptions } from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* =========================================================
   ROUTES
========================================================= */

/* Authentication, Users, Roles & Organizations */
import authRoutes from "./routes/auth.routes";
import invitationRoutes from "./routes/invitation.routes";
import protectedRoutes from "./routes/protected.routes";
import userRoutes from "./routes/user.routes";
import roleRoutes from "./routes/role.routes";
import organizationRoutes from "./routes/organization.routes";
import settingsRoutes from "./routes/settings.routes";
import platformOrganizationRoutes from "./routes/platform.organization.routes";
import platformRoutes from "./routes/platform.routes";
import fosConfigurationTemplateRoutes from "./routes/fosConfigurationTemplate.routes";

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
import dashboardRoutes from "./routes/dashboard.routes";

/* HR & Payroll */
import employeeRoutes from "./routes/employee.routes";
import departmentRoutes from "./routes/department.routes";
import positionRoutes from "./routes/position.routes";
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

/* AI / Financial Intelligence */
import aiRoutes from "./routes/ai.routes";
import financialAssistantRoutes from "./routes/financialAssistant.routes";

/* =========================================================
   APP SETUP
========================================================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* =========================================================
   GLOBAL MIDDLEWARE
========================================================= */

const configuredCorsOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS ?? "").split(","),
  "https://ziyafos.com",
  "https://www.ziyafos.com",
]
  .map((origin) => origin?.trim())
  .filter(
    (origin): origin is string =>
      Boolean(origin)
  );

const allowedCorsOrigins =
  new Set(
    configuredCorsOrigins
  );

const corsOptions: CorsOptions = {
  origin: (
    origin,
    callback
  ) => {
    /*
     * Allow non-browser/server-to-server requests
     * that do not send an Origin header.
     */
    if (!origin) {
      callback(null, true);
      return;
    }

    if (
      allowedCorsOrigins.has(
        origin
      )
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        `CORS origin not allowed: ${origin}`
      )
    );
  },

  credentials: true,

  methods: [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Range",
  ],

  optionsSuccessStatus: 204,
};

app.use(
  cors(corsOptions)
);

app.options(
  /.*/,
  cors(corsOptions)
);

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
   PUBLIC TENANT INVITATIONS
========================================================= */

app.use(
  "/api/invitations",
  invitationRoutes
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

  app.use(
    "/api/platform/fos-configuration-template",
    fosConfigurationTemplateRoutes
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
========================================================= */

/*
 * Tenant-scoped procurement workflow.
 *
 * Routes:
 *
 * GET    /api/procurement
 * GET    /api/procurement/:id
 * POST   /api/procurement
 * PUT    /api/procurement/:id
 * PATCH  /api/procurement/:id/status
 *
 * Authentication and tenant permission enforcement
 * are handled inside procurement.routes.ts.
 */

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
   DASHBOARD
========================================================= */

/*
 * Tenant-scoped dashboard endpoints.
 *
 * GET /api/dashboard/recent-transactions?limit=5
 *
 * Authentication and permission enforcement are handled
 * inside dashboard.routes.ts.
 */

app.use(
  "/api/dashboard",
  dashboardRoutes
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
 * Authentication and permission checks are handled
 * inside transaction.routes.ts.
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

/*
 * Department management endpoints.
 *
 * GET    /api/departments
 * GET    /api/departments/:id
 * POST   /api/departments
 * PATCH  /api/departments/:id
 * DELETE /api/departments/:id
 *
 * Authentication and organization isolation are handled
 * inside department.routes.ts / department.controller.ts.
 */

app.use(
  "/api/departments",
  departmentRoutes
);

/*
 * Position management endpoints.
 *
 * GET    /api/positions
 * GET    /api/positions/:id
 * POST   /api/positions
 * PATCH  /api/positions/:id
 * DELETE /api/positions/:id
 *
 * Authentication and organization isolation are handled
 * inside position.routes.ts / position.controller.ts.
 */

app.use(
  "/api/positions",
  positionRoutes
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
   AI / FINANCIAL INTELLIGENCE
========================================================= */

/*
 * Tenant-scoped AI financial intelligence.
 *
 * Routes:
 *
 * GET /api/ai/data-readiness
 * GET /api/ai/forecast
 * GET /api/ai/forecast/completed
 * GET /api/ai/config
 *
 * Authentication and tenant permission enforcement are
 * handled inside ai.routes.ts.
 *
 * IMPORTANT:
 *
 * The AI controller obtains organizationId from the
 * authenticated tenant session. The frontend cannot select
 * another organization by supplying organizationId.
 *
 * Therefore:
 *
 * Authenticated Tenant
 *        ↓
 * AI Routes
 *        ↓
 * AI Controller
 *        ↓
 * req.user.organizationId
 *        ↓
 * Forecasting Service
 *        ↓
 * Financial Data Service
 *        ↓
 * Tenant Accounting Data
 */

app.use(
  "/api/ai",
  aiRoutes
);

/* =========================================================
   AI FINANCIAL ASSISTANT
========================================================= */

/*
 * Production Financial Assistant.
 *
 * Routes:
 *
 * GET  /api/financial-assistant/overview
 * POST /api/financial-assistant/chat
 *
 * Authentication and company permission enforcement are
 * handled inside financialAssistant.routes.ts.
 *
 * The Financial Assistant controller resolves the company
 * context from the authenticated session. The frontend
 * cannot select another organization by supplying an
 * organizationId.
 *
 * The assistant is read-only and must never mutate
 * accounting, tax, banking, invoicing, procurement,
 * payroll, asset, or company configuration data.
 */

app.use(
  "/api/financial-assistant",
  financialAssistantRoutes
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
 * in Railway deployment logs.
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
