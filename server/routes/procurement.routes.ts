import express from "express";

import {
  createProcurementRequest,
  getProcurementRequests,
  getProcurementRequestById,
  updateProcurementRequest,
  updateProcurementRequestStatus,
} from "../controllers/procurement.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   PROCUREMENT ROUTES

   All routes require:
   1. Authentication
   2. A valid TENANT session
   3. Active membership
   4. Active user
   5. Active organization
   6. Appropriate procurement permission
========================================================= */

router.use(authenticate);

/* =========================================================
   GET ALL PROCUREMENT REQUESTS
========================================================= */

router.get(
  "/",
  requirePermission("procurement.view"),
  getProcurementRequests
);

/* =========================================================
   GET ONE PROCUREMENT REQUEST
========================================================= */

router.get(
  "/:id",
  requirePermission("procurement.view"),
  getProcurementRequestById
);

/* =========================================================
   CREATE PROCUREMENT REQUEST
========================================================= */

router.post(
  "/",
  requirePermission("procurement.create"),
  createProcurementRequest
);

/* =========================================================
   UPDATE PROCUREMENT REQUEST

   Only pending records can be modified by the controller.
========================================================= */

router.put(
  "/:id",
  requirePermission("procurement.update"),
  updateProcurementRequest
);

/* =========================================================
   UPDATE PROCUREMENT STATUS
========================================================= */

router.patch(
  "/:id/status",
  requirePermission("procurement.status"),
  updateProcurementRequestStatus
);

export default router;