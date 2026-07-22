import express from "express";

import {
  getAllLedger,
  getLedger,
} from "../controllers/ledger.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Full General Ledger
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getAllLedger
);

/*
|--------------------------------------------------------------------------
| Ledger For Specific Account
|--------------------------------------------------------------------------
*/

router.get(
  "/:accountId",
  authenticate,
  authorize("SUPER_ADMIN"),
  getLedger
);

export default router;