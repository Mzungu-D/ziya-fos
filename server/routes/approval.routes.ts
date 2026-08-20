import express from "express";

import {
  getApprovals,
  approveApproval,
  rejectApproval,
} from "../controllers/approval.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   APPROVALS
========================================================= */

router.use(authenticate);

/* =========================================================
   VIEW APPROVALS
========================================================= */

router.get(
  "/",
  requirePermission("approval.view"),
  getApprovals
);

/* =========================================================
   APPROVE REQUEST
========================================================= */

router.patch(
  "/:id/approve",
  requirePermission("approval.approve"),
  approveApproval
);

/* =========================================================
   REJECT REQUEST
========================================================= */

router.patch(
  "/:id/reject",
  requirePermission("approval.reject"),
  rejectApproval
);

export default router;