import express from "express";
import { getUsers } from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/users",
  authenticate,
  authorize("SUPER_ADMIN"),
  getUsers
);

export default router;