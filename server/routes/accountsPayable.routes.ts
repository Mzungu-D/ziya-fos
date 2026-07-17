import express from "express";
import {
  createPayable,
  getPayables,
} from "../controllers/accountsPayable.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createPayable
);

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getPayables
);

export default router;