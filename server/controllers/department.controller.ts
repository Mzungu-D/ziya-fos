import type { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   TENANT CONTEXT
========================================================= */

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

/* =========================================================
   INPUT HELPERS
========================================================= */

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  const valueString = stringValue(value);
  return valueString || null;
}

/* =========================================================
   SERIALIZATION
========================================================= */

function serializeDepartment(department: any) {
  return {
    id: department.id,
    organizationId: department.organizationId,
    name: department.name,
    code: department.code,
    description: department.description,
    status: department.status,
    employeeCount: department._count?.employees ?? 0,
    positionCount: department._count?.positions ?? 0,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}

/* =========================================================
   GET DEPARTMENTS
   GET /api/departments
========================================================= */

export const getDepartments = async (
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

    const search = stringValue(req.query.search);

    const status =
      stringValue(req.query.status).toUpperCase() || undefined;

    const departments = await prisma.department.findMany({
      where: {
        organizationId: context.organizationId,

        ...(status
          ? {
              status,
            }
          : {}),

        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  code: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },

      include: {
        _count: {
          select: {
            employees: true,
            positions: true,
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      departments: departments.map(serializeDepartment),
      count: departments.length,
    });
  } catch (error) {
    console.error(
      "[DEPARTMENTS] Failed to fetch departments:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "DEPARTMENT_FETCH_FAILED",
      message: "Failed to fetch departments.",
    });
  }
};

/* =========================================================
   GET SINGLE DEPARTMENT
   GET /api/departments/:id
========================================================= */

export const getDepartment = async (
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

    const id = stringValue(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "DEPARTMENT_ID_REQUIRED",
        message: "Department ID is required.",
      });
    }

    const department = await prisma.department.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },

      include: {
        _count: {
          select: {
            employees: true,
            positions: true,
          },
        },

        positions: {
          where: {
            organizationId: context.organizationId,
          },

          orderBy: {
            title: "asc",
          },

          include: {
            _count: {
              select: {
                employees: true,
              },
            },
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        code: "DEPARTMENT_NOT_FOUND",
        message: "Department was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      department: {
        ...serializeDepartment(department),
        positions: department.positions.map(
          (position) => ({
            id: position.id,
            title: position.title,
            code: position.code,
            description: position.description,
            status: position.status,
            employeeCount:
              position._count?.employees ?? 0,
          })
        ),
      },
    });
  } catch (error) {
    console.error(
      "[DEPARTMENTS] Failed to fetch department:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "DEPARTMENT_FETCH_FAILED",
      message: "Failed to fetch department.",
    });
  }
};

/* =========================================================
   CREATE DEPARTMENT
   POST /api/departments
========================================================= */

export const createDepartment = async (
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

    const name = stringValue(req.body?.name);
    const code = nullableString(req.body?.code);
    const description = nullableString(
      req.body?.description
    );

    if (!name) {
      return res.status(400).json({
        success: false,
        code: "DEPARTMENT_NAME_REQUIRED",
        message: "Department name is required.",
      });
    }

    const existing = await prisma.department.findFirst({
      where: {
        organizationId: context.organizationId,
        name,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        code: "DEPARTMENT_NAME_EXISTS",
        message:
          "A department with this name already exists.",
      });
    }

    if (code) {
      const existingCode =
        await prisma.department.findFirst({
          where: {
            organizationId: context.organizationId,
            code,
          },
        });

      if (existingCode) {
        return res.status(409).json({
          success: false,
          code: "DEPARTMENT_CODE_EXISTS",
          message:
            "A department with this code already exists.",
        });
      }
    }

    const department = await prisma.department.create({
      data: {
        organizationId: context.organizationId,
        name,
        code,
        description,
        status: "ACTIVE",
      },

      include: {
        _count: {
          select: {
            employees: true,
            positions: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Department created successfully.",
      department: serializeDepartment(department),
    });
  } catch (error) {
    console.error(
      "[DEPARTMENTS] Failed to create department:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "DEPARTMENT_DUPLICATE",
        message:
          "A department with the same name or code already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "DEPARTMENT_CREATE_FAILED",
      message: "Failed to create department.",
    });
  }
};

/* =========================================================
   UPDATE DEPARTMENT
   PATCH /api/departments/:id
========================================================= */

export const updateDepartment = async (
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

    const id = stringValue(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "DEPARTMENT_ID_REQUIRED",
        message: "Department ID is required.",
      });
    }

    const existing = await prisma.department.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "DEPARTMENT_NOT_FOUND",
        message: "Department was not found.",
      });
    }

    const data: Prisma.DepartmentUpdateInput = {};

    if (req.body?.name !== undefined) {
      const name = stringValue(req.body.name);

      if (!name) {
        return res.status(400).json({
          success: false,
          code: "DEPARTMENT_NAME_REQUIRED",
          message: "Department name cannot be empty.",
        });
      }

      const duplicate =
        await prisma.department.findFirst({
          where: {
            organizationId: context.organizationId,
            name,
            NOT: {
              id,
            },
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          code: "DEPARTMENT_NAME_EXISTS",
          message:
            "A department with this name already exists.",
        });
      }

      data.name = name;
    }

    if (req.body?.code !== undefined) {
      const code = nullableString(req.body.code);

      if (code) {
        const duplicate =
          await prisma.department.findFirst({
            where: {
              organizationId: context.organizationId,
              code,
              NOT: {
                id,
              },
            },
          });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            code: "DEPARTMENT_CODE_EXISTS",
            message:
              "A department with this code already exists.",
          });
        }
      }

      data.code = code;
    }

    if (req.body?.description !== undefined) {
      data.description =
        nullableString(req.body.description);
    }

    if (req.body?.status !== undefined) {
      const status =
        stringValue(req.body.status).toUpperCase();

      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_DEPARTMENT_STATUS",
          message:
            "Department status must be ACTIVE or INACTIVE.",
        });
      }

      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_UPDATE_FIELDS",
        message:
          "No department fields were provided for update.",
      });
    }

    const department = await prisma.department.update({
      where: {
        id: existing.id,
      },

      data,

      include: {
        _count: {
          select: {
            employees: true,
            positions: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Department updated successfully.",
      department: serializeDepartment(department),
    });
  } catch (error) {
    console.error(
      "[DEPARTMENTS] Failed to update department:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "DEPARTMENT_DUPLICATE",
        message:
          "The department name or code conflicts with an existing record.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "DEPARTMENT_UPDATE_FAILED",
      message: "Failed to update department.",
    });
  }
};

/* =========================================================
   DELETE / DEACTIVATE DEPARTMENT
   DELETE /api/departments/:id

   We deactivate instead of physically deleting because
   departments are HR master records.
========================================================= */

export const deleteDepartment = async (
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

    const id = stringValue(req.params.id);

    const department = await prisma.department.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },

      include: {
        _count: {
          select: {
            employees: true,
            positions: true,
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        code: "DEPARTMENT_NOT_FOUND",
        message: "Department was not found.",
      });
    }

    if (department._count.employees > 0) {
      return res.status(409).json({
        success: false,
        code: "DEPARTMENT_HAS_EMPLOYEES",
        message:
          "This department cannot be deactivated while employees are assigned to it.",
      });
    }

    await prisma.department.update({
      where: {
        id: department.id,
      },

      data: {
        status: "INACTIVE",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Department deactivated successfully.",
    });
  } catch (error) {
    console.error(
      "[DEPARTMENTS] Failed to deactivate department:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "DEPARTMENT_DELETE_FAILED",
      message: "Failed to deactivate department.",
    });
  }
};