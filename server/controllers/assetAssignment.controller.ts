import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  if (sessionType && sessionType !== "TENANT") {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

  processor: true,
  ram: true,
  storage: true,
  storageType: true,
  operatingSystem: true,
  osVersion: true,
  macAddress: true,
  hostname: true,

  imei: true,
  imei2: true,
  phoneNumber: true,
  simIccid: true,
  carrier: true,
  storageCapacity: true,
  color: true,
  enrollmentStatus: true,
  mdmDeviceId: true,

  registrationNumber: true,
  vin: true,
  chassisNumber: true,
  engineNumber: true,
  year: true,
  vehicleType: true,
  bodyType: true,
  fuelType: true,
  fuelCapacity: true,
  transmission: true,
  odometer: true,
  engineHours: true,

  purchaseDate: true,
  purchaseCost: true,
  currentBookValue: true,
  condition: true,
  location: true,
  vendor: true,
  warrantyStart: true,
  warrantyEnd: true,
  notes: true,

  insurancePolicyNumber: true,
  insuranceExpiry: true,
  registrationExpiry: true,
  inspectionExpiry: true,

  lastServiceDate: true,
  nextServiceDate: true,
  maintenanceNotes: true,

  accumulatedDepreciation: true,
  residualValue: true,
  depreciationMethod: true,
  usefulLife: true,
  depreciationStartDate: true,
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
    value: Number(asset.value ?? 0),
    status: asset.status,

    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    serviceTag: asset.serviceTag,

    processor: asset.processor,
    ram: asset.ram,
    storage: asset.storage,
    storageType: asset.storageType,
    operatingSystem: asset.operatingSystem,
    osVersion: asset.osVersion,
    macAddress: asset.macAddress,
    hostname: asset.hostname,

    imei: asset.imei,
    imei2: asset.imei2,
    phoneNumber: asset.phoneNumber,
    simIccid: asset.simIccid,
    carrier: asset.carrier,
    storageCapacity: asset.storageCapacity,
    color: asset.color,
    enrollmentStatus: asset.enrollmentStatus,
    mdmDeviceId: asset.mdmDeviceId,

    registrationNumber: asset.registrationNumber,
    vin: asset.vin,
    chassisNumber: asset.chassisNumber,
    engineNumber: asset.engineNumber,
    year: asset.year,
    vehicleType: asset.vehicleType,
    bodyType: asset.bodyType,
    fuelType: asset.fuelType,
    fuelCapacity: asset.fuelCapacity,
    transmission: asset.transmission,
    odometer: asset.odometer,
    engineHours: asset.engineHours,

    purchaseDate: asset.purchaseDate,
    purchaseCost:
      asset.purchaseCost !== null &&
      asset.purchaseCost !== undefined
        ? Number(asset.purchaseCost)
        : null,
    currentBookValue:
      asset.currentBookValue !== null &&
      asset.currentBookValue !== undefined
        ? Number(asset.currentBookValue)
        : null,
    condition: asset.condition,
    location: asset.location,
    vendor: asset.vendor,
    warrantyStart: asset.warrantyStart,
    warrantyEnd: asset.warrantyEnd,
    notes: asset.notes,

    insurancePolicyNumber: asset.insurancePolicyNumber,
    insuranceExpiry: asset.insuranceExpiry,
    registrationExpiry: asset.registrationExpiry,
    inspectionExpiry: asset.inspectionExpiry,

    lastServiceDate: asset.lastServiceDate,
    nextServiceDate: asset.nextServiceDate,
    maintenanceNotes: asset.maintenanceNotes,

    accumulatedDepreciation:
      asset.accumulatedDepreciation !== null &&
      asset.accumulatedDepreciation !== undefined
        ? Number(asset.accumulatedDepreciation)
        : null,
    residualValue:
      asset.residualValue !== null &&
      asset.residualValue !== undefined
        ? Number(asset.residualValue)
        : null,
    depreciationMethod: asset.depreciationMethod,
    usefulLife: asset.usefulLife,
    depreciationStartDate: asset.depreciationStartDate,
  };
}

