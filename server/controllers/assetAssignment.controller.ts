import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

function getTenantContext(req: AuthRequest) {
  if (
    !req.user?.userId ||
    !req.user?.organizationId
  ) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  if (
    sessionType &&
    sessionType !== "TENANT"
  ) {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function dateValue(
  value: unknown
): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

const employeeSelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  department: true,
  jobTitle: true,
  employmentType: true,
  hireDate: true,
  status: true,
};

const assetSelect = {
  id: true,
  assetCode: true,
  name: true,
  category: true,
  value: true,
  status: true,
  manufacturer: true,
  model: true,
  serialNumber: true,
  serviceTag: true,
  imei: true,
  imei2: true,
  phoneNumber: true,
  registrationNumber: true,
};

function serializeEmployee(employee: any) {
  if (!employee) {
    return null;
  }

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phoneNumber: employee.phoneNumber,
    department: employee.department,
    jobTitle: employee.jobTitle,
    employmentType: employee.employmentType,
    hireDate: employee.hireDate,
    status: employee.status,
  };
}

function serializeAsset(asset: any) {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    assetCode: asset.assetCode,
    name: asset.name,
    category: asset.category,
    value: Number(asset.value),
    status: asset.status,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    serviceTag: asset.serviceTag,
    imei: asset.imei,
    imei2: asset.imei2,
    phoneNumber: asset.phoneNumber,
    registrationNumber: asset.registrationNumber,
  };
}

function serializeAssignment(
  assignment: any
) {
  return {
    id: assignment.id,
    assetId: assignment.assetId,
    employeeId: assignment.employeeId,
    organizationId:
      assignment.organizationId,
    assignedAt: assignment.assignedAt,
    returnedAt: assignment.returnedAt,
    conditionAtAssignment:
      assignment.conditionAtAssignment,
    conditionAtReturn:
      assignment.conditionAtReturn,
    notes: assignment.notes,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    employee: serializeEmployee(
      assignment.employee
    ),
    asset: serializeAsset(
      assignment.asset
    ),
  };
}

/**
 * GET CURRENT ASSIGNMENT
 *
 * Returns the employee currently holding an asset.
 */
export const getCurrentAssignment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const assetId =
      stringValue(req.params.id);

    if (!assetId) {
      return res.status(400).json({
        success: false,
        code: "ASSET_ID_REQUIRED",
        message:
          "Asset ID is required.",
      });
    }

    const asset =
      await prisma.asset.findFirst({
        where: {
          id: assetId,
          organizationId:
            context.organizationId,
        },
        select: {
          id: true,
        },
      });

    if (!asset) {
      return res.status(404).json({
        success: false,
        code: "ASSET_NOT_FOUND",
        message:
          "Asset was not found.",
      });
    }

    const assignment =
      await prisma.assetAssignment.findFirst(
        {
          where: {
            assetId: asset.id,
            organizationId:
              context.organizationId,
            returnedAt: null,
          },
          orderBy: {
            assignedAt: "desc",
          },
          include: {
            employee: {
              select: employeeSelect,
            },
            asset: {
              select: assetSelect,
            },
          },
        }
      );

    return res.status(200).json({
      success: true,
      assignment:
        assignment
          ? serializeAssignment(
              assignment
            )
          : null,
    });
  } catch (error) {
    console.error(
      "[ASSET ASSIGNMENT] Failed to fetch current assignment:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_CURRENT_ASSIGNMENT_FETCH_FAILED",
      message:
        "Failed to fetch the current asset assignment.",
    });
  }
};

/**
 * GET ASSIGNMENT HISTORY
 *
 * Returns all historical assignments for an asset.
 */
