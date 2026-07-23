import express from "express";

/* =========================================================
   CONTROLLERS
========================================================= */

/* Receivables & Payables Reports */
import {
  getCustomerBalances,
  getPayablesAging,
  getReceivablesAging,
  getVendorPayables,
} from "../controllers/financialReport.controller";

/* Performance, Budget & Equity Reports */
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

/* Loan & Portfolio Reports */
import {
  getLoanPortfolio,
  getOutstandingLoans,
  getPortfolioPerformance,
} from "../controllers/loanReports.controller";

/* Cash, Bank & M-Pesa Reports */
import {
  getBankReconciliation,
  getBankSummary,
  getCashPosition,
  getMpesaReport,
} from "../controllers/cashBankReports.controller";

/* Ledger, Journal, Audit & Custom Reports */
import {
  getAuditTrailReport,
  getCustomReport,
  getGeneralLedgerReport,
  getJournalReport,
} from "../controllers/controlReports.controller";

/* =========================================================
   MIDDLEWARE
========================================================= */

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

/* =========================================================
   ROUTER
========================================================= */

const router = express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(authenticate);
router.use(authorize("SUPER_ADMIN"));

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
   FINANCIAL PERFORMANCE & RATIOS
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
   AUDIT & CONTROL REPORTS
========================================================= */

router.get(
  "/audit-trail",
  getAuditTrailReport
);

/* =========================================================
   CUSTOM REPORTING
========================================================= */

router.get(
  "/custom",
  getCustomReport
);

/* =========================================================
   EXPORT
========================================================= */

export default router;