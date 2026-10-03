import express from "express";

import {
  chatWithFinancialAssistant,
  getFinancialAssistantOverview,
} from "../controllers/financialAssistant.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * FINANCIAL ASSISTANT ROUTES
 * =========================================================
 *
 * Security model:
 *
 * 1. authenticate
 *    - Establishes the authenticated user session.
 *    - Resolves the current company context.
 *    - Resolves the user's effective permissions.
 *
 * 2. requirePermission("reports.view")
 *    - Enforces the existing FOS RBAC system.
 *    - OWNER receives the existing owner-level access.
 *    - Other users require reports.view.
 *
 * 3. Financial Assistant controller
 *    - Uses the authenticated company context.
 *    - Does not accept organizationId from the browser.
 *    - Reads only accounting information belonging to the
 *      authenticated company.
 *
 * IMPORTANT:
 * Company isolation is enforced by the authenticated
 * organization context and the controller's database
 * queries. The frontend must never be allowed to select
 * another company's organizationId.
 *
 * =========================================================
 */

/**
 * =========================================================
 * PREVENT COMPANY CONTEXT OVERRIDE
 * =========================================================
 *
 * The authenticated session determines which company the
 * user is working with.
 *
 * The Financial Assistant therefore rejects attempts to
 * provide organizationId manually through:
 *
 *   ?organizationId=...
 *
 * or:
 *
 *   {
 *     "organizationId": "..."
 *   }
 *
 * This prevents the Financial Assistant from becoming an
 * accidental cross-company data access point.
 * =========================================================
 */

function rejectOrganizationOverride(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const queryOrganizationId =
    typeof req.query.organizationId === "string"
      ? req.query.organizationId.trim()
      : "";

  const body =
    req.body &&
    typeof req.body === "object" &&
    !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : null;

  const bodyOrganizationId =
    body &&
    typeof body.organizationId === "string"
      ? body.organizationId.trim()
      : "";

  if (
    queryOrganizationId.length > 0 ||
    bodyOrganizationId.length > 0
  ) {
    res.status(400).json({
      success: false,
      code: "COMPANY_CONTEXT_OVERRIDE_NOT_ALLOWED",
      message:
        "Company context is determined by your authenticated session.",
    });

    return;
  }

  next();
}

/**
 * =========================================================
 * AUTHENTICATION
 * =========================================================
 *
 * Every Financial Assistant endpoint requires an
 * authenticated FOS session.
 * =========================================================
 */

router.use(authenticate);

/**
 * =========================================================
 * AUTHORIZATION
 * =========================================================
 *
 * Financial Assistant uses the existing FOS reporting
 * permission.
 *
 * This means we do NOT create a separate permission system
 * for the AI Financial Assistant.
 *
 * Existing RBAC continues to control access.
 * =========================================================
 */

router.use(
  requirePermission("reports.view"),
);

/**
 * =========================================================
 * COMPANY CONTEXT PROTECTION
 * =========================================================
 */

router.use(
  rejectOrganizationOverride,
);

/**
 * =========================================================
 * FINANCIAL OVERVIEW
 * =========================================================
 *
 * GET
 * /api/financial-assistant/overview
 *
 * Purpose:
 * - Provide the dashboard with the current company's
 *   financial overview.
 * - Provide the actual company name.
 * - Provide financial metrics and deterministic insights.
 *
 * Company selection:
 * - NEVER supplied by the browser.
 * - Resolved from the authenticated session.
 * =========================================================
 */

router.get(
  "/overview",
  getFinancialAssistantOverview,
);

/**
 * =========================================================
 * AI FINANCIAL CHAT
 * =========================================================
 *
 * POST
 * /api/financial-assistant/chat
 *
 * Expected body:
 *
 * {
 *   "message": "How is our cash position?",
 *   "history": [
 *     {
 *       "role": "user",
 *       "content": "..."
 *     },
 *     {
 *       "role": "assistant",
 *       "content": "..."
 *     }
 *   ]
 * }
 *
 * The controller:
 *
 * - validates the message,
 * - resolves the authenticated company,
 * - rebuilds current financial context,
 * - sends only permitted financial context to the AI,
 * - returns the answer.
 *
 * This endpoint does NOT create or modify:
 *
 * - Journal entries
 * - Expenses
 * - Invoices
 * - Receivables
 * - Payables
 * - Payments
 * - Tax transactions
 * - Accounts
 * - Company settings
 *
 * It is a read-and-analyse operation only.
 * =========================================================
 */

router.post(
  "/chat",
  chatWithFinancialAssistant,
);

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default router;