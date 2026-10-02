import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

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
 * JOURNAL ENTRY ROUTES
 * =========================================================
 *
 * All journal operations are:
 *
 * - authenticated
 * - permission controlled
 * - tenant scoped by the authenticated organization context
 *
 * The route layer never accepts an organizationId from the client.
 *
 * Permissions:
 *
 *   journal.view
 *   journal.create
 *   journal.update
 *   journal.post
 *   journal.approve
 *   journal.reverse
 *   journal.delete
 *
 * The "*" permission is evaluated by the permission middleware and grants
 * permissions only within the authenticated organization.
 *
 * Accounting integrity remains in the journal controller/service:
 *
 * - double-entry balancing
 * - tenant account ownership
 * - valid debit/credit lines
 * - posting controls
 * - approval controls
 * - reversal controls
 * - audit trail
 * - transaction atomicity
 * - protection of posted accounting history
 */

/**
 * =========================================================
 * JOURNAL ID VALIDATION
 * =========================================================
 *
 * Prevent malformed identifiers from reaching the accounting
 * controller.
 *
 * Ownership is deliberately NOT checked here because ownership
 * requires the authenticated tenant context and belongs in the
 * controller/service transaction.
 */
function validateJournalId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const journalId =
    typeof req.params.id === "string"
      ? req.params.id.trim()
      : "";

  if (!journalId) {
    res.status(400).json({
      success: false,
      message: "Journal entry ID is required.",
    });
    return;
  }

  if (journalId.length > 128) {
    res.status(400).json({
      success: false,
      message: "Invalid journal entry ID.",
    });
    return;
  }

  req.params.id = journalId;

  next();
}

/**
 * =========================================================
 * LIST JOURNAL ENTRIES
 * =========================================================
 *
 * GET /api/journals
 *
 * Read-only endpoint.
 *
 * The controller is responsible for tenant-scoped filtering,
 * pagination, searching, date/status filtering and deterministic
 * ordering.
 */
router.get(
  "/",
  authenticate,
  requirePermission("journal.view"),
  getJournalEntries,
);

/**
 * =========================================================
 * GET JOURNAL ENTRY
 * =========================================================
 *
 * GET /api/journals/:id
 *
 * The controller MUST verify that the journal belongs to the
 * authenticated organization before returning it.
 */
router.get(
  "/:id",
  authenticate,
  requirePermission("journal.view"),
  validateJournalId,
  getJournalEntry,
);

/**
 * =========================================================
 * CREATE JOURNAL ENTRY
 * =========================================================
 *
 * POST /api/journals
 *
 * Creates a tenant-owned journal entry.
 *
 * The accounting layer is responsible for:
 *
 * - validating accounts
 * - validating journal lines
 * - enforcing debit = credit
 * - preventing invalid debit/credit combinations
 * - validating transaction dates
 * - generating a unique reference
 * - atomic persistence
 * - audit logging
 */
router.post(
  "/",
  authenticate,
  requirePermission("journal.create"),
  createJournalEntry,
);

/**
 * =========================================================
 * UPDATE DRAFT JOURNAL ENTRY
 * =========================================================
 *
 * PUT /api/journals/:id
 *
 * Only draft entries may be changed.
 *
 * The controller/service MUST reject attempts to modify posted,
 * approved or reversed accounting history.
 */
router.put(
  "/:id",
  authenticate,
  requirePermission("journal.update"),
  validateJournalId,
  updateJournalEntry,
);

/**
 * =========================================================
 * POST JOURNAL ENTRY
 * =========================================================
 *
 * PATCH /api/journals/:id/post
 *
 * Transitions a balanced draft into the posted accounting ledger.
 *
 * Posting must be atomic and must revalidate:
 *
 * - tenant ownership
 * - journal status
 * - account validity
 * - debit/credit balance
 * - posting eligibility
 * - accounting period controls
 *
 * A posted journal must not subsequently be edited.
 */
router.patch(
  "/:id/post",
  authenticate,
  requirePermission("journal.post"),
  validateJournalId,
  postJournalEntry,
);

/**
 * =========================================================
 * APPROVE JOURNAL ENTRY
 * =========================================================
 *
 * PATCH /api/journals/:id/approve
 *
 * Approval is a controlled workflow transition.
 *
 * The controller/service must verify the current state and prevent
 * approval of invalid, unbalanced, reversed or already-finalized
 * entries.
 */
router.patch(
  "/:id/approve",
  authenticate,
  requirePermission("journal.approve"),
  validateJournalId,
  approveJournalEntry,
);

/**
 * =========================================================
 * REVERSE JOURNAL ENTRY
 * =========================================================
 *
 * POST /api/journals/:id/reverse
 *
 * Posted accounting history is reversed through a controlled
 * reversing journal rather than destructive modification.
 *
 * The accounting layer is responsible for:
 *
 * - tenant ownership
 * - original-entry validation
 * - preventing duplicate reversal
 * - generating a unique reversal reference
 * - creating equal-and-opposite journal lines
 * - preserving the original journal
 * - linking the reversal to the original entry
 * - atomic persistence
 * - audit logging
 */
router.post(
  "/:id/reverse",
  authenticate,
  requirePermission("journal.reverse"),
  validateJournalId,
  reverseJournalEntry,
);

/**
 * =========================================================
 * DELETE DRAFT JOURNAL ENTRY
 * =========================================================
 *
 * DELETE /api/journals/:id
 *
 * Deletion is restricted to entries that the accounting layer
 * determines are safely deletable.
 *
 * Posted, approved or otherwise protected accounting history must
 * never be destructively deleted through this endpoint.
 */
router.delete(
  "/:id",
  authenticate,
  requirePermission("journal.delete"),
  validateJournalId,
  deleteJournalEntry,
);

export default router;
