import express from "express";
import {
  getPayroll,
  getPayrollPeriod,
  runPayroll,
} from "../controllers/payroll.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

router.get("/", getPayroll);
router.get("/:id", getPayrollPeriod);
router.post("/run", runPayroll);

export default router;