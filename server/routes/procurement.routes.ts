import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import {
  createProcurementRequest,
  deleteProcurementRequest,
  getProcurementRequestById,
  getProcurementRequests,
  submitProcurementRequest,
  updateProcurementRequest,
  updateProcurementRequestStatus,
} from "../controllers/procurement.controller";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("procurement.view"),
  getProcurementRequests
);

router.get(
  "/:id",
  requirePermission("procurement.view"),
  getProcurementRequestById
);

router.post(
  "/",
  requirePermission("procurement.create"),
  createProcurementRequest
);

router.put(
  "/:id",
  requirePermission("procurement.update"),
  updateProcurementRequest
);

router.delete(
  "/:id",
  requirePermission("procurement.update"),
  deleteProcurementRequest
);

router.post(
  "/:id/submit",
  requirePermission("procurement.update"),
  submitProcurementRequest
);

router.patch(
  "/:id/status",
  requirePermission("procurement.status"),
  updateProcurementRequestStatus
);

export default router;
