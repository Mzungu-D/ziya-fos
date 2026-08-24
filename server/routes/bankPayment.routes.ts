import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import multer from "multer";

import {
  createBankPaymentController,
  createBankPaymentBatchController,
  getBankPaymentController,
  getBankPaymentBatchController,
  listBankPaymentsController,
  listBankPaymentBatchesController,
} from "../controllers/bankPayment.controller";

import { authenticate } from "../middleware/auth.middleware";

import {
  requirePermission,
} from "../middleware/permission.middleware";

import {
  importBankPaymentFile,
} from "../services/bank/bankPaymentImport.service";

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

/* =========================================================
   MULTIPART UPLOAD CONFIGURATION

   Files are kept in memory because the importer only needs
   the file contents for validation/preview.

   IMPORTANT:
   - Maximum file size: 10 MB
   - Maximum recipients: 1,000
   - No uploaded file is written to disk.
========================================================= */

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        10 * 1024 * 1024,

      files: 1,
    },

    fileFilter:
      (
        _req,
        file,
        callback,
      ) => {
        const filename =
          String(
            file.originalname ??
              "",
          )
            .trim()
            .toLowerCase();

        const lastDot =
          filename.lastIndexOf(
            ".",
          );

        const extension =
          lastDot >= 0
            ? filename.slice(
                lastDot,
              )
            : "";

        const supported =
          extension ===
            ".xlsx" ||
          extension ===
            ".xls" ||
          extension ===
            ".csv";

        if (!supported) {
          callback(
            new Error(
              "Unsupported payment file. Upload an Excel (.xlsx/.xls) or CSV (.csv) file.",
            ),
          );

          return;
        }

        callback(
          null,
          true,
        );
      },
  });

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(
  authenticate,
);

/* =========================================================
   LIST BANK PAYMENTS

   GET /api/bank-payments
========================================================= */

router.get(
  "/",
  requirePermission(
    "bankPayment.view",
  ),
  listBankPaymentsController,
);

/* =========================================================
   CREATE SINGLE BANK PAYMENT

   POST /api/bank-payments
========================================================= */

router.post(
  "/",
  requirePermission(
    "bankPayment.create",
  ),
  createBankPaymentController,
);

/* =========================================================
   CREATE BANK PAYMENT BATCH

   POST /api/bank-payments/batches
========================================================= */

router.get(
  "/batches",
  requirePermission(
    "bankPayment.view",
  ),
  listBankPaymentBatchesController,
);

router.post(
  "/batches",
  requirePermission(
    "bankPayment.create",
  ),
  createBankPaymentBatchController,
);

/* =========================================================
   IMPORT BANK PAYMENT FILE

   POST /api/bank-payments/import

   Multipart field:
     file

   Supported:
     .xlsx
     .xls
     .csv

   IMPORTANT:
   This endpoint ONLY parses and validates the file.

   It DOES NOT:
     - create payment records
     - create a payment batch
     - call a bank API
     - send money

   The response is a preview which Finance must
   review before the existing payment batch flow
   is called.
========================================================= */

router.post(
  "/import",
  requirePermission(
    "bankPayment.create",
  ),
  upload.single(
    "file",
  ),
  (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message:
            "Payment file is required. Upload an Excel or CSV file using the 'file' field.",
        });

        return;
      }

      const result =
        importBankPaymentFile(
          {
            originalname:
              req.file
                .originalname,

            mimetype:
              req.file
                .mimetype,

            buffer:
              req.file.buffer,
          },
          {
            maxRecipients:
              1000,

            defaultCurrency:
              "KES",

            rejectDuplicatePaymentReferences:
              true,
          },
        );

      res.status(
        result.success
          ? 200
          : 422,
      ).json({
        success:
          result.success,

        message:
          result.success
            ? "Payment file validated successfully. Review the preview before submitting the batch."
            : "Payment file contains validation errors. No payments were created or submitted.",

        data:
          result,
      });
    } catch (error) {
      next(error);
    }
  },
);

/* =========================================================
   GET BANK PAYMENT BATCH

   GET /api/bank-payments/batches/:batchId
========================================================= */

router.get(
  "/batches/:batchId",
  requirePermission(
    "bankPayment.view",
  ),
  getBankPaymentBatchController,
);

/* =========================================================
   GET SINGLE BANK PAYMENT

   GET /api/bank-payments/:paymentId
========================================================= */

router.get(
  "/:paymentId",
  requirePermission(
    "bankPayment.view",
  ),
  getBankPaymentController,
);

/* =========================================================
   MULTER / UPLOAD ERROR HANDLER

   This must remain after the routes using multer.
========================================================= */

router.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        res.status(413).json({
          success: false,
          message:
            "Payment file exceeds the maximum allowed size of 10 MB.",
        });

        return;
      }

      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {
        res.status(400).json({
          success: false,
          message:
            "Only one payment file can be uploaded at a time.",
        });

        return;
      }

      res.status(400).json({
        success: false,
        message:
          `Payment file upload error: ${error.message}`,
      });

      return;
    }

    if (
      error instanceof
      Error
    ) {
      /*
       * File-filter errors and importer errors
       * are returned as controlled client errors.
       */
      const message =
        error.message;

      if (
        message.includes(
          "Unsupported payment file",
        ) ||
        message.includes(
          "payment file",
        ) ||
        message.includes(
          "Payment file",
        )
      ) {
        res.status(400).json({
          success: false,
          message,
        });

        return;
      }
    }

    next(error);
  },
);

export default router;