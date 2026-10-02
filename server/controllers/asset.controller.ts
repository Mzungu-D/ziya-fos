import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";
import { Prisma } from "@prisma/client";

const MONEY_SCALE = 100;
const MAX_MONEY = 999999999999.99;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_DEPRECIATION_METHODS = new Set([
  "STRAIGHT_LINE",
  "DECLINING_BALANCE",
  "DOUBLE_DECLINING_BALANCE",
  "UNITS_OF_PRODUCTION",
]);

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;
}

function parseMoney(value: unknown, fieldName: string, allowZero = true): number {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required.`);
  }

  const parsed = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed <= 0) || parsed > MAX_MONEY) {
    throw new Error(`${fieldName} must be a valid monetary amount.`);
  }

  return roundMoney(parsed);
}

function getActorId(req: AuthRequest): string {
  return String(req.user?.userId ?? "SYSTEM");
}

function normalizeStatus(value: unknown): string {
  return stringValue(value).toUpperCase();
}

function validateDateRange(start: Date | null, end: Date | null, startName: string, endName: string) {
  if (start && end && end.getTime() < start.getTime()) {
    return { code: "INVALID_DATE_RANGE", message: `${endName} cannot be before ${startName}.` };
  }
  return null;
}

function validateDepreciationConfiguration(data: {
  purchaseCost?: number | null;
  currentBookValue?: number | null;
  accumulatedDepreciation?: number | null;
  residualValue?: number | null;
  depreciationMethod?: string | null;
  usefulLife?: number | null;
  depreciationStartDate?: Date | null;
}): { code: string; message: string } | null {
  const purchaseCost = data.purchaseCost ?? null;
  const bookValue = data.currentBookValue ?? null;
  const accumulated = data.accumulatedDepreciation ?? null;
  const residual = data.residualValue ?? null;

  if (purchaseCost !== null && (!Number.isFinite(purchaseCost) || purchaseCost < 0 || purchaseCost > MAX_MONEY)) {
    return { code: "INVALID_PURCHASE_COST", message: "Purchase cost must be a valid non-negative amount." };
  }
  if (bookValue !== null && (!Number.isFinite(bookValue) || bookValue < 0 || bookValue > MAX_MONEY)) {
    return { code: "INVALID_BOOK_VALUE", message: "Current book value must be a valid non-negative amount." };
  }
  if (accumulated !== null && (!Number.isFinite(accumulated) || accumulated < 0 || accumulated > MAX_MONEY)) {
    return { code: "INVALID_ACCUMULATED_DEPRECIATION", message: "Accumulated depreciation must be a valid non-negative amount." };
  }
  if (residual !== null && (!Number.isFinite(residual) || residual < 0 || residual > MAX_MONEY)) {
    return { code: "INVALID_RESIDUAL_VALUE", message: "Residual value must be a valid non-negative amount." };
  }
  if (purchaseCost !== null && residual !== null && residual > purchaseCost) {
    return { code: "INVALID_RESIDUAL_VALUE", message: "Residual value cannot exceed purchase cost." };
  }
  if (purchaseCost !== null && accumulated !== null && accumulated > purchaseCost + 0.01) {
    return { code: "INVALID_ACCUMULATED_DEPRECIATION", message: "Accumulated depreciation cannot exceed purchase cost." };
  }
  if (purchaseCost !== null && bookValue !== null && accumulated !== null) {
    const expected = roundMoney(Math.max(0, purchaseCost - accumulated));
    if (Math.abs(expected - bookValue) > 0.01) {
      return { code: "INCONSISTENT_BOOK_VALUE", message: "Current book value must equal purchase cost less accumulated depreciation." };
    }
  }
  if (data.depreciationMethod) {
    const method = data.depreciationMethod.trim().toUpperCase();
    if (!ALLOWED_DEPRECIATION_METHODS.has(method)) {
      return { code: "INVALID_DEPRECIATION_METHOD", message: "Unsupported depreciation method." };
    }
  }
  if (data.usefulLife !== null && data.usefulLife !== undefined && (!Number.isInteger(data.usefulLife) || data.usefulLife <= 0)) {
    return { code: "INVALID_USEFUL_LIFE", message: "Useful life must be a positive whole number." };
  }
  if ((data.depreciationMethod || data.usefulLife !== null && data.usefulLife !== undefined) && purchaseCost === null) {
    return { code: "PURCHASE_COST_REQUIRED_FOR_DEPRECIATION", message: "Purchase cost is required when depreciation is configured." };
  }
  return null;
}

async function createAuditTrail(
  tx: Prisma.TransactionClient,
  organizationId: string,
  user: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  await tx.auditTrail.create({
    data: {
      organizationId,
      user,
      action,
      module: "ASSET",
      details: JSON.stringify(details),
    },
  });
}

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

function optionalString(value: unknown): string | null {
  const valueString = stringValue(value);
  return valueString || null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = toNumber(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function optionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

function isComputerCategory(category: string): boolean {
  const normalized = normalizeCategory(category);

  return [
    "computer",
    "computers",
    "laptop",
    "laptops",
    "desktop",
    "desktop computer",
    "workstation",
    "macbook",
  ].includes(normalized);
}

function isMobileCategory(category: string): boolean {
  const normalized = normalizeCategory(category);

  return [
    "mobile",
    "mobile phone",
    "phone",
    "phones",
    "smartphone",
    "tablet",
    "tablets",
    "ipad",
    "iphone",
    "android",
  ].includes(normalized);
}

function isVehicleCategory(category: string): boolean {
  const normalized = normalizeCategory(category);

  return [
    "vehicle",
    "vehicles",
    "car",
    "cars",
    "motor vehicle",
    "motorcycle",
    "motorcycles",
    "truck",
    "trucks",
      "van",
    "vans",
    "boda boda",
    "tuk tuk",
    "tuk-tuk",
  ].includes(normalized);
}

/**
 * Generates the next tenant-scoped Asset Code.
 *
 * Format:
 * AST-000001
 * AST-000002
 * AST-000003
 *
 * A PostgreSQL advisory transaction lock prevents two simultaneous
 * asset creations inside the same organization from generating
 * the same code.
 */
async function generateAssetCode(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<string> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${organizationId}, 0)
    )
  `;

  const result = await tx.$queryRaw<Array<{ max_number: number | null }>>`
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING("assetCode" FROM 5) AS INTEGER
        )
      ),
      0
    ) AS max_number
    FROM "Asset"
    WHERE "organizationId" = ${organizationId}
      AND "assetCode" ~ '^AST-[0-9]+$'
  `;

  const currentMaximum = Number(result[0]?.max_number ?? 0);
  const nextNumber = currentMaximum + 1;

  return `AST-${String(nextNumber).padStart(6, "0")}`;
}

