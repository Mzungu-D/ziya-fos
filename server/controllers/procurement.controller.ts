import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   PROCUREMENT CONTROLLER

   SECURITY RULES
   ---------------------------------------------------------
   - Organization is always taken from the authenticated
     tenant session.
   - organizationId is NEVER accepted from req.body.
   - requestedBy is always taken from req.user.userId.
   - Every read/write is tenant scoped.
   - Database unique constraint protects request codes.
========================================================= */

const getParam = (
  value: string | string[] | undefined
): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  const organizationId =
    req.user?.organizationId?.trim();

  return organizationId || null;
};

const getUserId = (
  req: AuthRequest
): string | null => {
  const userId =
    req.user?.userId?.trim();

  return userId || null;
};

const cleanOptionalString = (
  value: unknown
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
};

const normalizeRequestCode = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase();
};

const normalizeDepartment = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeItem = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

/* =========================================================
   GET ALL PROCUREMENT REQUESTS
========================================================= */

export const getProcurementRequests =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          code: "ORGANIZATION_CONTEXT_REQUIRED",
          message:
            "Organization context is required.",
        });
      }

      const requests =
        await prisma.procurementRequest.findMany({
          where: {
            organizationId,
          },

          orderBy: {
            createdAt: "desc",
          },
        });

      return res.status(200).json({
        success: true,
        count: requests.length,
        requests,
      });
    } catch (error) {
      console.error(
        "GET PROCUREMENT REQUESTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "PROCUREMENT_FETCH_FAILED",
        message:
          "Failed to fetch procurement requests.",
      });
    }
  };

/* =========================================================
   GET ONE PROCUREMENT REQUEST
========================================================= */

export const getProcurementRequestById =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const id = getParam(req.params.id).trim();

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          code: "ORGANIZATION_CONTEXT_REQUIRED",
          message:
            "Organization context is required.",
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          code: "PROCUREMENT_REQUEST_ID_REQUIRED",
          message:
            "Procurement request ID is required.",
        });
      }

      const request =
        await prisma.procurementRequest.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!request) {
        return res.status(404).json({
          success: false,
          code: "PROCUREMENT_REQUEST_NOT_FOUND",
          message:
            "Procurement request not found.",
        });
      }

      return res.status(200).json({
        success: true,
        request,
      });
    } catch (error) {
      console.error(
        "GET PROCUREMENT REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "PROCUREMENT_REQUEST_FETCH_FAILED",
        message:
          "Failed to fetch procurement request.",
      });
    }
  };

/* =========================================================
   CREATE PROCUREMENT REQUEST
========================================================= */

