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
  getSupportStats,
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
} from "../controllers/platform.support.controller";

import {
  getAuditStats,
  getAuditLogs,
} from "../controllers/platform.auditlogs.controller";

import {
  getLicensingStats,
  getLicenses,
} from "../controllers/platform.licensing.controller";

import {
  getAnalyticsSummary,
  getGrowthData,
} from "../controllers/platform.reports.controller";

import { getSystemHealth }        from "../controllers/platform.health.controller";
import { getNotificationSummary } from "../controllers/platform.notifications.controller";
import { getDashboardStats }      from "../controllers/platform.dashboard.controller";
import { getPlatformOverview }    from "../controllers/platform.settings.controller";

import { authenticate }         from "../middleware/auth.middleware";
import { requirePlatformAdmin } from "../middleware/platformAdmin.middleware";

const router = express.Router();

router.use(authenticate);
router.use(requirePlatformAdmin);

/* ── DASHBOARD ───────────────────────────────────────────── */
router.get("/dashboard/stats", getDashboardStats);

/* ── NOTIFICATIONS ───────────────────────────────────────── */
router.get("/notifications/summary", getNotificationSummary);

/* ── AUDIT LOGS ─────────────────────────────────────────── */
router.get("/audit-logs",       getPlatformAuditLogs);
router.get("/audit-logs/stats", getAuditStats);
router.get("/audit-logs/list",  getAuditLogs);

/* ── LICENSING ───────────────────────────────────────────── */
router.get("/licensing/stats",    getLicensingStats);
router.get("/licensing/licenses", getLicenses);

/* ── REPORTS & ANALYTICS ─────────────────────────────────── */
router.get("/reports/summary", getAnalyticsSummary);
router.get("/reports/growth",  getGrowthData);

/* ── SYSTEM HEALTH ───────────────────────────────────────── */
router.get("/health", getSystemHealth);

/* ── SETTINGS ────────────────────────────────────────────── */
router.get("/settings/overview", getPlatformOverview);

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
router.get("/billing/stats",   getBillingStats);
router.get("/billing/revenue", getRevenueBreakdown);

/* ── SUPPORT ─────────────────────────────────────────────── */
router.get(   "/support/stats",       getSupportStats);
router.get(   "/support/tickets",     getTickets);
router.post(  "/support/tickets",     createTicket);
router.get(   "/support/tickets/:id", getTicket);
router.patch( "/support/tickets/:id", updateTicket);

export default router;