function serializeAsset(asset: any) {
  return {
    id: asset.id,
    assetCode: asset.assetCode,
    name: asset.name,
    category: asset.category,

    // Legacy/accounting-compatible value
    value: Number(asset.value),

    status: asset.status,

    manufacturer: asset.manufacturer ?? null,
    model: asset.model ?? null,
    serialNumber: asset.serialNumber ?? null,
    serviceTag: asset.serviceTag ?? null,

    purchaseDate: asset.purchaseDate ?? null,
    purchaseCost:
      asset.purchaseCost !== null && asset.purchaseCost !== undefined
        ? Number(asset.purchaseCost)
        : null,

    currentBookValue:
      asset.currentBookValue !== null &&
      asset.currentBookValue !== undefined
        ? Number(asset.currentBookValue)
        : null,

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

    depreciationMethod: asset.depreciationMethod ?? null,
    usefulLife: asset.usefulLife ?? null,
    depreciationStartDate: asset.depreciationStartDate ?? null,
    condition: asset.condition ?? null,
    location: asset.location ?? null,
    vendor: asset.vendor ?? null,

    warrantyStart: asset.warrantyStart ?? null,
    warrantyEnd: asset.warrantyEnd ?? null,
    notes: asset.notes ?? null,

    // Computer
    processor: asset.processor ?? null,
    ram: asset.ram ?? null,
    storage: asset.storage ?? null,
    storageType: asset.storageType ?? null,
    operatingSystem: asset.operatingSystem ?? null,
    osVersion: asset.osVersion ?? null,
    macAddress: asset.macAddress ?? null,
    hostname: asset.hostname ?? null,

    // Mobile
    imei: asset.imei ?? null,
    imei2: asset.imei2 ?? null,
    phoneNumber: asset.phoneNumber ?? null,
    simIccid: asset.simIccid ?? null,
    carrier: asset.carrier ?? null,
    storageCapacity: asset.storageCapacity ?? null,
    color: asset.color ?? null,
    enrollmentStatus: asset.enrollmentStatus ?? null,
    mdmDeviceId: asset.mdmDeviceId ?? null,

    // Vehicle
    registrationNumber: asset.registrationNumber ?? null,
    vin: asset.vin ?? null,
    chassisNumber: asset.chassisNumber ?? null,
    engineNumber: asset.engineNumber ?? null,
    year: asset.year ?? null,
    vehicleType: asset.vehicleType ?? null,
    bodyType: asset.bodyType ?? null,
    fuelType: asset.fuelType ?? null,
    fuelCapacity:
      asset.fuelCapacity !== null &&
      asset.fuelCapacity !== undefined
        ? Number(asset.fuelCapacity)
        : null,
    transmission: asset.transmission ?? null,
    odometer:
      asset.odometer !== null && asset.odometer !== undefined
        ? Number(asset.odometer)
        : null,
    engineHours:
      asset.engineHours !== null &&
      asset.engineHours !== undefined
        ? Number(asset.engineHours)
        : null,

    // Vehicle compliance
    insurancePolicyNumber:
      asset.insurancePolicyNumber ?? null,
    insuranceExpiry: asset.insuranceExpiry ?? null,
    registrationExpiry: asset.registrationExpiry ?? null,
    inspectionExpiry: asset.inspectionExpiry ?? null,

    // Vehicle maintenance
    lastServiceDate: asset.lastServiceDate ?? null,
    nextServiceDate: asset.nextServiceDate ?? null,
    maintenanceNotes: asset.maintenanceNotes ?? null,

    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt ?? null,
    organizationId: asset.organizationId,
  };
}

