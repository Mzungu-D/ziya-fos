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

    const approvals = await prisma.approval.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const userIds = Array.from(
      new Set(
        approvals.flatMap((approval) =>
          [approval.requestedBy, approval.actionedBy].filter(
            (id): id is string => Boolean(id)
          )
        )
      )
    );

    const users = userIds.length
      ? await prisma.user.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];

    const userMap = new Map(
      users.map((user) => [user.id, user])
    );

    const enrichedApprovals = approvals.map((approval) => ({
      ...approval,
      requestedByUser: userMap.get(approval.requestedBy) ?? null,
      actionedByUser: approval.actionedBy
        ? userMap.get(approval.actionedBy) ?? null
        : null,
    }));

    return res.json({
      success: true,
      approvals: enrichedApprovals,
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

    const approval = await prisma.approval.findFirst({
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
          const approvalUpdate = await tx.approval.updateMany({
            where: {
              id: approval.id,
              organizationId,
              status: "PENDING",
            },
            data: {
              status: "APPROVED",
              actionedBy: req.user?.userId ?? null,
              actionedAt: new Date(),
            },
          });

          if (approvalUpdate.count !== 1) {
            throw new Error("APPROVAL_ALREADY_ACTIONED");
          }

          const updatedApproval = await tx.approval.findUnique({
            where: { id: approval.id },
          });

          /*
           * Expense approvals are linked through
           * Expense.approvalId.
           *
           * Keep this restricted to the authenticated
           * organization so an approval cannot update
           * another tenant's expense.
           */
          if (approval.module === "EXPENSE_PAYMENT") {
            const expense = await tx.expense.findFirst({
              where: {
                paymentApprovalId: approval.id,
                organizationId,
                status: "POSTED",
                paymentStatus: "PENDING_APPROVAL",
              },
            });

            if (!expense) {
              throw new Error("PAYMENT_EXPENSE_NOT_FOUND");
            }

            await tx.expense.update({
              where: {
                id: expense.id,
              },
              data: {
                paymentStatus: "PAID",
                
              },
            });
          }
          
    if (approval.module === "PROCUREMENT") {
      const procurementRequest =
        await tx.procurementRequest.findFirst({
          where: {
            approvalId: approval.id,
            organizationId,
            status: "PENDING",
          },
        });

      if (!procurementRequest) {
        throw new Error("PROCUREMENT_REQUEST_NOT_FOUND");
      }

      await tx.procurementRequest.update({
        where: {
          id: procurementRequest.id,
        },
        data: {
          status: "APPROVED",
        },
      });

      await tx.auditTrail.create({
        data: {
          user: req.user?.userId ?? "SYSTEM",
          action: "APPROVED",
          module: "PROCUREMENT",
          details: JSON.stringify({
            procurementRequestId: procurementRequest.id,
            requestCode: procurementRequest.requestCode,
            approvalId: approval.id,
          }),
          organizationId,
        },
      });
    }

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

    const approval = await prisma.approval.findFirst({
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
          const approvalUpdate = await tx.approval.updateMany({
            where: {
              id: approval.id,
              organizationId,
              status: "PENDING",
            },
            data: {
              status: "REJECTED",
              actionedBy: req.user?.userId ?? null,
              actionedAt: new Date(),
            },
          });

          if (approvalUpdate.count !== 1) {
            throw new Error("APPROVAL_ALREADY_ACTIONED");
          }

          const updatedApproval = await tx.approval.findUnique({
            where: { id: approval.id },
          });

          /*
           * Only update Expenses belonging to this tenant
           * and currently waiting for this approval.
           */
          if (approval.module === "EXPENSE_PAYMENT") {
            const expense = await tx.expense.findFirst({
              where: {
                paymentApprovalId: approval.id,
                organizationId,
                status: "POSTED",
                paymentStatus: "PENDING_APPROVAL",
              },
            });

            if (!expense) {
              throw new Error("PAYMENT_EXPENSE_NOT_FOUND");
            }

            await tx.expense.update({
              where: {
                id: expense.id,
              },
              data: {
                paymentStatus: "UNPAID",
                paymentApprovalId: null,
              },
            });
          }
          
    if (approval.module === "PROCUREMENT") {
      const procurementRequest =
        await tx.procurementRequest.findFirst({
          where: {
            approvalId: approval.id,
            organizationId,
            status: "PENDING",
          },
        });

      if (!procurementRequest) {
        throw new Error("PROCUREMENT_REQUEST_NOT_FOUND");
      }

      await tx.procurementRequest.update({
        where: {
          id: procurementRequest.id,
        },
        data: {
          status: "REJECTED",
        },
      });

      await tx.auditTrail.create({
        data: {
          user: req.user?.userId ?? "SYSTEM",
          action: "REJECTED",
          module: "PROCUREMENT",
          details: JSON.stringify({
            procurementRequestId: procurementRequest.id,
            requestCode: procurementRequest.requestCode,
            approvalId: approval.id,
          }),
          organizationId,
        },
      });
    }

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








