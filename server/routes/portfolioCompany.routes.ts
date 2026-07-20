import express from "express";

import {
  createPortfolioCompany,
  getPortfolioCompanies,
  getPortfolioCompanyById,
  updatePortfolioCompany,
  deletePortfolioCompany
} from "../controllers/portfolioCompany.controller";

const router = express.Router();

router.post("/", createPortfolioCompany);

router.get("/", getPortfolioCompanies);

router.get("/:id", getPortfolioCompanyById);

router.put("/:id", updatePortfolioCompany);

router.delete("/:id", deletePortfolioCompany);

export default router;