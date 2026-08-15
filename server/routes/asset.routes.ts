import express from "express";

import {
  createAsset,
  deleteAsset,
  getAsset,
  getAssets,
  updateAsset,
} from "../controllers/asset.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  getAssets
);

router.get(
  "/:id",
  getAsset
);

router.post(
  "/",
  createAsset
);

router.patch(
  "/:id",
  updateAsset
);

router.delete(
  "/:id",
  deleteAsset
);

export default router;