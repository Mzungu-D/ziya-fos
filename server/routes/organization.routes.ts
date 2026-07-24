import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getCurrentOrganization } from "../controllers/organization.controller";

const router = express.Router();

router.get(
  "/current",
  authenticate,
  getCurrentOrganization
);

export default router;