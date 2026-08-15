import express from "express";
import {
  createEmployee,
  getEmployee,
  getEmployees,
  updateEmployee,
} from "../controllers/employee.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

router.get("/", getEmployees);
router.get("/:id", getEmployee);
router.post("/", createEmployee);
router.patch("/:id", updateEmployee);

export default router;