function buildAssetData(body: any) {
  const purchaseCost = optionalNumber(body?.purchaseCost);

  const value =
    body?.value !== undefined && body?.value !== null && body?.value !== ""
      ? roundMoney(toNumber(body.value))
      : purchaseCost ?? 0;

  return {
    name: stringValue(body?.name),
    category: stringValue(body?.category),

    value,

    status: stringValue(body?.status) || "ACTIVE",

    manufacturer: optionalString(body?.manufacturer),
    model: optionalString(body?.model),
    serialNumber: optionalString(body?.serialNumber),
    serviceTag: optionalString(body?.serviceTag),

    purchaseDate: optionalDate(body?.purchaseDate),
    purchaseCost,
    currentBookValue: optionalNumber(body?.currentBookValue),

    accumulatedDepreciation: optionalNumber(
      body?.accumulatedDepreciation
    ),
    residualValue: optionalNumber(body?.residualValue),
    depreciationMethod: optionalString(body?.depreciationMethod),
    usefulLife:
      body?.usefulLife !== undefined &&
      body?.usefulLife !== null &&
      body?.usefulLife !== ""
        ? Math.trunc(toNumber(body.usefulLife))
        : null,
    depreciationStartDate: optionalDate(body?.depreciationStartDate),
    condition: optionalString(body?.condition),
    location: optionalString(body?.location),
    vendor: optionalString(body?.vendor),

    warrantyStart: optionalDate(body?.warrantyStart),
    warrantyEnd: optionalDate(body?.warrantyEnd),
    notes: optionalString(body?.notes),

    // Computer
    processor: optionalString(body?.processor),
    ram: optionalString(body?.ram),
    storage: optionalString(body?.storage),
    storageType: optionalString(body?.storageType),
    operatingSystem: optionalString(body?.operatingSystem),
    osVersion: optionalString(body?.osVersion),
    macAddress: optionalString(body?.macAddress),
    hostname: optionalString(body?.hostname),

    // Mobile
    imei: optionalString(body?.imei),
    imei2: optionalString(body?.imei2),
    phoneNumber: optionalString(body?.phoneNumber),
    simIccid: optionalString(body?.simIccid),
    carrier: optionalString(body?.carrier),
    storageCapacity: optionalString(body?.storageCapacity),
    color: optionalString(body?.color),
    enrollmentStatus: optionalString(body?.enrollmentStatus),
    mdmDeviceId: optionalString(body?.mdmDeviceId),

    // Vehicle
    registrationNumber: optionalString(body?.registrationNumber),
    vin: optionalString(body?.vin),
    chassisNumber: optionalString(body?.chassisNumber),
    engineNumber: optionalString(body?.engineNumber),
    year: optionalInteger(body?.year),
    vehicleType: optionalString(body?.vehicleType),
    bodyType: optionalString(body?.bodyType),
    fuelType: optionalString(body?.fuelType),
    fuelCapacity: optionalNumber(body?.fuelCapacity),
    transmission: optionalString(body?.transmission),
    odometer: optionalNumber(body?.odometer),
    engineHours: optionalNumber(body?.engineHours),

    // Vehicle compliance
    insurancePolicyNumber: optionalString(
      body?.insurancePolicyNumber
    ),
    insuranceExpiry: optionalDate(body?.insuranceExpiry),
    registrationExpiry: optionalDate(
      body?.registrationExpiry
    ),
    inspectionExpiry: optionalDate(
      body?.inspectionExpiry
    ),

    // Vehicle maintenance
    lastServiceDate: optionalDate(body?.lastServiceDate),
    nextServiceDate: optionalDate(body?.nextServiceDate),
    maintenanceNotes: optionalString(
      body?.maintenanceNotes
    ),
  };
}

