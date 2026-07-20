import { Router } from "express";
import {
  createInvestment,
  getInvestments,
} from "../controllers/investment.controller";

const router = Router();

// Create Investment
router.post("/", createInvestment);

// Get All Investments
router.get("/", getInvestments);

export default router;