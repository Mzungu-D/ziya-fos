import express from "express";

import {
  provisionOrganization,
  getPlatformOrganizations,
  getPlatformOrganization,
  getPlatformAuditLogs,
  approveOrganization,
  suspendOrganization,
  activateOrganization,
  deleteOrganization,
} from "../controllers/platform.controller";

import {
  getPlatformUsers,
  getPlatformUser,
  deactivateUser,
  activateUser,
  unlockUser,
} from "../controllers/platform.users.controller";

import {
  getSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
} from "../controllers/platform.subscriptions.controller";

import {
  getBillingStats,
  getRevenueBreakdown,
} from "../controllers/platform.billing.controller";

import {
  getLicensingStats,
  getLicenses,
} from "../controllers/platform.licensing.controller";

import { authenticate }         from "../middleware/auth.middleware";
import { requirePlatformAdmin } from "../middleware/platformAdmin.middleware";

const router = express.Router();

router.use(authenticate);
router.use(requirePlatformAdmin);

/* ── AUDIT LOGS ─────────────────────────────────────────── */
router.get("/audit-logs", getPlatformAuditLogs);

/* ── ORGANIZATIONS ──────────────────────────────────────── */
router.get(    "/organizations",                          getPlatformOrganizations);
router.post(   "/organizations",                          provisionOrganization);
router.get(    "/organizations/:organizationId",          getPlatformOrganization);
router.patch(  "/organizations/:organizationId/approve",  approveOrganization);
router.patch(  "/organizations/:organizationId/suspend",  suspendOrganization);
router.patch(  "/organizations/:organizationId/activate", activateOrganization);
router.delete( "/organizations/:organizationId",          deleteOrganization);

/* ── USERS ──────────────────────────────────────────────── */
router.get(   "/users",                    getPlatformUsers);
router.get(   "/users/:userId",            getPlatformUser);
router.patch( "/users/:userId/deactivate", deactivateUser);
router.patch( "/users/:userId/activate",   activateUser);
router.patch( "/users/:userId/unlock",     unlockUser);

/* ── SUBSCRIPTIONS ──────────────────────────────────────── */
router.get(   "/subscriptions",     getSubscriptions);
router.post(  "/subscriptions",     createSubscription);
router.get(   "/subscriptions/:id", getSubscription);
router.patch( "/subscriptions/:id", updateSubscription);

/* ── BILLING ─────────────────────────────────────────────── */
router.get( "/billing/stats",   getBillingStats);
router.get( "/billing/revenue", getRevenueBreakdown);

/* ── LICENSING ───────────────────────────────────────────── */
router.get( "/licensing/stats",    getLicensingStats);
router.get( "/licensing/licenses", getLicenses);

export default router;