function validateAssetData(
  data: ReturnType<typeof buildAssetData>
) {
  if (!data.name) {
    return {
      code: "ASSET_NAME_REQUIRED",
      message: "Asset name is required.",
    };
  }

  if (!data.category) {
    return {
      code: "ASSET_CATEGORY_REQUIRED",
      message: "Asset category is required.",
    };
  }

  if (!Number.isFinite(data.value) || data.value < 0) {
    return {
      code: "INVALID_ASSET_VALUE",
      message:
        "Asset value must be a valid non-negative amount.",
    };
  }

  if (
    data.purchaseCost !== null &&
    (!Number.isFinite(data.purchaseCost) ||
      data.purchaseCost < 0)
  ) {
    return {
      code: "INVALID_PURCHASE_COST",
      message:
        "Purchase cost must be a valid non-negative amount.",
    };
  }

  if (
    data.currentBookValue !== null &&
    (!Number.isFinite(data.currentBookValue) ||
      data.currentBookValue < 0)
  ) {
    return {
      code: "INVALID_BOOK_VALUE",
      message:
        "Current book value must be a valid non-negative amount.",
    };
  }

  if (isComputerCategory(data.category) && !data.serialNumber) {
    return {
      code: "ASSET_SERIAL_NUMBER_REQUIRED",
      message:
        "Serial number is required for computer and laptop assets.",
    };
  }

  if (
    isVehicleCategory(data.category) &&
    data.year !== null &&
    (data.year < 1900 || data.year > new Date().getFullYear() + 1)
  ) {
    return {
      code: "INVALID_VEHICLE_YEAR",
      message: "Vehicle year is invalid.",
    };
  }

  return null;
}

