import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const getParam = (
  value: string | string[] | undefined
): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  const organizationId =
    req.user?.organizationId?.trim();

  return organizationId || null;
};

/* =========================================================
   CREATE VENDOR
========================================================= */

export const createVendor = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const {
      vendorCode,
      name,
      email,
      phoneNumber,
      address,
      taxNumber,
    } = req.body;

    if (
      typeof vendorCode !== "string" ||
      !vendorCode.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Vendor code is required",
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Vendor name is required",
      });
    }

    const normalizedVendorCode =
      vendorCode.trim().toUpperCase();

    const existingVendor =
      await prisma.vendor.findFirst({
        where: {
          organizationId,
          vendorCode: normalizedVendorCode,
        },
      });

    if (existingVendor) {
      return res.status(409).json({
        success: false,
        message:
          "Vendor code already exists in this organization",
      });
    }

    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        vendorCode: normalizedVendorCode,
        name: name.trim(),

        email:
          typeof email === "string" && email.trim()
            ? email.trim().toLowerCase()
            : null,

        phoneNumber:
          cleanOptionalString(phoneNumber),

        address:
          cleanOptionalString(address),

        taxNumber:
          typeof taxNumber === "string" &&
          taxNumber.trim()
            ? taxNumber.trim().toUpperCase()
            : null,

        status: "ACTIVE",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      vendor,
    });
  } catch (error) {
    console.error("CREATE VENDOR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create vendor",
    });
  }
};

/* =========================================================
   GET ALL VENDORS
========================================================= */

export const getVendors = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const vendors = await prisma.vendor.findMany({
      where: {
        organizationId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: vendors.length,
      vendors,
    });
  } catch (error) {
    console.error("GET VENDORS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
    });
  }
};

/* =========================================================
   GET VENDOR BY ID
========================================================= */

export const getVendorById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const id = getParam(req.params.id);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization context is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    const vendor = await prisma.vendor.findFirst({
      where: {
        id,
        organizationId,
      },

      include: {
        payables: {
          where: {
            organizationId,
          },

          orderBy: {
            createdAt: "desc",
          },
        },

        expenses: {
          where: {
            organizationId,
          },

          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    return res.status(200).json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("GET VENDOR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendor",
    });
  }
};

/* =========================================================
   UPDATE VENDOR
========================================================= */

export const updateVendor = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const id = getParam(req.params.id);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization context is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    const existingVendor =
      await prisma.vendor.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!existingVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const {
      vendorCode,
      name,
      email,
      phoneNumber,
      address,
      taxNumber,
    } = req.body;

    if (
      vendorCode !== undefined &&
      (
        typeof vendorCode !== "string" ||
        !vendorCode.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Vendor code cannot be empty",
      });
    }

    if (
      name !== undefined &&
      (
        typeof name !== "string" ||
        !name.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Vendor name cannot be empty",
      });
    }

    const normalizedVendorCode =
      typeof vendorCode === "string"
        ? vendorCode.trim().toUpperCase()
        : existingVendor.vendorCode;

    if (
      normalizedVendorCode !==
      existingVendor.vendorCode
    ) {
      const duplicate =
        await prisma.vendor.findFirst({
          where: {
            organizationId,
            vendorCode: normalizedVendorCode,
            NOT: {
              id,
            },
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "Vendor code already exists in this organization",
        });
      }
    }

    const vendor = await prisma.vendor.update({
      where: {
        id,
      },

      data: {
        vendorCode: normalizedVendorCode,

        name:
          typeof name === "string"
            ? name.trim()
            : existingVendor.name,

        email:
          email !== undefined
            ? typeof email === "string" &&
              email.trim()
              ? email.trim().toLowerCase()
              : null
            : existingVendor.email,

        phoneNumber:
          phoneNumber !== undefined
            ? cleanOptionalString(phoneNumber)
            : existingVendor.phoneNumber,

        address:
          address !== undefined
            ? cleanOptionalString(address)
            : existingVendor.address,

        taxNumber:
          taxNumber !== undefined
            ? typeof taxNumber === "string" &&
              taxNumber.trim()
              ? taxNumber.trim().toUpperCase()
              : null
            : existingVendor.taxNumber,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      vendor,
    });
  } catch (error) {
    console.error("UPDATE VENDOR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update vendor",
    });
  }
};

/* =========================================================
   UPDATE VENDOR STATUS
========================================================= */

export const updateVendorStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const id = getParam(req.params.id);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization context is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    const status =
      typeof req.body.status === "string"
        ? req.body.status.trim().toUpperCase()
        : "";

    if (
      status !== "ACTIVE" &&
      status !== "INACTIVE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Vendor status must be ACTIVE or INACTIVE",
      });
    }

    const existingVendor =
      await prisma.vendor.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!existingVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const vendor = await prisma.vendor.update({
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
        status === "ACTIVE"
          ? "Vendor activated successfully"
          : "Vendor deactivated successfully",

      vendor,
    });
  } catch (error) {
    console.error(
      "UPDATE VENDOR STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update vendor status",
    });
  }
};

/* =========================================================
   DELETE VENDOR

   Vendors with financial history cannot be deleted.
========================================================= */

export const deleteVendor = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const id = getParam(req.params.id);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization context is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    const vendor = await prisma.vendor.findFirst({
      where: {
        id,
        organizationId,
      },

      include: {
        _count: {
          select: {
            payables: {
              where: {
                organizationId,
              },
            },

            expenses: {
              where: {
                organizationId,
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    if (
      vendor._count.payables > 0 ||
      vendor._count.expenses > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Vendor has financial transactions and cannot be deleted. Deactivate the vendor instead.",
      });
    }

    await prisma.vendor.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Vendor deleted successfully",
    });
  } catch (error) {
    console.error("DELETE VENDOR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete vendor",
    });
  }
};