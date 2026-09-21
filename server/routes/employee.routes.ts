import express from "express";

import {
  createEmployee,
  getEmployee,
  getEmployees,
  getEmployeeStats,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employee.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
   All employee routes require an authenticated tenant user.
========================================================= */

router.use(authenticate);

/* =========================================================
   EMPLOYEE STATISTICS
   IMPORTANT:
   This route must come before /:id.
   Otherwise "stats" could be interpreted as an employee ID.
========================================================= */

router.get(
  "/stats",
  getEmployeeStats
);

/* =========================================================
   EMPLOYEE DIRECTORY
   Supports:
   - pagination
   - search
   - department filtering
   - status filtering
========================================================= */

router.get(
  "/",
  getEmployees
);

/* =========================================================
   SINGLE EMPLOYEE
========================================================= */

router.get(
  "/:id",
  getEmployee
);

/* =========================================================
   CREATE EMPLOYEE
========================================================= */

router.post(
  "/",
  createEmployee
);

/* =========================================================
   UPDATE EMPLOYEE
========================================================= */

router.patch(
  "/:id",
  updateEmployee
);

/* =========================================================
   DELETE EMPLOYEE
========================================================= */

router.delete(
  "/:id",
  deleteEmployee
);

export default router;