export const getAssets = async (
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
    const category = stringValue(req.query.category);
    const status = stringValue(req.query.status);
    const condition = stringValue(req.query.condition);

    const requestedPage = Number.parseInt(
      stringValue(req.query.page) || "1",
      10
    );
    const requestedPageSize = Number.parseInt(
      stringValue(req.query.pageSize) || "20",
      10
    );

    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(100, Math.max(1, requestedPageSize))
      : 20;

    const where = {
      organizationId: context.organizationId,
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(condition ? { condition } : {}),
      ...(search
        ? {
            OR: [
              {
                assetCode: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                category: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                status: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                manufacturer: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                model: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                serialNumber: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                registrationNumber: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                location: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, aggregate] = await prisma.$transaction([
      prisma.asset.count({ where }),
      prisma.asset.aggregate({
        where,
        _sum: {
          purchaseCost: true,
          currentBookValue: true,
          accumulatedDepreciation: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Number.isFinite(requestedPage)
      ? Math.min(totalPages, Math.max(1, requestedPage))
      : 1;

    const assets = await prisma.asset.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return res.status(200).json({
      success: true,
      assets: assets.map(serializeAsset),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      summary: {
        totalAssets: total,
        totalPurchaseCost: Number(aggregate._sum.purchaseCost ?? 0),
        currentBookValue: Number(aggregate._sum.currentBookValue ?? 0),
        accumulatedDepreciation: Number(
          aggregate._sum.accumulatedDepreciation ?? 0
        ),
      },
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to fetch assets:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ASSET_FETCH_FAILED",
      message: "Failed to fetch assets.",
    });
  }
};

export const getAsset = async (
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
        code: "ASSET_ID_REQUIRED",
        message: "Asset ID is required.",
      });
    }

    const asset = await prisma.asset.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        code: "ASSET_NOT_FOUND",
        message: "Asset was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      asset: serializeAsset(asset),
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to fetch asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ASSET_FETCH_FAILED",
      message: "Failed to fetch asset.",
    });
  }
};

export const createAsset = async (
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

    /*
     * IMPORTANT:
     * assetCode is intentionally NOT read from req.body.
     * It is generated by the backend.
     */
    const data = buildAssetData(req.body);

    const validationError = validateAssetData(data);

    if (validationError) {
      return res.status(400).json({
        success: false,
        code: validationError.code,
        message: validationError.message,
      });
    }

    const depreciationValidation = validateDepreciationConfiguration({
      purchaseCost: data.purchaseCost,
      currentBookValue: data.currentBookValue ?? data.purchaseCost,
      accumulatedDepreciation: data.accumulatedDepreciation ?? 0,
      residualValue: data.residualValue ?? 0,
      depreciationMethod: data.depreciationMethod,
      usefulLife: data.usefulLife,
      depreciationStartDate: data.depreciationStartDate,
    });

    if (depreciationValidation) {
      return res.status(400).json({ success: false, code: depreciationValidation.code, message: depreciationValidation.message });
    }

    const asset = await prisma.$transaction(async (tx) => {
      const assetCode = await generateAssetCode(tx, context.organizationId);
      const purchaseCost = data.purchaseCost ?? null;
      const accumulatedDepreciation = data.accumulatedDepreciation ?? 0;
      const residualValue = data.residualValue ?? 0;
      const currentBookValue = data.currentBookValue ?? (purchaseCost !== null ? roundMoney(Math.max(0, purchaseCost - accumulatedDepreciation)) : null);

      const created = await tx.asset.create({
        data: {
          organizationId: context.organizationId,
          assetCode,
          ...data,
          value: roundMoney(data.value),
          purchaseCost,
          accumulatedDepreciation,
          residualValue,
          currentBookValue,
          depreciationMethod: data.depreciationMethod ? data.depreciationMethod.toUpperCase() : null,
        },
      });

      await createAuditTrail(tx, context.organizationId, context.userId, "CREATE_ASSET", {
        assetId: created.id, assetCode: created.assetCode, name: created.name, category: created.category, purchaseCost: created.purchaseCost,
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: "Asset created successfully.",
      asset: serializeAsset(asset),
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to create asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ASSET_CREATE_FAILED",
      message: "Failed to create asset.",
    });
  }
};

export const updateAsset = async (
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
        code: "ASSET_ID_REQUIRED",
        message: "Asset ID is required.",
      });
    }

    const existing = await prisma.asset.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "ASSET_NOT_FOUND",
        message: "Asset was not found.",
      });
    }

    const body = req.body ?? {};

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = stringValue(body.name);

      if (!name) {
        return res.status(400).json({
          success: false,
          code: "ASSET_NAME_REQUIRED",
          message: "Asset name is required.",
        });
      }

      data.name = name;
    }

    if (body.category !== undefined) {
      const category = stringValue(body.category);

      if (!category) {
        return res.status(400).json({
          success: false,
          code: "ASSET_CATEGORY_REQUIRED",
          message: "Asset category is required.",
        });
      }

      data.category = category;
    }

    if (body.value !== undefined) {
      const value = toNumber(body.value);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ASSET_VALUE",
          message:
            "Asset value must be a valid non-negative amount.",
        });
      }

      data.value = value;
    }

    if (body.status !== undefined) {
      const status = stringValue(body.status);

      if (!status) {
        return res.status(400).json({
          success: false,
          code: "ASSET_STATUS_REQUIRED",
          message: "Asset status is required.",
        });
      }

      data.status = status;
    }

    const optionalStringFields = [
      "manufacturer",
      "model",
      "serialNumber",
      "serviceTag",
      "condition",
      "location",
      "vendor",
      "notes",
      "processor",
      "ram",
      "storage",
      "storageType",
      "operatingSystem",
      "osVersion",
      "macAddress",
      "hostname",
      "imei",
      "imei2",
      "phoneNumber",
      "simIccid",
      "carrier",
      "storageCapacity",
      "color",
      "enrollmentStatus",
      "mdmDeviceId",
      "registrationNumber",
      "vin",
      "chassisNumber",
      "engineNumber",
      "vehicleType",
      "bodyType",
      "fuelType",
      "transmission",
      "insurancePolicyNumber",
      "maintenanceNotes",
    ];

    for (const field of optionalStringFields) {
      if (body[field] !== undefined) {
        data[field] = optionalString(body[field]);
      }
    }

    const optionalNumberFields = [
      "purchaseCost",
      "currentBookValue",
      "accumulatedDepreciation",
      "residualValue",
      "fuelCapacity",
      "odometer",
      "engineHours",
    ];

    for (const field of optionalNumberFields) {
      if (body[field] !== undefined) {
        const value = optionalNumber(body[field]);

        if (value !== null && value < 0) {
          return res.status(400).json({
            success: false,
            code: "INVALID_ASSET_NUMBER",
            message: `${field} must be a valid non-negative number.`,
          });
        }

        data[field] = value;
      }
    }

    if (body.year !== undefined) {
      const year = optionalInteger(body.year);

      if (
        year !== null &&
        (year < 1900 ||
          year > new Date().getFullYear() + 1)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_VEHICLE_YEAR",
          message: "Vehicle year is invalid.",
        });
      }

      data.year = year;
    }

    const dateFields = [
      "purchaseDate",
      "depreciationStartDate",
      "warrantyStart",
      "warrantyEnd",
      "insuranceExpiry",
      "registrationExpiry",
      "inspectionExpiry",
      "lastServiceDate",
      "nextServiceDate",
    ];

    for (const field of dateFields) {
      if (body[field] !== undefined) {
        const parsed = optionalDate(body[field]);

        if (
          body[field] !== null &&
          body[field] !== "" &&
          parsed === null
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_ASSET_DATE",
            message: `${field} must be a valid date.`,
          });
        }

        data[field] = parsed;
      }
    }

    const resultingCategory = String(
      data.category ?? existing.category
    );

    const resultingSerial =
      data.serialNumber !== undefined
        ? data.serialNumber
        : existing.serialNumber;

    if (
      isComputerCategory(resultingCategory) &&
      !resultingSerial
    ) {
      return res.status(400).json({
        success: false,
        code: "ASSET_SERIAL_NUMBER_REQUIRED",
        message:
          "Serial number is required for computer and laptop assets.",
      });
    }

    if (data.purchaseCost !== undefined) {
      const purchaseCost = data.purchaseCost as number | null;

      if (
        purchaseCost !== null &&
        (!Number.isFinite(purchaseCost) ||
          purchaseCost < 0)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PURCHASE_COST",
          message:
            "Purchase cost must be a valid non-negative amount.",
        });
      }
    }

    if (data.accumulatedDepreciation !== undefined) {
      const accumulatedDepreciation = data.accumulatedDepreciation as number | null;

      if (
        accumulatedDepreciation !== null &&
        (!Number.isFinite(accumulatedDepreciation) ||
          accumulatedDepreciation < 0)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ACCUMULATED_DEPRECIATION",
          message:
            "Accumulated depreciation must be a valid non-negative amount.",
        });
      }
    }

    if (data.residualValue !== undefined) {
      const residualValue = data.residualValue as number | null;

      if (
        residualValue !== null &&
        (!Number.isFinite(residualValue) || residualValue < 0)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_RESIDUAL_VALUE",
          message:
            "Residual value must be a valid non-negative amount.",
        });
      }
    }

    if (data.usefulLife !== undefined) {
      const usefulLife = data.usefulLife as number | null;

      if (
        usefulLife !== null &&
        (!Number.isInteger(usefulLife) || usefulLife <= 0)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_USEFUL_LIFE",
          message:
            "Useful life must be a positive whole number.",
        });
      }
    }

    if (data.currentBookValue !== undefined) {
      const bookValue =
        data.currentBookValue as number | null;

      if (
        bookValue !== null &&
        (!Number.isFinite(bookValue) ||
          bookValue < 0)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_BOOK_VALUE",
          message:
            "Current book value must be a valid non-negative amount.",
        });
      }
    }

    /*
     * Asset Code is intentionally excluded from update data.
     * Once generated, it remains immutable.
     */
    delete data.assetCode;

    const currentPurchaseCost = data.purchaseCost !== undefined ? data.purchaseCost as number | null : existing.purchaseCost;
    const currentAccumulated = data.accumulatedDepreciation !== undefined ? data.accumulatedDepreciation as number | null : (existing.accumulatedDepreciation ?? 0);
    const currentResidual = data.residualValue !== undefined ? data.residualValue as number | null : (existing.residualValue ?? 0);
    const currentBookValue = data.currentBookValue !== undefined ? data.currentBookValue as number | null : existing.currentBookValue;
    const depreciationValidation = validateDepreciationConfiguration({
      purchaseCost: currentPurchaseCost,
      currentBookValue,
      accumulatedDepreciation: currentAccumulated,
      residualValue: currentResidual,
      depreciationMethod: data.depreciationMethod !== undefined ? String(data.depreciationMethod ?? "") : existing.depreciationMethod,
      usefulLife: data.usefulLife !== undefined ? data.usefulLife as number | null : existing.usefulLife,
      depreciationStartDate: data.depreciationStartDate !== undefined ? data.depreciationStartDate as Date | null : existing.depreciationStartDate,
    });

    if (depreciationValidation) {
      return res.status(400).json({ success: false, code: depreciationValidation.code, message: depreciationValidation.message });
    }

    if (data.value !== undefined) data.value = roundMoney(Number(data.value));
    if (data.purchaseCost !== undefined && data.purchaseCost !== null) data.purchaseCost = roundMoney(Number(data.purchaseCost));
    if (data.currentBookValue !== undefined && data.currentBookValue !== null) data.currentBookValue = roundMoney(Number(data.currentBookValue));
    if (data.accumulatedDepreciation !== undefined && data.accumulatedDepreciation !== null) data.accumulatedDepreciation = roundMoney(Number(data.accumulatedDepreciation));
    if (data.residualValue !== undefined && data.residualValue !== null) data.residualValue = roundMoney(Number(data.residualValue));
    if (data.depreciationMethod !== undefined && data.depreciationMethod !== null) data.depreciationMethod = String(data.depreciationMethod).toUpperCase();

    const asset = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Asset"
        WHERE "id" = ${existing.id} AND "organizationId" = ${context.organizationId}
        FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("Asset was not found.");

      const updated = await tx.asset.update({ where: { id: existing.id }, data: data as any });
      await createAuditTrail(tx, context.organizationId, context.userId, "UPDATE_ASSET", { assetId: updated.id, assetCode: updated.assetCode, changes: data });
      return updated;
    });

    return res.status(200).json({
      success: true,
      message: "Asset updated successfully.",
      asset: serializeAsset(asset),
    });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to update asset:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ASSET_UPDATE_FAILED",
      message: "Failed to update asset.",
    });
  }
};

