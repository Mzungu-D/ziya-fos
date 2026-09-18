import express from "express";

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
   MIDDLEWARE
========================================================= */

import { getAccountingIntegrity } from "../controllers/accountingIntegrity.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * FINANCIAL REPORT SECURITY
 * =========================================================
 *
 * All financial reports are read-only.
 *
 * Required permission:
 * reports.view
 *
 * OWNER automatically has access inside their organization.
 * =========================================================
 */

router.use(authenticate);
router.use(requirePermission("reports.view"));

/* =========================================================
   RECEIVABLES & PAYABLES REPORTS
========================================================= */

router.get(
  "/receivables-aging",
  getReceivablesAging
);

router.get(
  "/payables-aging",
  getPayablesAging
);

router.get(
  "/customer-balances",
  getCustomerBalances
);

router.get(
  "/vendor-payables",
  getVendorPayables
);

/* =========================================================
   LOAN & PORTFOLIO REPORTS
========================================================= */

router.get(
  "/loan-portfolio",
  getLoanPortfolio
);

router.get(
  "/outstanding-loans",
  getOutstandingLoans
);

router.get(
  "/portfolio-performance",
  getPortfolioPerformance
);

/* =========================================================
   CASH, BANK & M-PESA REPORTS
========================================================= */

router.get(
  "/cash-position",
  getCashPosition
);

router.get(
  "/bank-summary",
  getBankSummary
);

router.get(
  "/bank-reconciliation",
  getBankReconciliation
);

router.get(
  "/mpesa",
  getMpesaReport
);

/* =========================================================
   REVENUE & EXPENSE ANALYSIS
========================================================= */

router.get(
  "/revenue-analysis",
  getRevenueAnalysis
);

router.get(
  "/expense-analysis",
  getExpenseAnalysis
);

/* =========================================================
   BUDGET REPORTS
========================================================= */

router.get(
  "/budget-vs-actual",
  getBudgetVsActual
);

router.get(
  "/budget-variance",
  getBudgetVariance
);

/* =========================================================
   FINANCIAL PERFORMANCE
========================================================= */

router.get(
  "/financial-kpis",
  getFinancialKpis
);

router.get(
  "/financial-ratios",
  getFinancialRatios
);

router.get(
  "/monthly-performance",
  getMonthlyPerformance
);

/* =========================================================
   EQUITY REPORTING
========================================================= */

router.get(
  "/changes-in-equity",
  getChangesInEquity
);

/* =========================================================
   ACCOUNTING INTEGRITY
========================================================= */

router.get(
  "/accounting-integrity",
  getAccountingIntegrity
);

/* =========================================================
   LEDGER & JOURNAL REPORTS
========================================================= */

router.get(
  "/general-ledger",
  getGeneralLedgerReport
);

router.get(
  "/journal-report",
  getJournalReport
);

/* =========================================================
   AUDIT REPORT
========================================================= */

router.get(
  "/audit-trail",
  getAuditTrailReport
);

/* =========================================================
   CUSTOM REPORT
========================================================= */

router.get(
  "/custom",
  getCustomReport
);

export default router;

