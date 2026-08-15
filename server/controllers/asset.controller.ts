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
    organizationId:
      req.user.organizationId,
  };
}

function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toNumber(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(
      value.replace(/,/g, "")
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function serializeAsset(
  asset: any
) {
  return {
    id: asset.id,
    assetCode: asset.assetCode,
    name: asset.name,
    category: asset.category,
    value: Number(asset.value),
    status: asset.status,
    createdAt: asset.createdAt,
    organizationId:
      asset.organizationId,
  };
}

export const getAssets = async (
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

    const search =
      stringValue(
        req.query.search
      );

    const category =
      stringValue(
        req.query.category
      );

    const status =
      stringValue(
        req.query.status
      );

    const assets =
      await prisma.asset.findMany({
        where: {
          organizationId:
            context.organizationId,

          ...(category
            ? { category }
            : {}),

          ...(status
            ? { status }
            : {}),

          ...(search
            ? {
                OR: [
                  {
                    assetCode: {
                      contains: search,
                      mode:
                        "insensitive",
                    },
                  },
                  {
                    name: {
                      contains: search,
                      mode:
                        "insensitive",
                    },
                  },
                  {
                    category: {
                      contains: search,
                      mode:
                        "insensitive",
                    },
                  },
                  {
                    status: {
                      contains: search,
                      mode:
                        "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      assets:
        assets.map(
          serializeAsset
        ),
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to fetch assets:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ASSET_FETCH_FAILED",
      message:
        "Failed to fetch assets.",
    });
  }
};

export const getAsset = async (
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

    const id =
      stringValue(req.params.id);

    if (!id) {
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
          id,
          organizationId:
            context.organizationId,
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

    return res.status(200).json({
      success: true,
      asset:
        serializeAsset(asset),
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to fetch asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ASSET_FETCH_FAILED",
      message:
        "Failed to fetch asset.",
    });
  }
};

export const createAsset = async (
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

    const assetCode =
      stringValue(
        req.body?.assetCode
      );

    const name =
      stringValue(
        req.body?.name
      );

    const category =
      stringValue(
        req.body?.category
      );

    const value =
      toNumber(
        req.body?.value
      );

    const status =
      stringValue(
        req.body?.status
      ) || "ACTIVE";

    if (!assetCode) {
      return res.status(400).json({
        success: false,
        code:
          "ASSET_CODE_REQUIRED",
        message:
          "Asset code is required.",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        code: "ASSET_NAME_REQUIRED",
        message:
          "Asset name is required.",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        code:
          "ASSET_CATEGORY_REQUIRED",
        message:
          "Asset category is required.",
      });
    }

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_ASSET_VALUE",
        message:
          "Asset value must be a valid non-negative amount.",
      });
    }

    const existing =
      await prisma.asset.findFirst({
        where: {
          organizationId:
            context.organizationId,
          assetCode,
        },
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        code:
          "ASSET_CODE_EXISTS",
        message:
          "An asset with this asset code already exists.",
      });
    }

    const asset =
      await prisma.asset.create({
        data: {
          organizationId:
            context.organizationId,
          assetCode,
          name,
          category,
          value,
          status,
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Asset created successfully.",
      asset:
        serializeAsset(asset),
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to create asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_CREATE_FAILED",
      message:
        "Failed to create asset.",
    });
  }
};

export const updateAsset = async (
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

    const id =
      stringValue(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "ASSET_ID_REQUIRED",
        message:
          "Asset ID is required.",
      });
    }

    const existing =
      await prisma.asset.findFirst({
        where: {
          id,
          organizationId:
            context.organizationId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "ASSET_NOT_FOUND",
        message:
          "Asset was not found.",
      });
    }

    const data: {
      name?: string;
      category?: string;
      value?: number;
      status?: string;
    } = {};

    if (
      req.body?.name !==
      undefined
    ) {
      const name =
        stringValue(
          req.body.name
        );

      if (!name) {
        return res.status(400).json({
          success: false,
          code:
            "ASSET_NAME_REQUIRED",
          message:
            "Asset name is required.",
        });
      }

      data.name = name;
    }

    if (
      req.body?.category !==
      undefined
    ) {
      const category =
        stringValue(
          req.body.category
        );

      if (!category) {
        return res.status(400).json({
          success: false,
          code:
            "ASSET_CATEGORY_REQUIRED",
          message:
            "Asset category is required.",
        });
      }

      data.category =
        category;
    }

    if (
      req.body?.value !==
      undefined
    ) {
      const value =
        toNumber(
          req.body.value
        );

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_ASSET_VALUE",
          message:
            "Asset value must be a valid non-negative amount.",
        });
      }

      data.value = value;
    }

    if (
      req.body?.status !==
      undefined
    ) {
      const status =
        stringValue(
          req.body.status
        );

      if (!status) {
        return res.status(400).json({
          success: false,
          code:
            "ASSET_STATUS_REQUIRED",
          message:
            "Asset status is required.",
        });
      }

      data.status =
        status;
    }

    const asset =
      await prisma.asset.update({
        where: {
          id: existing.id,
        },
        data,
      });

    return res.status(200).json({
      success: true,
      message:
        "Asset updated successfully.",
      asset:
        serializeAsset(asset),
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to update asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_UPDATE_FAILED",
      message:
        "Failed to update asset.",
    });
  }
};

export const deleteAsset = async (
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

    const id =
      stringValue(req.params.id);

    if (!id) {
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
          id,
          organizationId:
            context.organizationId,
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

    await prisma.asset.delete({
      where: {
        id: asset.id,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Asset deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to delete asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ASSET_DELETE_FAILED",
      message:
        "Failed to delete asset.",
    });
  }
};