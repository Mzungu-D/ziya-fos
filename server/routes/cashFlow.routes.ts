import express from "express";
import { getCashFlow } from "../controllers/cashFlow.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getCashFlow
);

export default router;