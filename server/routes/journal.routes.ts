import express from "express";

import {
  createJournalEntry,
  getJournalEntries,
  getJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  approveJournalEntry,
  reverseJournalEntry,
  deleteJournalEntry,
} from "../controllers/journal.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * JOURNAL ROUTES
 * =========================================================
 *
 * Tenant-aware RBAC:
 *
 * journal.view
 * journal.create
 * journal.update
 * journal.post
 * journal.approve
 * journal.reverse
 * journal.delete
 *
 * "*" grants all permissions inside the authenticated
 * organization only.
 * =========================================================
 */

/**
 * GET ALL JOURNAL ENTRIES
 */
router.get(
  "/",
  authenticate,
  requirePermission("journal.view"),
  getJournalEntries
);

/**
 * GET ONE JOURNAL ENTRY
 */
router.get(
  "/:id",
  authenticate,
  requirePermission("journal.view"),
  getJournalEntry
);

/**
 * CREATE JOURNAL ENTRY
 */
router.post(
  "/",
  authenticate,
  requirePermission("journal.create"),
  createJournalEntry
);

/**
 * UPDATE DRAFT JOURNAL ENTRY
 */
router.put(
  "/:id",
  authenticate,
  requirePermission("journal.update"),
  updateJournalEntry
);

/**
 * POST JOURNAL ENTRY
 */
router.patch(
  "/:id/post",
  authenticate,
  requirePermission("journal.post"),
  postJournalEntry
);

/**
 * APPROVE POSTED JOURNAL ENTRY
 */
router.patch(
  "/:id/approve",
  authenticate,
  requirePermission("journal.approve"),
  approveJournalEntry
);

/**
 * REVERSE APPROVED JOURNAL ENTRY
 */
router.post(
  "/:id/reverse",
  authenticate,
  requirePermission("journal.reverse"),
  reverseJournalEntry
);

/**
 * DELETE DRAFT JOURNAL ENTRY
 */
router.delete(
  "/:id",
  authenticate,
  requirePermission("journal.delete"),
  deleteJournalEntry
);

export default router;