export const getAssignmentHistory =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const assetId =
        stringValue(req.params.id);

      if (!assetId) {
        return res.status(400).json({
          success: false,
          code: "ASSET_ID_REQUIRED",
          message:
            "Asset ID is required.",
        });
      }

      const asset =
        await prisma.asset.findFirst({
          where: {
            id: assetId,
            organizationId:
              context.organizationId,
          },
          select: {
            id: true,
          },
        });

      if (!asset) {
        return res.status(404).json({
          success: false,
          code: "ASSET_NOT_FOUND",
          message:
            "Asset was not found.",
        });
      }

      const assignments =
        await prisma.assetAssignment.findMany(
          {
            where: {
              assetId: asset.id,
              organizationId:
                context.organizationId,
            },
            orderBy: {
              assignedAt: "desc",
            },
            include: {
              employee: {
                select: employeeSelect,
              },
              asset: {
                select: assetSelect,
              },
            },
          }
        );

      return res.status(200).json({
        success: true,
        assignments:
          assignments.map(
            serializeAssignment
          ),
      });
    } catch (error) {
      console.error(
        "[ASSET ASSIGNMENT] Failed to fetch assignment history:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "ASSET_ASSIGNMENT_HISTORY_FETCH_FAILED",
        message:
          "Failed to fetch asset assignment history.",
      });
    }
  };

/**
 * ASSIGN ASSET
 *
 * Assigns an asset to an employee.
 */
export const assignAsset = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const assetId =
      stringValue(req.params.id);

    const employeeName =
      stringValue(req.body?.employeeName)
        .replace(/\s+/g, " ")
        .trim();

    const conditionAtAssignment =
      stringValue(
        req.body?.conditionAtAssignment
      );

    const notes =
      stringValue(req.body?.notes);

    const assignedAtInput =
      req.body?.assignedAt;

    if (!assetId) {
      return res.status(400).json({
        success: false,
        code: "ASSET_ID_REQUIRED",
        message:
          "Asset ID is required.",
      });
    }

    if (!employeeName || employeeName.length < 3) {
      return res.status(400).json({
        success: false,
        code:
          "EMPLOYEE_NAME_REQUIRED",
        message:
          "Enter the full name of the person receiving this asset.",
      });
    }

    const assignedAt =
      assignedAtInput !== undefined
        ? dateValue(assignedAtInput)
        : new Date();

    if (!assignedAt) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_ASSIGNMENT_DATE",
        message:
          "A valid assignment date is required.",
      });
    }

    const asset =
      await prisma.asset.findFirst({
        where: {
          id: assetId,
          organizationId:
            context.organizationId,
        },
        select: assetSelect,
      });

    if (!asset) {
      return res.status(404).json({
        success: false,
        code: "ASSET_NOT_FOUND",
        message:
          "Asset was not found.",
      });
    }

    const nameParts =
      employeeName.split(" ");

    const firstName =
      nameParts.shift() || employeeName;

    const lastName =
      nameParts.join(" ") || "-";

    let employee =
      await prisma.employee.findFirst({
        where: {
          organizationId:
            context.organizationId,
          firstName: {
            equals: firstName,
            mode: "insensitive",
          },
          lastName: {
            equals: lastName,
            mode: "insensitive",
          },
        },
        select: employeeSelect,
      });

    if (!employee) {
      const employeeNumber =
        `MAN-${Date.now()}`;

      employee =
        await prisma.employee.create({
          data: {
            organizationId:
              context.organizationId,
            employeeNumber,
            firstName,
            lastName,
            hireDate: new Date(),
            basicSalary: 0,
            status: "ACTIVE",
          },
          select: employeeSelect,
        });
    }

    if (
      employee.status.toUpperCase() !==
      "ACTIVE"
    ) {
      return res.status(409).json({
        success: false,
        code:
          "EMPLOYEE_NOT_ACTIVE",
        message:
          "The asset can only be assigned to an active employee.",
      });
    }

    const currentAssignment =
      await prisma.assetAssignment.findFirst(
        {
          where: {
            assetId: asset.id,
            organizationId:
              context.organizationId,
            returnedAt: null,
          },
          orderBy: {
            assignedAt: "desc",
          },
        }
      );

    if (currentAssignment) {
      return res.status(409).json({
        success: false,
        code:
          "ASSET_ALREADY_ASSIGNED",
        message:
          "This asset is already assigned. Return the current assignment before assigning it again.",
      });
    }

    const assignment =
      await prisma.assetAssignment.create(
        {
          data: {
            assetId: asset.id,
            employeeId: employee.id,
            organizationId:
              context.organizationId,
            assignedAt,
            conditionAtAssignment:
              conditionAtAssignment ||
              null,
            notes:
              notes || null,
          },
          include: {
            employee: {
              select: employeeSelect,
            },
            asset: {
              select: assetSelect,
            },
          },
        }
      );

    return res.status(201).json({
      success: true,
      message:
        "Asset assigned successfully.",
      assignment:
        serializeAssignment(
          assignment
        ),
    });
  } catch (error) {
    console.error(
      "[ASSET ASSIGNMENT] Failed to assign asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_ASSIGNMENT_CREATE_FAILED",
      message:
        "Failed to assign asset.",
    });
  }
};

