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
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// GET all journal entries
router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getJournalEntries
);

// GET one journal entry
router.get(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  getJournalEntry
);

// CREATE journal entry
router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createJournalEntry
);

// UPDATE draft journal entry
router.put(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  updateJournalEntry
);

// POST journal entry
router.patch(
  "/:id/post",
  authenticate,
  authorize("SUPER_ADMIN"),
  postJournalEntry
);

// APPROVE posted journal entry
router.patch(
  "/:id/approve",
  authenticate,
  authorize("SUPER_ADMIN"),
  approveJournalEntry
);

// REVERSE approved journal entry
router.post(
  "/:id/reverse",
  authenticate,
  authorize("SUPER_ADMIN"),
  reverseJournalEntry
);

// DELETE draft journal entry
router.delete(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  deleteJournalEntry
);

export default router;