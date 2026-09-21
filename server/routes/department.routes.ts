import { Router } from "express";

import {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/department.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(authenticate);

/* =========================================================
   DEPARTMENTS
========================================================= */

/*
 * GET    /api/departments
 * GET    /api/departments/:id
 * POST   /api/departments
 * PATCH  /api/departments/:id
 * DELETE /api/departments/:id
 */

router.get(
  "/",
  getDepartments
);

router.get(
  "/:id",
  getDepartment
);

router.post(
  "/",
  createDepartment
);

router.patch(
  "/:id",
  updateDepartment
);

router.delete(
  "/:id",
  deleteDepartment
);

export default router;