/**
 * RETURN ASSET
 *
 * Closes the current assignment.
 * The historical record remains in the database.
 */
export const returnAsset = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const assetId =
      stringValue(req.params.id);

    const conditionAtReturn =
      stringValue(
        req.body?.conditionAtReturn
      );

    const notes =
      stringValue(req.body?.notes);

    if (!assetId) {
      return res.status(400).json({
        success: false,
        code: "ASSET_ID_REQUIRED",
        message:
          "Asset ID is required.",
      });
    }

    const asset =
      await prisma.asset.findFirst({
        where: {
          id: assetId,
          organizationId:
            context.organizationId,
        },
        select: assetSelect,
      });

    if (!asset) {
      return res.status(404).json({
        success: false,
        code: "ASSET_NOT_FOUND",
        message:
          "Asset was not found.",
      });
    }

    const assignment =
      await prisma.assetAssignment.findFirst(
        {
          where: {
            assetId: asset.id,
            organizationId:
              context.organizationId,
            returnedAt: null,
          },
          orderBy: {
            assignedAt: "desc",
          },
        }
      );

    if (!assignment) {
      return res.status(409).json({
        success: false,
        code:
          "ASSET_NOT_CURRENTLY_ASSIGNED",
        message:
          "This asset does not have an active assignment.",
      });
    }

    const returnedAt =
      new Date();

    const updatedAssignment =
      await prisma.assetAssignment.update(
        {
          where: {
            id: assignment.id,
          },
          data: {
            returnedAt,
            conditionAtReturn:
              conditionAtReturn ||
              null,
            ...(notes
              ? {
                  notes:
                    assignment.notes
                      ? `${assignment.notes}\n${notes}`
                      : notes,
                }
              : {}),
          },
          include: {
            employee: {
              select: employeeSelect,
            },
            asset: {
              select: assetSelect,
            },
          },
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "Asset returned successfully.",
      assignment:
        serializeAssignment(
          updatedAssignment
        ),
    });
  } catch (error) {
    console.error(
      "[ASSET ASSIGNMENT] Failed to return asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_ASSIGNMENT_RETURN_FAILED",
      message:
        "Failed to return asset.",
    });
  }
};

/**
 * REASSIGN ASSET
 *
 * Closes the existing assignment and
 * creates a new assignment for another employee.
 */
