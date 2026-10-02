import { Router, type NextFunction, type Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  bootstrap,
  publish,
  reconcile,
  status,
} from "../controllers/fosConfigurationTemplate.controller";

const router = Router();

function requirePlatformAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.platformRole !== "PLATFORM_ADMIN") {
    return res.status(403).json({
      success: false,
      error: "Platform administrator access required.",
    });
  }

  return next();
}

router.use(authenticate);
router.use(requirePlatformAdmin);

router.get("/status", status);
router.post("/bootstrap", bootstrap);
router.post("/publish", publish);
router.post("/reconcile", reconcile);

export default router;
