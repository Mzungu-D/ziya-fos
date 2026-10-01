import { Router } from "express";

import {
  getAIDataReadiness,
  getAIForecast,
  getCompletedAIForecast,
  getAIConfiguration,
} from "../controllers/ai.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = Router();

/*
 * ============================================================
 * ZIYA FOS — AI ROUTES
 * ============================================================
 *
 * All AI routes are protected by:
 *
 * 1. Authentication
 * 2. Tenant-scoped permission checks
 *
 * The controller obtains organizationId from the
 * authenticated session. Clients must never be trusted
 * to select the organization through query/body parameters.
 *
 * Financial AI therefore follows:
 *
 * JWT
 *   ↓
 * authenticate
 *   ↓
 * tenant permission
 *   ↓
 * AI controller
 *   ↓
 * authenticated organizationId
 *   ↓
 * forecasting service
 *   ↓
 * financial data service
 *
 * No Demo Company fallback exists.
 * ============================================================
 */

/**
 * Every AI endpoint requires an authenticated session.
 */
router.use(authenticate);

/**
 * ------------------------------------------------------------
 * AI DATA READINESS
 * ------------------------------------------------------------
 *
 * Determines whether the current tenant has enough
 * accounting history for forecasting.
 */
router.get(
  "/data-readiness",
  requirePermission("reports.view"),
  getAIDataReadiness
);

/**
 * ------------------------------------------------------------
 * FINANCIAL FORECAST
 * ------------------------------------------------------------
 *
 * Generates a forecast using the current tenant's
 * posted/approved accounting history.
 */
router.get(
  "/forecast",
  requirePermission("reports.view"),
  getAIForecast
);

/**
 * ------------------------------------------------------------
 * COMPLETED-MONTH FORECAST
 * ------------------------------------------------------------
 *
 * Excludes the current potentially incomplete accounting
 * month and is therefore suitable for management reporting
 * and scheduled forecasting.
 */
router.get(
  "/forecast/completed",
  requirePermission("reports.view"),
  getCompletedAIForecast
);

/**
 * ------------------------------------------------------------
 * AI CONFIGURATION
 * ------------------------------------------------------------
 *
 * Exposes non-sensitive model configuration only.
 *
 * No tenant financial data is returned by this endpoint.
 */
router.get(
  "/config",
  requirePermission("reports.view"),
  getAIConfiguration
);

export default router;