export const deleteAsset = async (
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
        code: "ASSET_ID_REQUIRED",
        message: "Asset ID is required.",
      });
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Asset"
        WHERE "id" = ${id} AND "organizationId" = ${context.organizationId}
        FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("ASSET_NOT_FOUND");

      const asset = await tx.asset.findFirst({ where: { id, organizationId: context.organizationId } });
      if (!asset) throw new Error("ASSET_NOT_FOUND");

      const assignmentCount = await tx.assetAssignment.count({ where: { assetId: asset.id, organizationId: context.organizationId } });
      if (assignmentCount > 0) throw new Error("ASSET_HAS_ASSIGNMENTS");

      const status = normalizeStatus(asset.status);
      if (!["DRAFT", "CANCELLED", "INACTIVE"].includes(status)) {
        throw new Error("ACTIVE_ASSET_CANNOT_BE_DELETED");
      }

      await tx.asset.delete({ where: { id: asset.id } });
      await createAuditTrail(tx, context.organizationId, context.userId, "DELETE_ASSET", { assetId: asset.id, assetCode: asset.assetCode, name: asset.name });
    });

    return res.status(200).json({ success: true, message: "Asset deleted successfully." });
  } catch (error) {
    console.error(
      "[ASSETS] Failed to delete asset:",
      error
    );

    const message = error instanceof Error ? error.message : "Failed to delete asset.";
    if (message === "ASSET_NOT_FOUND") {
      return res.status(404).json({ success: false, code: "ASSET_NOT_FOUND", message: "Asset was not found." });
    }
    if (message === "ASSET_HAS_ASSIGNMENTS") {
      return res.status(409).json({ success: false, code: "ASSET_HAS_ASSIGNMENTS", message: "Assigned assets cannot be deleted. Return all assignments first." });
    }
    if (message === "ACTIVE_ASSET_CANNOT_BE_DELETED") {
      return res.status(409).json({ success: false, code: "ACTIVE_ASSET_CANNOT_BE_DELETED", message: "Active assets cannot be deleted. Retire or deactivate the asset instead." });
    }
    return res.status(500).json({ success: false, code: "ASSET_DELETE_FAILED", message: "Failed to delete asset." });
  }
};
