import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

/* =========================================================
   RECEIVABLES & PAYABLES
========================================================= */

import {
  getCustomerBalances,
  getPayablesAging,
  getReceivablesAging,
  getVendorPayables,
} from "../controllers/financialReport.controller";

/* =========================================================
   PERFORMANCE, BUDGET & EQUITY
========================================================= */

import {
  getBudgetVariance,
  getBudgetVsActual,
  getChangesInEquity,
  getExpenseAnalysis,
  getFinancialKpis,
  getFinancialRatios,
  getMonthlyPerformance,
  getRevenueAnalysis,
} from "../controllers/performanceReports.controller";

/* =========================================================
   LOANS & PORTFOLIO
========================================================= */

import {
  getLoanPortfolio,
  getOutstandingLoans,
  getPortfolioPerformance,
} from "../controllers/loanReports.controller";

/* =========================================================
   CASH, BANK & M-PESA
========================================================= */

import {
  getBankReconciliation,
  getBankSummary,
  getCashPosition,
  getMpesaReport,
} from "../controllers/cashBankReports.controller";

/* =========================================================
   LEDGER, JOURNAL, AUDIT & CUSTOM
========================================================= */

import {
  getAuditTrailReport,
  getCustomReport,
  getGeneralLedgerReport,
  getJournalReport,
} from "../controllers/controlReports.controller";

/* =========================================================
   ACCOUNTING INTEGRITY
========================================================= */

import { getAccountingIntegrity } from "../controllers/accountingIntegrity.controller";

/* =========================================================
   MIDDLEWARE
========================================================= */

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * FINANCIAL REPORT ROUTES
 * =========================================================
 *
 * Security:
 *
 * - Every report requires authentication.
 * - Every report requires reports.view.
 * - Tenant identity comes from the authenticated request.
 * - No route accepts organizationId as a tenant selector.
 * - Controllers/services must apply organization scoping to every
 *   database query.
 *
 * Reporting rules:
 *
 * - Reports are read-only.
 * - Reports must not create, update or delete accounting records.
 * - Posted accounting data is the reporting source of truth.
 * - Report calculations belong to the controller/service layer.
 * - Date, currency, pagination and filtering validation belongs to
 *   the controller/service layer.
 *
 * The router intentionally does not duplicate accounting logic.
 */

/**
 * =========================================================
 * REPORT PARAMETER VALIDATION
 * =========================================================
 *
 * Report routes are intentionally parameterless at the path level.
 * Query-string validation remains with the individual report
 * controllers because different reports have different filters.
 *
 * This middleware rejects organizationId supplied as a query
 * parameter. Tenant selection must never be client-controlled.
 */
function rejectTenantOverride(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    Object.prototype.hasOwnProperty.call(
      req.query,
      "organizationId",
    ) ||
    Object.prototype.hasOwnProperty.call(
      req.query,
      "organizationID",
    ) ||
    Object.prototype.hasOwnProperty.call(
      req.query,
      "orgId",
    )
  ) {
    res.status(400).json({
      success: false,
      message:
        "Organization selection is not accepted through report query parameters.",
    });
    return;
  }

  next();
}

/**
 * =========================================================
 * GLOBAL REPORT SECURITY
 * =========================================================
 *
 * All routes below are protected by both authentication and
 * reports.view authorization.
 *
 * OWNER/full-access handling is performed by the permission
 * middleware within the authenticated organization.
 */
router.use(authenticate);
router.use(requirePermission("reports.view"));
router.use(rejectTenantOverride);

/* =========================================================
   RECEIVABLES & PAYABLES REPORTS
========================================================= */

router.get(
  "/receivables-aging",
  getReceivablesAging,
);

router.get(
  "/payables-aging",
  getPayablesAging,
);

router.get(
  "/customer-balances",
  getCustomerBalances,
);

router.get(
  "/vendor-payables",
  getVendorPayables,
);

/* =========================================================
   LOAN & PORTFOLIO REPORTS
========================================================= */

router.get(
  "/loan-portfolio",
  getLoanPortfolio,
);

router.get(
  "/outstanding-loans",
  getOutstandingLoans,
);

router.get(
  "/portfolio-performance",
  getPortfolioPerformance,
);

/* =========================================================
   CASH, BANK & M-PESA REPORTS
========================================================= */

router.get(
  "/cash-position",
  getCashPosition,
);

router.get(
  "/bank-summary",
  getBankSummary,
);

router.get(
  "/bank-reconciliation",
  getBankReconciliation,
);

router.get(
  "/mpesa",
  getMpesaReport,
);

/* =========================================================
   REVENUE & EXPENSE ANALYSIS
========================================================= */

router.get(
  "/revenue-analysis",
  getRevenueAnalysis,
);

router.get(
  "/expense-analysis",
  getExpenseAnalysis,
);

/* =========================================================
   BUDGET REPORTS
========================================================= */

router.get(
  "/budget-vs-actual",
  getBudgetVsActual,
);

router.get(
  "/budget-variance",
  getBudgetVariance,
);

/* =========================================================
   FINANCIAL PERFORMANCE
========================================================= */

router.get(
  "/financial-kpis",
  getFinancialKpis,
);

router.get(
  "/financial-ratios",
  getFinancialRatios,
);

router.get(
  "/monthly-performance",
  getMonthlyPerformance,
);

/* =========================================================
   EQUITY REPORTING
========================================================= */

router.get(
  "/changes-in-equity",
  getChangesInEquity,
);

/* =========================================================
   ACCOUNTING INTEGRITY
========================================================= */

router.get(
  "/accounting-integrity",
  getAccountingIntegrity,
);

/* =========================================================
   LEDGER & JOURNAL REPORTS
========================================================= */

router.get(
  "/general-ledger",
  getGeneralLedgerReport,
);

router.get(
  "/journal-report",
  getJournalReport,
);

/* =========================================================
   AUDIT REPORT
========================================================= */

router.get(
  "/audit-trail",
  getAuditTrailReport,
);

/* =========================================================
   CUSTOM REPORT
========================================================= */

router.get(
  "/custom",
  getCustomReport,
);

export default router;
