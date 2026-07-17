import express from "express";

import {
  createVendor,
  getVendors
} from "../controllers/vendor.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createVendor
);

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getVendors
);

export default router;