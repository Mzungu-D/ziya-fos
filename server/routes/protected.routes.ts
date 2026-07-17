import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/dashboard",
  authenticate,
  authorize("SUPER_ADMIN"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to Ziya FOS Dashboard",
    });
  }
);

export default router;