function serializeAssignment(assignment: any) {
  return {
    id: assignment.id,
    assetId: assignment.assetId,
    employeeId: assignment.employeeId,
    organizationId: assignment.organizationId,

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
 * GET ASSIGNMENT REGISTER
 *
 * Returns the tenant's assignment register.
 *
 * Supported query parameters:
 *
 * search
 * - employee first name
 * - employee last name
 * - employee number
 * - employee email
 * - asset code
 * - asset name
 * - manufacturer
 * - model
 * - serial number
 * - service tag
 * - IMEI
 * - IMEI2
 * - registration number
 *
 * status
 * - ASSIGNED
 * - RETURNED
 * - ALL / empty
 *
 * department
 *
 * page
 *
 * pageSize
 *
 * GET /api/asset-assignments
 */
export const getAssignmentRegister = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const search = stringValue(
      req.query.search
    );

    const status = stringValue(
      req.query.status
    ).toUpperCase();

    const department = stringValue(
      req.query.department
    );

    const requestedPage = Number.parseInt(
      stringValue(req.query.page) || "1",
      10
    );

    const requestedPageSize = Number.parseInt(
      stringValue(req.query.pageSize) || "20",
      10
    );

    const pageSize = Number.isFinite(
      requestedPageSize
    )
      ? Math.min(
          100,
          Math.max(1, requestedPageSize)
        )
      : 20;

    /*
     * Build the tenant-scoped assignment query.
     *
     * Every assignment belongs to the current
     * organization. Employee and asset searches
     * are additionally evaluated through their
     * tenant-scoped relations.
     */
    const where: any = {
      organizationId:
        context.organizationId,
    };

    /*
     * Assignment status filter.
     */
    if (status === "ASSIGNED") {
      where.returnedAt = null;
    } else if (status === "RETURNED") {
      where.returnedAt = {
        not: null,
      };
    }

    /*
     * Department filter.
     */
    if (department) {
      where.employee = {
        department: {
          equals: department,
          mode: "insensitive",
        },
      };
    }

    /*
     * Global assignment register search.
     *
     * A single search box can locate either
     * the employee or the asset.
     */
    if (search) {
      const searchConditions = [
        {
          employee: {
            firstName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            lastName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            employeeNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            assetCode: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            manufacturer: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            model: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            serialNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            serviceTag: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            imei: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            imei2: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            registrationNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];

      /*
       * Preserve the department constraint while
       * allowing the global search to match either
       * employee or asset information.
       */
      if (department) {
        where.AND = [
          {
            employee: {
              department: {
                equals: department,
                mode: "insensitive",
              },
            },
          },
          {
            OR: searchConditions,
          },
        ];

        delete where.employee;
      } else {
        where.OR = searchConditions;
      }
    }

    /*
     * Fetch totals and status counts using the
     * same tenant/filter scope.
     */
    const total = await prisma.assetAssignment.count({
      where,
    });

    const assignedWhere: any = {
      organizationId:
        context.organizationId,
      returnedAt: null,
    };

    const returnedWhere: any = {
      organizationId:
        context.organizationId,
      returnedAt: {
        not: null,
      },
    };

    if (department) {
      assignedWhere.employee = {
        department: {
          equals: department,
          mode: "insensitive",
        },
      };

      returnedWhere.employee = {
        department: {
          equals: department,
          mode: "insensitive",
        },
      };
    }

    if (search) {
      const searchConditions = [
        {
          employee: {
            firstName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            lastName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            employeeNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            assetCode: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            manufacturer: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            model: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            serialNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            serviceTag: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            imei: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            imei2: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          asset: {
            registrationNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];

      if (department) {
        assignedWhere.AND = [
          {
            employee: {
              department: {
                equals: department,
                mode: "insensitive",
              },
            },
          },
          {
            OR: searchConditions,
          },
        ];

        delete assignedWhere.employee;

        returnedWhere.AND = [
          {
            employee: {
              department: {
                equals: department,
                mode: "insensitive",
              },
            },
          },
          {
            OR: searchConditions,
          },
        ];

        delete returnedWhere.employee;
      } else {
        assignedWhere.OR = searchConditions;
        returnedWhere.OR = searchConditions;
      }
    }

    const [
      assignedCount,
      returnedCount,
    ] = await prisma.$transaction([
      prisma.assetAssignment.count({
        where: assignedWhere,
      }),
      prisma.assetAssignment.count({
        where: returnedWhere,
      }),
    ]);

    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize)
    );

    const page = Number.isFinite(
      requestedPage
    )
      ? Math.min(
          totalPages,
          Math.max(1, requestedPage)
        )
      : 1;

    const assignments =
      await prisma.assetAssignment.findMany({
        where,
        orderBy: [
          {
            assignedAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          employee: {
            select: employeeSelect,
          },
          asset: {
            select: assetSelect,
          },
        },
      });

    return res.status(200).json({
      success: true,

      assignments:
        assignments.map(
          serializeAssignment
        ),

      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },

      summary: {
        totalAssignments: total,
        assignedCount,
        returnedCount,
      },
    });
  } catch (error) {
    console.error(
      "[ASSET ASSIGNMENT] Failed to fetch assignment register:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_ASSIGNMENT_REGISTER_FETCH_FAILED",
      message:
        "Failed to fetch the asset assignment register.",
    });
  }
};

/**
 * GET CURRENT ASSIGNMENT
 *
 * Returns the employee currently holding an asset.
 *
 * GET /api/asset-assignments/assets/:id/current
 */
export const getCurrentAssignment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const assetId = stringValue(
      req.params.id
    );

    if (!assetId) {
      return res.status(400).json({
        success: false,
        code: "ASSET_ID_REQUIRED",
        message: "Asset ID is required.",
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
        message: "Asset was not found.",
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
      assignment: assignment
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
 *
 * GET /api/asset-assignments/assets/:id/history
 */
export const getAssignmentHistory =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context = getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const assetId = stringValue(
        req.params.id
      );

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
 * Assigns an asset to an active employee.
 *
 * POST /api/asset-assignments/assets/:id/assign
 */
export const assignAsset = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const assetId = stringValue(
      req.params.id
    );

    const employeeId = stringValue(
      req.body?.employeeId
    );

    const conditionAtAssignment =
      stringValue(
        req.body?.conditionAtAssignment
      );

    const notes = stringValue(
      req.body?.notes
    );

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

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code:
          "EMPLOYEE_ID_REQUIRED",
        message:
          "Employee ID is required.",
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
        code: "EMPLOYEE_NOT_FOUND",
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
            notes: notes || null,
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
 *
 * POST /api/asset-assignments/assets/:id/return
 */
export const returnAsset = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const assetId = stringValue(
      req.params.id
    );

    const conditionAtReturn =
      stringValue(
        req.body?.conditionAtReturn
      );

    const notes = stringValue(
      req.body?.notes
    );

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

    const returnedAt = new Date();

    const updatedAssignment =
      await prisma.assetAssignment.update(
        {
          where: {
            id: assignment.id,
          },
          data: {
            returnedAt,
            conditionAtReturn:
              conditionAtReturn || null,
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
 * Closes the existing assignment and creates
 * a new assignment for another active employee.
 *
 * POST /api/asset-assignments/assets/:id/reassign
 */
export const reassignAsset = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const assetId = stringValue(
      req.params.id
    );

    const employeeId = stringValue(
      req.body?.employeeId
    );

    const conditionAtReturn =
      stringValue(
        req.body?.conditionAtReturn
      );

    const conditionAtAssignment =
      stringValue(
        req.body?.conditionAtAssignment
      );

    const notes = stringValue(
      req.body?.notes
    );

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
 * GET /api/asset-assignments/employees/:employeeId/assets
 */
export const getEmployeeAssignments =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context = getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const employeeId = stringValue(
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
              employeeId:
                employee.id,
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