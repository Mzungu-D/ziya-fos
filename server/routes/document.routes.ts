import express from "express";

import {
  getDocuments,
  getDocumentById,
  createDocumentUploadUrl,
  createDocument,
  downloadDocument,
  deleteDocument,
} from "../controllers/document.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   DOCUMENT ROUTES
========================================================= */

router.use(authenticate);

router.get(
  "/",
  requirePermission("document.view"),
  getDocuments
);

router.get(
  "/:id",
  requirePermission("document.view"),
  getDocumentById
);

router.post(
  "/upload-url",
  requirePermission("document.create"),
  createDocumentUploadUrl
);

router.post(
  "/",
  requirePermission("document.create"),
  createDocument
);

router.get(
  "/:id/download",
  requirePermission("document.view"),
  downloadDocument
);

router.delete(
  "/:id",
  requirePermission("document.delete"),
  deleteDocument
);

export default router;