export const reassignAsset = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const assetId =
      stringValue(req.params.id);

    const employeeId =
      stringValue(req.body?.employeeId);

    const conditionAtReturn =
      stringValue(
        req.body?.conditionAtReturn
      );

    const conditionAtAssignment =
      stringValue(
        req.body?.conditionAtAssignment
      );

    const notes =
      stringValue(req.body?.notes);

    if (!assetId) {
      return res.status(400).json({
        success: false,
        code: "ASSET_ID_REQUIRED",
        message:
          "Asset ID is required.",
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code:
          "EMPLOYEE_ID_REQUIRED",
        message:
          "Employee ID is required.",
      });
    }

    const asset =
      await prisma.asset.findFirst({
        where: {
          id: assetId,
          organizationId:
            context.organizationId,
        },
        select: assetSelect,
      });

    if (!asset) {
      return res.status(404).json({
        success: false,
        code: "ASSET_NOT_FOUND",
        message:
          "Asset was not found.",
      });
    }

    const employee =
      await prisma.employee.findFirst({
        where: {
          id: employeeId,
          organizationId:
            context.organizationId,
        },
        select: employeeSelect,
      });

    if (!employee) {
      return res.status(404).json({
        success: false,
        code:
          "EMPLOYEE_NOT_FOUND",
        message:
          "Employee was not found.",
      });
    }

    if (
      employee.status.toUpperCase() !==
      "ACTIVE"
    ) {
      return res.status(409).json({
        success: false,
        code:
          "EMPLOYEE_NOT_ACTIVE",
        message:
          "The asset can only be assigned to an active employee.",
      });
    }

    const currentAssignment =
      await prisma.assetAssignment.findFirst(
        {
          where: {
            assetId: asset.id,
            organizationId:
              context.organizationId,
            returnedAt: null,
          },
          orderBy: {
            assignedAt: "desc",
          },
        }
      );

    if (!currentAssignment) {
      return res.status(409).json({
        success: false,
        code:
          "ASSET_NOT_CURRENTLY_ASSIGNED",
        message:
          "This asset does not have an active assignment. Use assign instead.",
      });
    }

    if (
      currentAssignment.employeeId ===
      employee.id
    ) {
      return res.status(409).json({
        success: false,
        code:
          "ASSET_ALREADY_ASSIGNED_TO_EMPLOYEE",
        message:
          "This asset is already assigned to this employee.",
      });
    }

    const now = new Date();

    const result =
      await prisma.$transaction(
        async (tx) => {
          const closedAssignment =
            await tx.assetAssignment.update(
              {
                where: {
                  id:
                    currentAssignment.id,
                },
                data: {
                  returnedAt: now,
                  conditionAtReturn:
                    conditionAtReturn ||
                    null,
                  ...(notes
                    ? {
                        notes:
                          currentAssignment.notes
                            ? `${currentAssignment.notes}\n${notes}`
                            : notes,
                      }
                    : {}),
                },
              }
            );

          const newAssignment =
            await tx.assetAssignment.create(
              {
                data: {
                  assetId: asset.id,
                  employeeId:
                    employee.id,
                  organizationId:
                    context.organizationId,
                  assignedAt: now,
                  conditionAtAssignment:
                    conditionAtAssignment ||
                    null,
                  notes:
                    notes || null,
                },
                include: {
                  employee: {
                    select:
                      employeeSelect,
                  },
                  asset: {
                    select:
                      assetSelect,
                  },
                },
              }
            );

          return {
            closedAssignment,
            newAssignment,
          };
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "Asset reassigned successfully.",
      previousAssignment:
        result.closedAssignment,
      assignment:
        serializeAssignment(
          result.newAssignment
        ),
    });
  } catch (error) {
    console.error(
      "[ASSET ASSIGNMENT] Failed to reassign asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_REASSIGN_FAILED",
      message:
        "Failed to reassign asset.",
    });
  }
};

/**
 * GET EMPLOYEE ASSETS
 *
 * Returns all current and historical
 * asset assignments for an employee.
 *
 * This lets HR open an employee and see
 * every asset assigned to that employee.
 */
export const getEmployeeAssignments =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const employeeId =
        stringValue(
          req.params.employeeId
        );

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          code:
            "EMPLOYEE_ID_REQUIRED",
          message:
            "Employee ID is required.",
        });
      }

      const employee =
        await prisma.employee.findFirst({
          where: {
            id: employeeId,
            organizationId:
              context.organizationId,
          },
          select: employeeSelect,
        });

      if (!employee) {
        return res.status(404).json({
          success: false,
          code:
            "EMPLOYEE_NOT_FOUND",
          message:
            "Employee was not found.",
        });
      }

      const assignments =
        await prisma.assetAssignment.findMany(
          {
            where: {
              employeeId: employee.id,
              organizationId:
                context.organizationId,
            },
            orderBy: {
              assignedAt: "desc",
            },
            include: {
              employee: {
                select: employeeSelect,
              },
              asset: {
                select: assetSelect,
              },
            },
          }
        );

      return res.status(200).json({
        success: true,
        employee:
          serializeEmployee(
            employee
          ),
        assignments:
          assignments.map(
            serializeAssignment
          ),
      });
    } catch (error) {
      console.error(
        "[ASSET ASSIGNMENT] Failed to fetch employee assignments:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "EMPLOYEE_ASSET_ASSIGNMENTS_FETCH_FAILED",
        message:
          "Failed to fetch employee asset assignments.",
      });
    }
  };
