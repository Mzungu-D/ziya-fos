import type { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   TENANT CONTEXT
========================================================= */

function getTenantContext(req: AuthRequest) {
  const userId = req.user?.userId;
  const organizationId = req.user?.organizationId;
  const sessionType = req.user?.sessionType;

  if (
    !userId ||
    !organizationId ||
    sessionType !== "TENANT"
  ) {
    return null;
  }

  return {
    userId,
    organizationId,
  };
}

/* =========================================================
   HELPERS
========================================================= */

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const result = stringValue(value);

  return result || undefined;
}

function nullableString(
  value: unknown
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const result = stringValue(value);

  return result || null;
}

function getRouteId(req: AuthRequest): string {
  const rawId = req.params.id;

  return Array.isArray(rawId)
    ? rawId[0] ?? ""
    : rawId ?? "";
}

/* =========================================================
   SERIALIZATION
========================================================= */

function serializePosition(position: any) {
  return {
    id: position.id,
    organizationId: position.organizationId,

    title: position.title,
    code: position.code,
    description: position.description,
    status: position.status,

    departmentId: position.departmentId,

    department: position.department
      ? {
          id: position.department.id,
          name: position.department.name,
          code: position.department.code,
          status: position.department.status,
        }
      : null,

    employeeCount:
      position._count?.employees ?? 0,

    createdAt: position.createdAt,
    updatedAt: position.updatedAt,
  };
}

/* =========================================================
   GET POSITIONS
   GET /api/positions
========================================================= */

export async function getPositions(
  req: AuthRequest,
  res: Response
) {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(401).json({
        message: "Tenant authentication required",
      });
    }

    const search = stringValue(req.query.search);
    const departmentId = stringValue(
      req.query.departmentId
    );
    const status = stringValue(req.query.status);

    const positions = await prisma.position.findMany({
      where: {
        organizationId: context.organizationId,

        ...(search
          ? {
              OR: [
                {
                  title: {
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

        ...(departmentId
          ? {
              departmentId,
            }
          : {}),

        ...(status
          ? {
              status,
            }
          : {}),
      },

      include: {
        department: true,

        _count: {
          select: {
            employees: true,
          },
        },
      },

      orderBy: {
        title: "asc",
      },
    });

    return res.json({
      positions: positions.map(serializePosition),
    });
  } catch (error) {
    console.error("Get positions error:", error);

    return res.status(500).json({
      message: "Failed to fetch positions",
    });
  }
}

/* =========================================================
   GET SINGLE POSITION
   GET /api/positions/:id
========================================================= */

export async function getPosition(
  req: AuthRequest,
  res: Response
) {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(401).json({
        message: "Tenant authentication required",
      });
    }

    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        message: "Position ID is required",
      });
    }

    const position = await prisma.position.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },

      include: {
        department: true,

        employees: {
          where: {
            organizationId: context.organizationId,
          },

          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            status: true,
          },

          orderBy: [
            {
              firstName: "asc",
            },
            {
              lastName: "asc",
            },
          ],
        },

        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!position) {
      return res.status(404).json({
        message: "Position not found",
      });
    }

    return res.json({
      position: serializePosition(position),
      employees: position.employees,
    });
  } catch (error) {
    console.error("Get position error:", error);

    return res.status(500).json({
      message: "Failed to fetch position",
    });
  }
}

/* =========================================================
   CREATE POSITION
   POST /api/positions
========================================================= */

export async function createPosition(
  req: AuthRequest,
  res: Response
) {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(401).json({
        message: "Tenant authentication required",
      });
    }

    const title = stringValue(req.body?.title);
    const code = optionalString(req.body?.code);
    const description = nullableString(
      req.body?.description
    );
    const departmentId = optionalString(
      req.body?.departmentId
    );
    const status =
      stringValue(req.body?.status) || "ACTIVE";

    if (!title) {
      return res.status(400).json({
        message: "Position title is required",
      });
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        message: "Invalid position status",
      });
    }

    /* -------------------------------------------------------
       Validate department
    ------------------------------------------------------- */

    if (departmentId) {
      const department =
        await prisma.department.findFirst({
          where: {
            id: departmentId,
            organizationId: context.organizationId,
          },
        });

      if (!department) {
        return res.status(400).json({
          message: "Department not found",
        });
      }

      if (department.status !== "ACTIVE") {
        return res.status(400).json({
          message:
            "Cannot assign a position to an inactive department",
        });
      }
    }

    /* -------------------------------------------------------
       Duplicate title protection
    ------------------------------------------------------- */

    const existingTitle =
      await prisma.position.findFirst({
        where: {
          organizationId: context.organizationId,
          title,
        },
      });

    if (existingTitle) {
      return res.status(409).json({
        message:
          "A position with this title already exists",
        code: "POSITION_TITLE_EXISTS",
      });
    }

    /* -------------------------------------------------------
       Duplicate code protection
    ------------------------------------------------------- */

    if (code) {
      const existingCode =
        await prisma.position.findFirst({
          where: {
            organizationId: context.organizationId,
            code,
          },
        });

      if (existingCode) {
        return res.status(409).json({
          message:
            "A position with this code already exists",
          code: "POSITION_CODE_EXISTS",
        });
      }
    }

    const position =
      await prisma.position.create({
        data: {
          organizationId: context.organizationId,
          title,
          code,
          description,
          status,

          ...(departmentId
            ? {
                departmentId,
              }
            : {}),
        },

        include: {
          department: true,

          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

    return res.status(201).json({
      message: "Position created successfully",
      position: serializePosition(position),
    });
  } catch (error) {
    console.error("Create position error:", error);

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        message:
          "A position with the same title or code already exists",
        code: "POSITION_ALREADY_EXISTS",
      });
    }

    return res.status(500).json({
      message: "Failed to create position",
    });
  }
}

