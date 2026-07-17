import express from "express";
import { getLedger } from "../controllers/ledger.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/:accountId",
  authenticate,
  authorize("SUPER_ADMIN"),
  getLedger
);

export default router;