export const createProcurementRequest =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const userId =
        getUserId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          code: "ORGANIZATION_CONTEXT_REQUIRED",
          message:
            "Organization context is required.",
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: "USER_CONTEXT_REQUIRED",
          message:
            "Authenticated user context is required.",
        });
      }

      const requestCode =
        normalizeRequestCode(
          req.body?.requestCode
        );

      const item =
        normalizeItem(req.body?.item);

      const department =
        normalizeDepartment(
          req.body?.department
        );

      const quantity =
        typeof req.body?.quantity === "number"
          ? req.body.quantity
          : Number(req.body?.quantity);

      const estimatedAmount =
        typeof req.body?.estimatedAmount ===
        "number"
          ? req.body.estimatedAmount
          : Number(
              req.body?.estimatedAmount
            );

      const notes =
        cleanOptionalString(
          req.body?.notes
        );

      /* =====================================================
         VALIDATION
      ===================================================== */

      if (!requestCode) {
        return res.status(400).json({
          success: false,
          code: "REQUEST_CODE_REQUIRED",
          message:
            "Request code is required.",
        });
      }

      if (requestCode.length > 50) {
        return res.status(400).json({
          success: false,
          code: "REQUEST_CODE_TOO_LONG",
          message:
            "Request code must not exceed 50 characters.",
        });
      }

      if (!item) {
        return res.status(400).json({
          success: false,
          code: "ITEM_REQUIRED",
          message:
            "Item or description is required.",
        });
      }

      if (item.length > 500) {
        return res.status(400).json({
          success: false,
          code: "ITEM_TOO_LONG",
          message:
            "Item or description must not exceed 500 characters.",
        });
      }

      if (!department) {
        return res.status(400).json({
          success: false,
          code: "DEPARTMENT_REQUIRED",
          message:
            "Department is required.",
        });
      }

      if (department.length > 100) {
        return res.status(400).json({
          success: false,
          code: "DEPARTMENT_TOO_LONG",
          message:
            "Department must not exceed 100 characters.",
        });
      }

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 1000000
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_QUANTITY",
          message:
            "Quantity must be a whole number greater than zero.",
        });
      }

      if (
        !Number.isFinite(
          estimatedAmount
        ) ||
        estimatedAmount <= 0 ||
        estimatedAmount >
          100000000000
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ESTIMATED_AMOUNT",
          message:
            "Estimated amount must be greater than zero and within the allowed limit.",
        });
      }

      if (
        notes &&
        notes.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          code: "NOTES_TOO_LONG",
          message:
            "Notes must not exceed 2000 characters.",
        });
      }

      /* =====================================================
         DUPLICATE CHECK

         This is a friendly early check.

         The database unique constraint remains the
         authoritative protection against concurrent requests.
      ===================================================== */

      const existingRequest =
        await prisma.procurementRequest.findFirst({
          where: {
            organizationId,
            requestCode,
          },

          select: {
            id: true,
          },
        });

      if (existingRequest) {
        return res.status(409).json({
          success: false,
          code: "REQUEST_CODE_EXISTS",
          message:
            "A procurement request with this code already exists in this organization.",
        });
      }

      /* =====================================================
         CREATE

         organizationId and requestedBy are taken from the
         authenticated session, never from the request body.
      ===================================================== */

      try {
        const request =
          await prisma.procurementRequest.create({
            data: {
              organizationId,
              requestedBy: userId,
              requestCode,
              item,
              department,
              quantity,
              estimatedAmount,
              notes,
              status: "PENDING",
            },
          });

        return res.status(201).json({
          success: true,
          message:
            "Procurement request created successfully.",
          request,
        });
      } catch (createError: unknown) {
        /*
         * Prisma P2002 = unique constraint violation.
         *
         * This protects against two users submitting the same
         * request code at almost exactly the same time.
         */
        if (
          typeof createError === "object" &&
          createError !== null &&
          "code" in createError &&
          (createError as { code?: unknown })
            .code === "P2002"
        ) {
          return res.status(409).json({
            success: false,
            code: "REQUEST_CODE_EXISTS",
            message:
              "A procurement request with this code already exists in this organization.",
          });
        }

        throw createError;
      }
    } catch (error) {
      console.error(
        "CREATE PROCUREMENT REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "PROCUREMENT_CREATE_FAILED",
        message:
          "Failed to create procurement request.",
      });
    }
  };

/* =========================================================
   UPDATE PROCUREMENT REQUEST
========================================================= */

