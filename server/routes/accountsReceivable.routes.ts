import express from "express";
import {
  createReceivable,
  getReceivables
} from "../controllers/accountsReceivable.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createReceivable
);

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getReceivables
);

export default router;