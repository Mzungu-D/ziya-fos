import express from "express";
import {
  createJournalEntry,
  getJournalEntries,
} from "../controllers/journal.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createJournalEntry
);

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getJournalEntries
);

export default router;