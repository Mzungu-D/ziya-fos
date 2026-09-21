import { Router } from "express";

import {
  getPositions,
  getPosition,
  createPosition,
  updatePosition,
  deletePosition,
} from "../controllers/position.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(authenticate);

/* =========================================================
   POSITIONS
========================================================= */

/*
 * GET    /api/positions
 * GET    /api/positions/:id
 * POST   /api/positions
 * PATCH  /api/positions/:id
 * DELETE /api/positions/:id
 */

router.get(
  "/",
  getPositions
);

router.get(
  "/:id",
  getPosition
);

router.post(
  "/",
  createPosition
);

router.patch(
  "/:id",
  updatePosition
);

router.delete(
  "/:id",
  deletePosition
);

export default router;