/* =========================================================
   UPDATE POSITION
   PATCH /api/positions/:id
========================================================= */

export async function updatePosition(
  req: AuthRequest,
  res: Response
) {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(401).json({
        message: "Tenant authentication required",
      });
    }

    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        message: "Position ID is required",
      });
    }

    const position = await prisma.position.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },
    });

    if (!position) {
      return res.status(404).json({
        message: "Position not found",
      });
    }

    const title =
      req.body?.title !== undefined
        ? stringValue(req.body.title)
        : undefined;

    const code =
      req.body?.code !== undefined
        ? nullableString(req.body.code)
        : undefined;

    const description =
      req.body?.description !== undefined
        ? nullableString(req.body.description)
        : undefined;

    const departmentId =
      req.body?.departmentId !== undefined
        ? nullableString(req.body.departmentId)
        : undefined;

    const status =
      req.body?.status !== undefined
        ? stringValue(req.body.status)
        : undefined;

    if (title !== undefined && !title) {
      return res.status(400).json({
        message: "Position title cannot be empty",
      });
    }

    if (
      status !== undefined &&
      !["ACTIVE", "INACTIVE"].includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid position status",
      });
    }

    /* -------------------------------------------------------
       Validate department
    ------------------------------------------------------- */

    if (departmentId) {
      const department =
        await prisma.department.findFirst({
          where: {
            id: departmentId,
            organizationId: context.organizationId,
          },
        });

      if (!department) {
        return res.status(400).json({
          message: "Department not found",
        });
      }

      if (department.status !== "ACTIVE") {
        return res.status(400).json({
          message:
            "Cannot assign a position to an inactive department",
        });
      }
    }

    /* -------------------------------------------------------
       Duplicate title protection
    ------------------------------------------------------- */

    if (title !== undefined) {
      const duplicateTitle =
        await prisma.position.findFirst({
          where: {
            organizationId: context.organizationId,
            title,
            NOT: {
              id: position.id,
            },
          },
        });

      if (duplicateTitle) {
        return res.status(409).json({
          message:
            "A position with this title already exists",
          code: "POSITION_TITLE_EXISTS",
        });
      }
    }

    /* -------------------------------------------------------
       Duplicate code protection
    ------------------------------------------------------- */

    if (code !== undefined && code !== null) {
      const duplicateCode =
        await prisma.position.findFirst({
          where: {
            organizationId: context.organizationId,
            code,
            NOT: {
              id: position.id,
            },
          },
        });

      if (duplicateCode) {
        return res.status(409).json({
          message:
            "A position with this code already exists",
          code: "POSITION_CODE_EXISTS",
        });
      }
    }

    const updatedPosition =
      await prisma.position.update({
        where: {
          id: position.id,
        },

        data: {
          ...(title !== undefined
            ? {
                title,
              }
            : {}),

          ...(code !== undefined
            ? {
                code,
              }
            : {}),

          ...(description !== undefined
            ? {
                description,
              }
            : {}),

          ...(departmentId !== undefined
            ? {
                departmentId,
              }
            : {}),

          ...(status !== undefined
            ? {
                status,
              }
            : {}),
        },

        include: {
          department: true,

          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

    return res.json({
      message: "Position updated successfully",
      position: serializePosition(updatedPosition),
    });
  } catch (error) {
    console.error("Update position error:", error);

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        message:
          "A position with the same title or code already exists",
        code: "POSITION_ALREADY_EXISTS",
      });
    }

    return res.status(500).json({
      message: "Failed to update position",
    });
  }
}

/* =========================================================
   DELETE / DEACTIVATE POSITION
   DELETE /api/positions/:id
========================================================= */

export async function deletePosition(
  req: AuthRequest,
  res: Response
) {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(401).json({
        message: "Tenant authentication required",
      });
    }

    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        message: "Position ID is required",
      });
    }

    const position =
      await prisma.position.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },

        include: {
          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

    if (!position) {
      return res.status(404).json({
        message: "Position not found",
      });
    }

    if (position._count.employees > 0) {
      return res.status(409).json({
        message:
          "This position cannot be deactivated while employees are assigned to it",
        code: "POSITION_HAS_EMPLOYEES",
      });
    }

    const updatedPosition =
      await prisma.position.update({
        where: {
          id: position.id,
        },

        data: {
          status: "INACTIVE",
        },

        include: {
          department: true,

          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

    return res.json({
      message: "Position deactivated successfully",
      position: serializePosition(updatedPosition),
    });
  } catch (error) {
    console.error("Delete position error:", error);

    return res.status(500).json({
      message: "Failed to deactivate position",
    });
  }
}