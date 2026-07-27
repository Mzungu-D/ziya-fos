import express from "express";

import {
  createPortfolioCompany,
  getPortfolioCompanies,
  getPortfolioCompanyById,
  updatePortfolioCompany,
  deletePortfolioCompany,
} from "../controllers/portfolioCompany.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("portfolioCompany.view"),
  getPortfolioCompanies
);

router.get(
  "/:id",
  requirePermission("portfolioCompany.view"),
  getPortfolioCompanyById
);

router.post(
  "/",
  requirePermission("portfolioCompany.create"),
  createPortfolioCompany
);

router.put(
  "/:id",
  requirePermission("portfolioCompany.update"),
  updatePortfolioCompany
);

router.delete(
  "/:id",
  requirePermission("portfolioCompany.delete"),
  deletePortfolioCompany
);

export default router;