export const updateProcurementRequest =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const id =
        getParam(req.params.id).trim();

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          code: "ORGANIZATION_CONTEXT_REQUIRED",
          message:
            "Organization context is required.",
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          code: "PROCUREMENT_REQUEST_ID_REQUIRED",
          message:
            "Procurement request ID is required.",
        });
      }

      const existing =
        await prisma.procurementRequest.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          code: "PROCUREMENT_REQUEST_NOT_FOUND",
          message:
            "Procurement request not found.",
        });
      }

      /*
       * Only PENDING requests can be edited through this
       * general update endpoint.
       *
       * Approved/ordered/delivered/rejected records should
       * not be silently rewritten.
       */
      if (existing.status !== "PENDING") {
        return res.status(409).json({
          success: false,
          code: "PROCUREMENT_REQUEST_LOCKED",
          message:
            "Only pending procurement requests can be edited.",
        });
      }

      const requestCode =
        req.body?.requestCode !== undefined
          ? normalizeRequestCode(
              req.body.requestCode
            )
          : existing.requestCode;

      const item =
        req.body?.item !== undefined
          ? normalizeItem(req.body.item)
          : existing.item;

      const department =
        req.body?.department !== undefined
          ? normalizeDepartment(
              req.body.department
            )
          : existing.department;

      const quantity =
        req.body?.quantity !== undefined
          ? typeof req.body.quantity ===
            "number"
            ? req.body.quantity
            : Number(req.body.quantity)
          : existing.quantity;

      const estimatedAmount =
        req.body?.estimatedAmount !==
        undefined
          ? typeof req.body
                .estimatedAmount ===
              "number"
            ? req.body.estimatedAmount
            : Number(
                req.body.estimatedAmount
              )
          : existing.estimatedAmount;

      const notes =
        req.body?.notes !== undefined
          ? cleanOptionalString(
              req.body.notes
            )
          : existing.notes;

      if (!requestCode) {
        return res.status(400).json({
          success: false,
          code: "REQUEST_CODE_REQUIRED",
          message:
            "Request code is required.",
        });
      }

      if (!item) {
        return res.status(400).json({
          success: false,
          code: "ITEM_REQUIRED",
          message:
            "Item or description is required.",
        });
      }

      if (!department) {
        return res.status(400).json({
          success: false,
          code: "DEPARTMENT_REQUIRED",
          message:
            "Department is required.",
        });
      }

      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_QUANTITY",
          message:
            "Quantity must be a whole number greater than zero.",
        });
      }

      if (
        !Number.isFinite(
          estimatedAmount
        ) ||
        estimatedAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ESTIMATED_AMOUNT",
          message:
            "Estimated amount must be greater than zero.",
        });
      }

      if (
        notes &&
        notes.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          code: "NOTES_TOO_LONG",
          message:
            "Notes must not exceed 2000 characters.",
        });
      }

      if (
        requestCode !==
        existing.requestCode
      ) {
        const duplicate =
          await prisma.procurementRequest.findFirst({
            where: {
              organizationId,
              requestCode,
              NOT: {
                id,
              },
            },
            select: {
              id: true,
            },
          });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            code: "REQUEST_CODE_EXISTS",
            message:
              "A procurement request with this code already exists in this organization.",
          });
        }
      }

      try {
        const request =
          await prisma.procurementRequest.update({
            where: {
              id,
            },

            data: {
              requestCode,
              item,
              department,
              quantity,
              estimatedAmount,
              notes,
            },
          });

        return res.status(200).json({
          success: true,
          message:
            "Procurement request updated successfully.",
          request,
        });
      } catch (updateError: unknown) {
        if (
          typeof updateError === "object" &&
          updateError !== null &&
          "code" in updateError &&
          (updateError as { code?: unknown })
            .code === "P2002"
        ) {
          return res.status(409).json({
            success: false,
            code: "REQUEST_CODE_EXISTS",
            message:
              "A procurement request with this code already exists in this organization.",
          });
        }

        throw updateError;
      }
    } catch (error) {
      console.error(
        "UPDATE PROCUREMENT REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "PROCUREMENT_UPDATE_FAILED",
        message:
          "Failed to update procurement request.",
      });
    }
  };

/* =========================================================
   UPDATE PROCUREMENT STATUS
========================================================= */

export const updateProcurementRequestStatus =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const id =
        getParam(req.params.id).trim();

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          code: "ORGANIZATION_CONTEXT_REQUIRED",
          message:
            "Organization context is required.",
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          code: "PROCUREMENT_REQUEST_ID_REQUIRED",
          message:
            "Procurement request ID is required.",
        });
      }

      const status =
        typeof req.body?.status ===
        "string"
          ? req.body.status
              .trim()
              .toUpperCase()
          : "";

      const allowedStatuses = [
        "PENDING",
        "APPROVED",
        "ORDERED",
        "DELIVERED",
        "REJECTED",
      ] as const;

      if (
        !allowedStatuses.includes(
          status as
            (typeof allowedStatuses)[number]
        )
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PROCUREMENT_STATUS",
          message:
            "Status must be PENDING, APPROVED, ORDERED, DELIVERED, or REJECTED.",
        });
      }

      const existing =
        await prisma.procurementRequest.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          code: "PROCUREMENT_REQUEST_NOT_FOUND",
          message:
            "Procurement request not found.",
        });
      }

      const request =
        await prisma.procurementRequest.update({
          where: {
            id,
          },
          data: {
            status,
          },
        });

      return res.status(200).json({
        success: true,
        message:
          "Procurement request status updated successfully.",
        request,
      });
    } catch (error) {
      console.error(
        "UPDATE PROCUREMENT STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "PROCUREMENT_STATUS_UPDATE_FAILED",
        message:
          "Failed to update procurement request status.",
      });
    }
  };