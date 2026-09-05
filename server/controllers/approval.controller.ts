import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

/* =========================================================
   GET APPROVALS
========================================================= */

export const getApprovals = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const approvals =
      await prisma.approval.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.json({
      success: true,
      approvals,
    });
  } catch (error) {
    console.error(
      "GET APPROVALS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load approvals.",
    });
  }
};

/* =========================================================
   APPROVE REQUEST
========================================================= */

export const approveApproval = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const approvalId =
      String(req.params.id);

    if (!approvalId) {
      return res.status(400).json({
        success: false,
        message:
          "Approval ID is required.",
      });
    }

    /* =====================================================
       FIND APPROVAL INSIDE CURRENT TENANT
    ===================================================== */

    const approval =
      await prisma.approval.findFirst({
        where: {
          id: approvalId,
          organizationId,
        },
      });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message:
          "Approval request not found.",
      });
    }

    /* =====================================================
       PREVENT INVALID STATE TRANSITION
    ===================================================== */

    if (approval.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message:
          `This approval is already ${approval.status.toLowerCase()}.`,
      });
    }

    /* =====================================================
       APPROVE APPROVAL + CONNECTED EXPENSE
    ===================================================== */

    const result =
      await prisma.$transaction(
        async (tx) => {
          const updatedApproval =
            await tx.approval.update({
              where: {
                id: approval.id,
              },
              data: {
                status: "APPROVED",
              },
            });

          /*
           * Expense approvals are linked through
           * Expense.approvalId.
           *
           * Keep this restricted to the authenticated
           * organization so an approval cannot update
           * another tenant's expense.
           */
          if (approval.module === "EXPENSE") {
            await tx.expense.updateMany({
              where: {
                approvalId: approval.id,
                organizationId,
                status: "PENDING_APPROVAL",
              },
              data: {
                status: "APPROVED",
              },
            });
          }

          return updatedApproval;
        }
      );

    return res.json({
      success: true,
      message:
        "Approval request approved successfully.",
      approval: result,
    });
  } catch (error) {
    console.error(
      "APPROVE APPROVAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to approve approval request.",
    });
  }
};

/* =========================================================
   REJECT REQUEST
========================================================= */

export const rejectApproval = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const approvalId =
      String(req.params.id);

    if (!approvalId) {
      return res.status(400).json({
        success: false,
        message:
          "Approval ID is required.",
      });
    }

    /* =====================================================
       FIND APPROVAL INSIDE CURRENT TENANT
    ===================================================== */

    const approval =
      await prisma.approval.findFirst({
        where: {
          id: approvalId,
          organizationId,
        },
      });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message:
          "Approval request not found.",
      });
    }

    /* =====================================================
       PREVENT INVALID STATE TRANSITION
    ===================================================== */

    if (approval.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message:
          `This approval is already ${approval.status.toLowerCase()}.`,
      });
    }

    /* =====================================================
       REJECT APPROVAL + CONNECTED EXPENSE
    ===================================================== */

    const result =
      await prisma.$transaction(
        async (tx) => {
          const updatedApproval =
            await tx.approval.update({
              where: {
                id: approval.id,
              },
              data: {
                status: "REJECTED",
              },
            });

          /*
           * Only update Expenses belonging to this tenant
           * and currently waiting for this approval.
           */
          if (approval.module === "EXPENSE") {
            await tx.expense.updateMany({
              where: {
                approvalId: approval.id,
                organizationId,
                status: "PENDING_APPROVAL",
              },
              data: {
                status: "REJECTED",
              },
            });
          }

          return updatedApproval;
        }
      );

    return res.json({
      success: true,
      message:
        "Approval request rejected successfully.",
      approval: result,
    });
  } catch (error) {
    console.error(
      "REJECT APPROVAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reject approval request.",
    });
  }
};
