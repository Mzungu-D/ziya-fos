import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

type TenantContext = {
  userId: string;
  organizationId: string;
};

function tenant(req: AuthRequest): TenantContext | null {
  const userId = req.user?.userId?.trim();
  const organizationId = req.user?.organizationId?.trim();
  if (!userId || !organizationId) return null;

  const sessionType = (
    req.user as AuthRequest["user"] & { sessionType?: string }
  ).sessionType;

  if (sessionType && sessionType !== "TENANT") return null;
  return { userId, organizationId };
}

function text(value: unknown, max = 255): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value: unknown, max = 255): string | null {
  const result = text(value, max);
  return result || null;
}

function date(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decimal(value: unknown, max = 999999999999.99): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

function jsonObject(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Prisma.InputJsonValue;
}

function failure(
  res: Response,
  code: string,
  message: string,
  status = 400,
) {
  return res.status(status).json({ success: false, code, message });
}

async function audit(
  organizationId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        organizationId,
        user: userId,
        action,
        module: "TAX",
        details: JSON.stringify(details),
      },
    });
  } catch (error) {
    console.error("[TAX AUDIT] Failed to write audit record:", error);
  }
}

function ensureEffectiveRange(
  effectiveFrom: Date | null,
  effectiveTo: Date | null,
) {
  if (!effectiveFrom) return "Effective-from date is required.";
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    return "Effective-to date cannot be before effective-from date.";
  }
  return null;
}

async function ensureTaxCode(
  organizationId: string,
  taxCodeId: string,
) {
  return prisma.taxCode.findFirst({
    where: { id: taxCodeId, organizationId },
    select: { id: true, taxRegimeId: true, isActive: true },
  });
}

async function ensureTaxRegime(
  organizationId: string,
  taxRegimeId: string,
) {
  return prisma.taxRegime.findFirst({
    where: { id: taxRegimeId, organizationId },
    select: { id: true, currency: true, isActive: true },
  });
}

async function ensureTaxPeriod(
  organizationId: string,
  taxPeriodId: string,
) {
  return prisma.taxPeriod.findFirst({
    where: { id: taxPeriodId, organizationId },
    select: {
      id: true,
      taxRegimeId: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      currency: true,
      filingDueDate: true,
    },
  });
}

/**
 * GET /api/tax/configuration
 * Tenant-scoped tax master data, periods, transactions, returns and GL accounts.
 */
export const getTaxConfiguration = async (
  req: AuthRequest,
  res: Response,
) => {
  const context = tenant(req);
  if (!context) {
    return failure(
      res,
      "TENANT_SESSION_REQUIRED",
      "A tenant session is required.",
      403,
    );
  }

  try {
    const [
      regimes,
      codes,
      rates,
      rules,
      mappings,
      periods,
      transactions,
      returns,
      accounts,
    ] = await Promise.all([
      prisma.taxRegime.findMany({
        where: { organizationId: context.organizationId },
        orderBy: [{ isActive: "desc" }, { code: "asc" }],
      }),
      prisma.taxCode.findMany({
        where: { organizationId: context.organizationId },
        include: { taxRegime: true },
        orderBy: [{ isActive: "desc" }, { code: "asc" }],
      }),
      prisma.taxRate.findMany({
        where: { organizationId: context.organizationId },
        include: { taxCode: true },
        orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
      }),
      prisma.taxRule.findMany({
        where: { organizationId: context.organizationId },
        include: { taxRegime: true, taxCode: true },
        orderBy: [{ priority: "asc" }, { code: "asc" }],
      }),
      prisma.taxAccountMapping.findMany({
        where: { organizationId: context.organizationId },
        include: { taxCode: true, account: true },
        orderBy: [{ taxCodeId: "asc" }, { mappingType: "asc" }],
      }),
      prisma.taxPeriod.findMany({
        where: { organizationId: context.organizationId },
        include: { taxRegime: true },
        orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      }),
      prisma.taxTransaction.findMany({
        where: { organizationId: context.organizationId },
        include: { taxCode: true, taxPeriod: true },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        take: 500,
      }),
      prisma.taxReturn.findMany({
        where: { organizationId: context.organizationId },
        include: { taxRegime: true, taxPeriod: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 250,
      }),
      prisma.account.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, code: true, name: true, type: true },
        orderBy: [{ code: "asc" }],
        take: 2000,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        regimes,
        codes,
        rates,
        rules,
        mappings,
        periods,
        transactions,
        returns,
        accounts,
      },
    });
  } catch (error) {
    console.error("[TAX] Configuration fetch failed:", error);
    return failure(
      res,
      "TAX_CONFIGURATION_FETCH_FAILED",
      "Failed to load tax configuration.",
      500,
    );
  }
};

/**
 * TAX REGIMES
 */
export const createTaxRegime = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const code = text(req.body?.code, 80).toUpperCase();
  const name = text(req.body?.name);
  const taxType = text(req.body?.taxType, 80).toUpperCase();
  const countryCode = text(req.body?.countryCode, 10).toUpperCase() || "KE";
  const currency = text(req.body?.currency, 10).toUpperCase() || "KES";

  if (!code || !name || !taxType) {
    return failure(res, "TAX_REGIME_FIELDS_REQUIRED", "Code, name and tax type are required.");
  }

  try {
    const existing = await prisma.taxRegime.findFirst({
      where: { organizationId: context.organizationId, code },
      select: { id: true },
    });
    if (existing) {
      return failure(res, "TAX_REGIME_EXISTS", "A tax regime with this code already exists.", 409);
    }

    const created = await prisma.taxRegime.create({
      data: {
        organizationId: context.organizationId,
        code,
        name,
        taxType,
        countryCode,
        currency,
        registrationNumber: optionalText(req.body?.registrationNumber, 120),
        description: optionalText(req.body?.description, 1000),
      },
    });

    await audit(context.organizationId, context.userId, "CREATE", {
      entity: "TaxRegime",
      entityId: created.id,
      code: created.code,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[TAX] Regime creation failed:", error);
    return failure(res, "TAX_REGIME_CREATE_FAILED", "Failed to create tax regime.", 500);
  }
};

export const updateTaxRegime = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  if (!id) return failure(res, "TAX_REGIME_ID_REQUIRED", "Tax regime ID is required.");

  try {
    const existing = await prisma.taxRegime.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!existing) return failure(res, "TAX_REGIME_NOT_FOUND", "Tax regime was not found.", 404);

    const code = text(req.body?.code, 80).toUpperCase();
    const name = text(req.body?.name);
    const taxType = text(req.body?.taxType, 80).toUpperCase();
    if (!code || !name || !taxType) {
      return failure(res, "TAX_REGIME_FIELDS_REQUIRED", "Code, name and tax type are required.");
    }

    const duplicate = await prisma.taxRegime.findFirst({
      where: {
        organizationId: context.organizationId,
        code,
        NOT: { id },
      },
      select: { id: true },
    });
    if (duplicate) return failure(res, "TAX_REGIME_EXISTS", "Another tax regime already uses this code.", 409);

    const updated = await prisma.taxRegime.update({
      where: { id },
      data: {
        code,
        name,
        taxType,
        countryCode: text(req.body?.countryCode, 10).toUpperCase() || existing.countryCode,
        currency: text(req.body?.currency, 10).toUpperCase() || existing.currency,
        registrationNumber: optionalText(req.body?.registrationNumber, 120),
        description: optionalText(req.body?.description, 1000),
        isActive: booleanValue(req.body?.isActive, existing.isActive),
      },
    });

    await audit(context.organizationId, context.userId, "UPDATE", {
      entity: "TaxRegime",
      entityId: id,
      before: existing,
      after: updated,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[TAX] Regime update failed:", error);
    return failure(res, "TAX_REGIME_UPDATE_FAILED", "Failed to update tax regime.", 500);
  }
};

/**
 * TAX CODES
 */
export const createTaxCode = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const taxRegimeId = text(req.body?.taxRegimeId, 100);
  const code = text(req.body?.code, 80).toUpperCase();
  const name = text(req.body?.name);
  const defaultRate = decimal(req.body?.defaultRate, 100);
  const recoverabilityRate = decimal(req.body?.recoverabilityRate ?? 0, 100);

  if (!taxRegimeId || !code || !name || defaultRate === null || recoverabilityRate === null) {
    return failure(res, "TAX_CODE_FIELDS_INVALID", "Regime, code, name and valid rates are required.");
  }

  try {
    const regime = await ensureTaxRegime(context.organizationId, taxRegimeId);
    if (!regime) return failure(res, "TAX_REGIME_NOT_FOUND", "Tax regime was not found.", 404);

    const existing = await prisma.taxCode.findFirst({
      where: { organizationId: context.organizationId, code },
      select: { id: true },
    });
    if (existing) return failure(res, "TAX_CODE_EXISTS", "A tax code with this code already exists.", 409);

    const created = await prisma.taxCode.create({
      data: {
        organizationId: context.organizationId,
        taxRegimeId,
        code,
        name,
        description: optionalText(req.body?.description, 1000),
        direction: text(req.body?.direction, 30).toUpperCase() || "OUTPUT",
        treatment: text(req.body?.treatment, 40).toUpperCase() || "STANDARD",
        calculationMethod: text(req.body?.calculationMethod, 40).toUpperCase() || "PERCENTAGE",
        defaultRate,
        isInclusive: booleanValue(req.body?.isInclusive),
        isRecoverable: booleanValue(req.body?.isRecoverable),
        recoverabilityRate,
        isWithholding: booleanValue(req.body?.isWithholding),
        isReverseCharge: booleanValue(req.body?.isReverseCharge),
        isExempt: booleanValue(req.body?.isExempt),
        isZeroRated: booleanValue(req.body?.isZeroRated),
      },
    });

    await audit(context.organizationId, context.userId, "CREATE", {
      entity: "TaxCode",
      entityId: created.id,
      code: created.code,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[TAX] Tax code creation failed:", error);
    return failure(res, "TAX_CODE_CREATE_FAILED", "Failed to create tax code.", 500);
  }
};

export const updateTaxCode = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  if (!id) return failure(res, "TAX_CODE_ID_REQUIRED", "Tax code ID is required.");

  try {
    const existing = await prisma.taxCode.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!existing) return failure(res, "TAX_CODE_NOT_FOUND", "Tax code was not found.", 404);

    const taxRegimeId = text(req.body?.taxRegimeId, 100) || existing.taxRegimeId;
    const regime = await ensureTaxRegime(context.organizationId, taxRegimeId);
    if (!regime) return failure(res, "TAX_REGIME_NOT_FOUND", "Tax regime was not found.", 404);

    const code = text(req.body?.code, 80).toUpperCase();
    const name = text(req.body?.name);
    const defaultRate = decimal(req.body?.defaultRate, 100);
    const recoverabilityRate = decimal(req.body?.recoverabilityRate, 100);

    if (!code || !name || defaultRate === null || recoverabilityRate === null) {
      return failure(res, "TAX_CODE_FIELDS_INVALID", "Code, name and valid rates are required.");
    }

    const duplicate = await prisma.taxCode.findFirst({
      where: { organizationId: context.organizationId, code, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return failure(res, "TAX_CODE_EXISTS", "Another tax code already uses this code.", 409);

    const updated = await prisma.taxCode.update({
      where: { id },
      data: {
        taxRegimeId,
        code,
        name,
        description: optionalText(req.body?.description, 1000),
        direction: text(req.body?.direction, 30).toUpperCase() || existing.direction,
        treatment: text(req.body?.treatment, 40).toUpperCase() || existing.treatment,
        calculationMethod: text(req.body?.calculationMethod, 40).toUpperCase() || existing.calculationMethod,
        defaultRate,
        isInclusive: booleanValue(req.body?.isInclusive, existing.isInclusive),
        isRecoverable: booleanValue(req.body?.isRecoverable, existing.isRecoverable),
        recoverabilityRate,
        isWithholding: booleanValue(req.body?.isWithholding, existing.isWithholding),
        isReverseCharge: booleanValue(req.body?.isReverseCharge, existing.isReverseCharge),
        isExempt: booleanValue(req.body?.isExempt, existing.isExempt),
        isZeroRated: booleanValue(req.body?.isZeroRated, existing.isZeroRated),
        isActive: booleanValue(req.body?.isActive, existing.isActive),
      },
    });

    await audit(context.organizationId, context.userId, "UPDATE", {
      entity: "TaxCode",
      entityId: id,
      before: existing,
      after: updated,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[TAX] Tax code update failed:", error);
    return failure(res, "TAX_CODE_UPDATE_FAILED", "Failed to update tax code.", 500);
  }
};

/**
 * TAX RATES
 */
export const createTaxRate = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const taxCodeId = text(req.body?.taxCodeId, 100);
  const name = text(req.body?.name);
  const rate = decimal(req.body?.rate, 100);
  const effectiveFrom = date(req.body?.effectiveFrom);
  const effectiveTo = date(req.body?.effectiveTo);
  const rangeError = ensureEffectiveRange(effectiveFrom, effectiveTo);

  if (!taxCodeId || !name || rate === null || rangeError) {
    return failure(res, "TAX_RATE_FIELDS_INVALID", rangeError || "Tax code, name and a valid rate are required.");
  }

  const roundingScale = integer(req.body?.roundingScale, 2, 0, 6);
  const roundingMode = text(req.body?.roundingMode, 30).toUpperCase() || "HALF_UP";

  try {
    const code = await ensureTaxCode(context.organizationId, taxCodeId);
    if (!code) return failure(res, "TAX_CODE_NOT_FOUND", "Tax code was not found.", 404);

    const overlap = await prisma.taxRate.findFirst({
      where: {
        organizationId: context.organizationId,
        taxCodeId,
        isActive: true,
        effectiveFrom: { lte: effectiveTo || new Date("9999-12-31T23:59:59.999Z") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom! } }],
      },
      select: { id: true },
    });
    if (overlap) {
      return failure(res, "TAX_RATE_OVERLAP", "The effective date range overlaps an active rate.", 409);
    }

    const created = await prisma.taxRate.create({
      data: {
        organizationId: context.organizationId,
        taxCodeId,
        name,
        rate,
        effectiveFrom: effectiveFrom!,
        effectiveTo,
        roundingScale,
        roundingMode,
      },
    });

    await audit(context.organizationId, context.userId, "CREATE", {
      entity: "TaxRate",
      entityId: created.id,
      taxCodeId,
      rate,
      effectiveFrom,
      effectiveTo,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[TAX] Tax rate creation failed:", error);
    return failure(res, "TAX_RATE_CREATE_FAILED", "Failed to create tax rate.", 500);
  }
};

export const updateTaxRate = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  if (!id) return failure(res, "TAX_RATE_ID_REQUIRED", "Tax rate ID is required.");

  try {
    const existing = await prisma.taxRate.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!existing) return failure(res, "TAX_RATE_NOT_FOUND", "Tax rate was not found.", 404);

    const taxCodeId = text(req.body?.taxCodeId, 100) || existing.taxCodeId;
    const code = await ensureTaxCode(context.organizationId, taxCodeId);
    if (!code) return failure(res, "TAX_CODE_NOT_FOUND", "Tax code was not found.", 404);

    const rate = decimal(req.body?.rate, 100);
    const effectiveFrom = date(req.body?.effectiveFrom) || existing.effectiveFrom;
    const effectiveTo = date(req.body?.effectiveTo);
    const rangeError = ensureEffectiveRange(effectiveFrom, effectiveTo);
    if (rate === null || rangeError) {
      return failure(res, "TAX_RATE_FIELDS_INVALID", rangeError || "A valid rate is required.");
    }

    const overlap = await prisma.taxRate.findFirst({
      where: {
        organizationId: context.organizationId,
        taxCodeId,
        isActive: true,
        NOT: { id },
        effectiveFrom: { lte: effectiveTo || new Date("9999-12-31T23:59:59.999Z") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
      },
      select: { id: true },
    });
    if (overlap) return failure(res, "TAX_RATE_OVERLAP", "The effective date range overlaps an active rate.", 409);

    const updated = await prisma.taxRate.update({
      where: { id },
      data: {
        taxCodeId,
        name: text(req.body?.name) || existing.name,
        rate,
        effectiveFrom,
        effectiveTo,
        roundingScale: integer(req.body?.roundingScale, existing.roundingScale, 0, 6),
        roundingMode: text(req.body?.roundingMode, 30).toUpperCase() || existing.roundingMode,
        isActive: booleanValue(req.body?.isActive, existing.isActive),
      },
    });

    await audit(context.organizationId, context.userId, "UPDATE", {
      entity: "TaxRate",
      entityId: id,
      before: existing,
      after: updated,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[TAX] Tax rate update failed:", error);
    return failure(res, "TAX_RATE_UPDATE_FAILED", "Failed to update tax rate.", 500);
  }
};

/**
 * TAX RULES
 */
export const createTaxRule = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const taxRegimeId = text(req.body?.taxRegimeId, 100);
  const taxCodeId = optionalText(req.body?.taxCodeId, 100);
  const code = text(req.body?.code, 80).toUpperCase();
  const name = text(req.body?.name);
  const effectiveFrom = date(req.body?.effectiveFrom);
  const effectiveTo = date(req.body?.effectiveTo);
  const rangeError = ensureEffectiveRange(effectiveFrom, effectiveTo);

  if (!taxRegimeId || !code || !name || rangeError) {
    return failure(res, "TAX_RULE_FIELDS_INVALID", rangeError || "Regime, code, name and effective-from date are required.");
  }

  try {
    const regime = await ensureTaxRegime(context.organizationId, taxRegimeId);
    if (!regime) return failure(res, "TAX_REGIME_NOT_FOUND", "Tax regime was not found.", 404);

    if (taxCodeId) {
      const taxCode = await ensureTaxCode(context.organizationId, taxCodeId);
      if (!taxCode) return failure(res, "TAX_CODE_NOT_FOUND", "Tax code was not found.", 404);
      if (taxCode.taxRegimeId !== taxRegimeId) {
        return failure(res, "TAX_RULE_REGIME_MISMATCH", "The selected tax code belongs to another tax regime.");
      }
    }

    const existing = await prisma.taxRule.findFirst({
      where: { organizationId: context.organizationId, code },
      select: { id: true },
    });
    if (existing) return failure(res, "TAX_RULE_EXISTS", "A tax rule with this code already exists.", 409);

    const created = await prisma.taxRule.create({
      data: {
        organizationId: context.organizationId,
        taxRegimeId,
        taxCodeId,
        code,
        name,
        priority: integer(req.body?.priority, 100, 1, 100000),
        transactionType: optionalText(req.body?.transactionType, 80),
        customerType: optionalText(req.body?.customerType, 80),
        vendorType: optionalText(req.body?.vendorType, 80),
        supplyType: optionalText(req.body?.supplyType, 80),
        jurisdiction: optionalText(req.body?.jurisdiction, 80),
        effectiveFrom: effectiveFrom!,
        effectiveTo,
        conditions: jsonObject(req.body?.conditions),
        actions: jsonObject(req.body?.actions),
        isActive: booleanValue(req.body?.isActive, true),
      },
    });

    await audit(context.organizationId, context.userId, "CREATE", {
      entity: "TaxRule",
      entityId: created.id,
      code: created.code,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[TAX] Tax rule creation failed:", error);
    return failure(res, "TAX_RULE_CREATE_FAILED", "Failed to create tax rule.", 500);
  }
};

export const updateTaxRule = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  if (!id) return failure(res, "TAX_RULE_ID_REQUIRED", "Tax rule ID is required.");

  try {
    const existing = await prisma.taxRule.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!existing) return failure(res, "TAX_RULE_NOT_FOUND", "Tax rule was not found.", 404);

    const taxRegimeId = text(req.body?.taxRegimeId, 100) || existing.taxRegimeId;
    const taxCodeId = optionalText(req.body?.taxCodeId, 100);
    const code = text(req.body?.code, 80).toUpperCase() || existing.code;
    const name = text(req.body?.name) || existing.name;
    const effectiveFrom = date(req.body?.effectiveFrom) || existing.effectiveFrom;
    const effectiveTo = date(req.body?.effectiveTo);
    const rangeError = ensureEffectiveRange(effectiveFrom, effectiveTo);

    const regime = await ensureTaxRegime(context.organizationId, taxRegimeId);
    if (!regime) return failure(res, "TAX_REGIME_NOT_FOUND", "Tax regime was not found.", 404);

    if (taxCodeId) {
      const taxCode = await ensureTaxCode(context.organizationId, taxCodeId);
      if (!taxCode) return failure(res, "TAX_CODE_NOT_FOUND", "Tax code was not found.", 404);
      if (taxCode.taxRegimeId !== taxRegimeId) {
        return failure(res, "TAX_RULE_REGIME_MISMATCH", "The selected tax code belongs to another tax regime.");
      }
    }

    if (rangeError) return failure(res, "TAX_RULE_FIELDS_INVALID", rangeError);

    const duplicate = await prisma.taxRule.findFirst({
      where: { organizationId: context.organizationId, code, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return failure(res, "TAX_RULE_EXISTS", "Another tax rule already uses this code.", 409);

    const updated = await prisma.taxRule.update({
      where: { id },
      data: {
        taxRegimeId,
        taxCodeId,
        code,
        name,
        priority: integer(req.body?.priority, existing.priority, 1, 100000),
        transactionType: optionalText(req.body?.transactionType, 80),
        customerType: optionalText(req.body?.customerType, 80),
        vendorType: optionalText(req.body?.vendorType, 80),
        supplyType: optionalText(req.body?.supplyType, 80),
        jurisdiction: optionalText(req.body?.jurisdiction, 80),
        effectiveFrom,
        effectiveTo,
        conditions: jsonObject(req.body?.conditions),
        actions: jsonObject(req.body?.actions),
        isActive: booleanValue(req.body?.isActive, existing.isActive),
      },
    });

    await audit(context.organizationId, context.userId, "UPDATE", {
      entity: "TaxRule",
      entityId: id,
      before: existing,
      after: updated,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[TAX] Tax rule update failed:", error);
    return failure(res, "TAX_RULE_UPDATE_FAILED", "Failed to update tax rule.", 500);
  }
};

/**
 * TAX ACCOUNT MAPPINGS
 */
export const createTaxAccountMapping = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const taxCodeId = text(req.body?.taxCodeId, 100);
  const accountId = text(req.body?.accountId, 100);
  const mappingType = text(req.body?.mappingType, 50).toUpperCase();
  const effectiveFrom = date(req.body?.effectiveFrom) || new Date();
  const effectiveTo = date(req.body?.effectiveTo);

  if (!taxCodeId || !accountId || !mappingType) {
    return failure(res, "TAX_MAPPING_FIELDS_INVALID", "Tax code, account and mapping type are required.");
  }
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    return failure(res, "INVALID_EFFECTIVE_RANGE", "Effective-to date cannot be before effective-from date.");
  }

  try {
    const taxCode = await ensureTaxCode(context.organizationId, taxCodeId);
    if (!taxCode) return failure(res, "TAX_CODE_NOT_FOUND", "Tax code was not found.", 404);

    const account = await prisma.account.findFirst({
      where: { id: accountId, organizationId: context.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!account) return failure(res, "ACCOUNT_NOT_FOUND", "The selected ledger account was not found.", 404);

    const duplicate = await prisma.taxAccountMapping.findFirst({
      where: {
        organizationId: context.organizationId,
        taxCodeId,
        mappingType,
        accountId,
      },
      select: { id: true },
    });
    if (duplicate) return failure(res, "TAX_MAPPING_EXISTS", "This tax account mapping already exists.", 409);

    if (booleanValue(req.body?.isDefault, true)) {
      await prisma.taxAccountMapping.updateMany({
        where: {
          organizationId: context.organizationId,
          taxCodeId,
          mappingType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const created = await prisma.taxAccountMapping.create({
      data: {
        organizationId: context.organizationId,
        taxCodeId,
        accountId,
        mappingType,
        isDefault: booleanValue(req.body?.isDefault, true),
        effectiveFrom,
        effectiveTo,
      },
      include: { taxCode: true, account: true },
    });

    await audit(context.organizationId, context.userId, "CREATE", {
      entity: "TaxAccountMapping",
      entityId: created.id,
      taxCodeId,
      accountId,
      mappingType,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[TAX] Mapping creation failed:", error);
    return failure(res, "TAX_MAPPING_CREATE_FAILED", "Failed to create tax account mapping.", 500);
  }
};

export const updateTaxAccountMapping = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  if (!id) return failure(res, "TAX_MAPPING_ID_REQUIRED", "Tax account mapping ID is required.");

  try {
    const existing = await prisma.taxAccountMapping.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!existing) return failure(res, "TAX_MAPPING_NOT_FOUND", "Tax account mapping was not found.", 404);

    const taxCodeId = text(req.body?.taxCodeId, 100) || existing.taxCodeId;
    const accountId = text(req.body?.accountId, 100) || existing.accountId;
    const mappingType = text(req.body?.mappingType, 50).toUpperCase() || existing.mappingType;
    const effectiveFrom = date(req.body?.effectiveFrom) || existing.effectiveFrom;
    const effectiveTo = date(req.body?.effectiveTo);

    const taxCode = await ensureTaxCode(context.organizationId, taxCodeId);
    if (!taxCode) return failure(res, "TAX_CODE_NOT_FOUND", "Tax code was not found.", 404);

    const account = await prisma.account.findFirst({
      where: { id: accountId, organizationId: context.organizationId },
      select: { id: true },
    });
    if (!account) return failure(res, "ACCOUNT_NOT_FOUND", "The selected ledger account was not found.", 404);

    if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
      return failure(res, "INVALID_EFFECTIVE_RANGE", "Effective-to date cannot be before effective-from date.");
    }

    const duplicate = await prisma.taxAccountMapping.findFirst({
      where: {
        organizationId: context.organizationId,
        taxCodeId,
        mappingType,
        accountId,
        NOT: { id },
      },
      select: { id: true },
    });
    if (duplicate) return failure(res, "TAX_MAPPING_EXISTS", "This tax account mapping already exists.", 409);

    const isDefault = booleanValue(req.body?.isDefault, existing.isDefault);
    if (isDefault) {
      await prisma.taxAccountMapping.updateMany({
        where: {
          organizationId: context.organizationId,
          taxCodeId,
          mappingType,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.taxAccountMapping.update({
      where: { id },
      data: {
        taxCodeId,
        accountId,
        mappingType,
        isDefault,
        effectiveFrom,
        effectiveTo,
      },
      include: { taxCode: true, account: true },
    });

    await audit(context.organizationId, context.userId, "UPDATE", {
      entity: "TaxAccountMapping",
      entityId: id,
      before: existing,
      after: updated,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[TAX] Mapping update failed:", error);
    return failure(res, "TAX_MAPPING_UPDATE_FAILED", "Failed to update tax account mapping.", 500);
  }
};

export const deactivateTaxAccountMapping = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  if (!id) return failure(res, "TAX_MAPPING_ID_REQUIRED", "Tax account mapping ID is required.");

  try {
    const existing = await prisma.taxAccountMapping.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!existing) return failure(res, "TAX_MAPPING_NOT_FOUND", "Tax account mapping was not found.", 404);

    await prisma.taxAccountMapping.delete({ where: { id } });

    await audit(context.organizationId, context.userId, "DELETE", {
      entity: "TaxAccountMapping",
      entityId: id,
      before: existing,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("[TAX] Mapping deletion failed:", error);
    return failure(res, "TAX_MAPPING_DELETE_FAILED", "Failed to remove tax account mapping.", 500);
  }
};

/**
 * TAX PERIODS
 */
export const createTaxPeriod = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const taxRegimeId = text(req.body?.taxRegimeId, 100);
  const code = text(req.body?.code, 80);
  const name = text(req.body?.name);
  const periodStart = date(req.body?.periodStart);
  const periodEnd = date(req.body?.periodEnd);
  const filingDueDate = date(req.body?.filingDueDate);

  if (!taxRegimeId || !code || !name || !periodStart || !periodEnd) {
    return failure(res, "TAX_PERIOD_FIELDS_INVALID", "Regime, code, name and period dates are required.");
  }
  if (periodEnd.getTime() < periodStart.getTime()) {
    return failure(res, "INVALID_TAX_PERIOD", "Period end cannot be before period start.");
  }
  if (filingDueDate && filingDueDate.getTime() < periodEnd.getTime()) {
    return failure(res, "INVALID_FILING_DUE_DATE", "Filing due date cannot be before period end.");
  }

  try {
    const regime = await ensureTaxRegime(context.organizationId, taxRegimeId);
    if (!regime) return failure(res, "TAX_REGIME_NOT_FOUND", "Tax regime was not found.", 404);

    const overlap = await prisma.taxPeriod.findFirst({
      where: {
        organizationId: context.organizationId,
        taxRegimeId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true },
    });
    if (overlap) return failure(res, "TAX_PERIOD_OVERLAP", "The tax period overlaps an existing period.", 409);

    const created = await prisma.taxPeriod.create({
      data: {
        organizationId: context.organizationId,
        taxRegimeId,
        code,
        name,
        periodStart,
        periodEnd,
        filingDueDate,
        currency: regime.currency,
      },
    });

    await audit(context.organizationId, context.userId, "CREATE", {
      entity: "TaxPeriod",
      entityId: created.id,
      code: created.code,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[TAX] Period creation failed:", error);
    return failure(res, "TAX_PERIOD_CREATE_FAILED", "Failed to create tax period.", 500);
  }
};

export const updateTaxPeriodStatus = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  const requestedStatus = text(req.body?.status, 40).toUpperCase();
  const allowed = new Set(["OPEN", "UNDER_REVIEW", "READY_TO_FILE", "CLOSED"]);

  if (!id || !allowed.has(requestedStatus)) {
    return failure(res, "INVALID_TAX_PERIOD_STATUS", "A valid tax period status is required.");
  }

  try {
    const existing = await prisma.taxPeriod.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!existing) return failure(res, "TAX_PERIOD_NOT_FOUND", "Tax period was not found.", 404);

    const current = existing.status.toUpperCase();
    const transitions: Record<string, string[]> = {
      OPEN: ["UNDER_REVIEW", "CLOSED"],
      UNDER_REVIEW: ["OPEN", "READY_TO_FILE"],
      READY_TO_FILE: ["UNDER_REVIEW", "CLOSED"],
      CLOSED: [],
    };

    if (!transitions[current]?.includes(requestedStatus)) {
      return failure(
        res,
        "INVALID_TAX_PERIOD_TRANSITION",
        `Cannot change tax period from ${current} to ${requestedStatus}.`,
        409,
      );
    }

    if (requestedStatus === "CLOSED") {
      const openReturns = await prisma.taxReturn.count({
        where: {
          organizationId: context.organizationId,
          taxPeriodId: id,
          status: { notIn: ["FILED", "APPROVED"] },
        },
      });
      if (openReturns > 0) {
        return failure(
          res,
          "OPEN_TAX_RETURNS",
          "The period cannot be closed while tax returns remain unapproved or unfiled.",
          409,
        );
      }
    }

    const updated = await prisma.taxPeriod.update({
      where: { id },
      data: {
        status: requestedStatus,
        closedAt: requestedStatus === "CLOSED" ? new Date() : null,
        closedBy: requestedStatus === "CLOSED" ? context.userId : null,
      },
    });

    await audit(context.organizationId, context.userId, "STATUS_CHANGE", {
      entity: "TaxPeriod",
      entityId: id,
      from: current,
      to: requestedStatus,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[TAX] Period status update failed:", error);
    return failure(res, "TAX_PERIOD_STATUS_FAILED", "Failed to update tax period status.", 500);
  }
};

/**
 * TAX RETURNS
 */
async function calculateReturn(
  organizationId: string,
  taxPeriodId: string,
) {
  const period = await ensureTaxPeriod(organizationId, taxPeriodId);
  if (!period) return null;

  const regime = await prisma.taxRegime.findFirst({
    where: { id: period.taxRegimeId, organizationId },
    select: { id: true, taxType: true, currency: true },
  });
  if (!regime) return null;

  const transactions = await prisma.taxTransaction.findMany({
    where: {
      organizationId,
      taxPeriodId,
      status: { not: "VOID" },
    },
    select: {
      taxableAmount: true,
      taxAmount: true,
      recoverableAmount: true,
      direction: true,
      taxCode: {
        select: {
          isWithholding: true,
        },
      },
    },
  });

  let taxableAmount = 0;
  let outputTax = 0;
  let inputTax = 0;
  let withholdingTax = 0;

  for (const transaction of transactions) {
    const taxable = Number(transaction.taxableAmount);
    const tax = Number(transaction.taxAmount);
    taxableAmount += Number.isFinite(taxable) ? taxable : 0;

    if (transaction.taxCode.isWithholding) {
      withholdingTax += Number.isFinite(tax) ? tax : 0;
    } else if (transaction.direction.toUpperCase() === "INPUT") {
      inputTax += Number.isFinite(transaction.recoverableAmount)
        ? Number(transaction.recoverableAmount)
        : 0;
    } else {
      outputTax += Number.isFinite(tax) ? tax : 0;
    }
  }

  return {
    period,
    regime,
    taxableAmount,
    outputTax,
    inputTax,
    withholdingTax,
    netTaxPayable: outputTax - inputTax + withholdingTax,
  };
}

export const createOrRefreshTaxReturn = async (
  req: AuthRequest,
  res: Response,
) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const taxPeriodId = text(req.body?.taxPeriodId, 100);
  const returnType = text(req.body?.returnType, 80).toUpperCase() || "STATUTORY";

  if (!taxPeriodId) return failure(res, "TAX_PERIOD_REQUIRED", "Tax period is required.");

  try {
    const calculated = await calculateReturn(context.organizationId, taxPeriodId);
    if (!calculated) return failure(res, "TAX_PERIOD_NOT_FOUND", "Tax period was not found.", 404);

    if (calculated.period.status.toUpperCase() === "CLOSED") {
      return failure(res, "TAX_PERIOD_CLOSED", "A closed tax period cannot be recalculated.", 409);
    }

    const existing = await prisma.taxReturn.findFirst({
      where: {
        organizationId: context.organizationId,
        taxPeriodId,
        returnType,
      },
    });

    if (existing && !["DRAFT", "UNDER_REVIEW"].includes(existing.status.toUpperCase())) {
      return failure(
        res,
        "TAX_RETURN_LOCKED",
        "This tax return is already approved or filed and cannot be recalculated.",
        409,
      );
    }

    const taxRegimeId = calculated.period.taxRegimeId;
    const obligation = await prisma.taxObligation.findFirst({
      where: {
        organizationId: context.organizationId,
        taxType: calculated.regime.taxType,
        isActive: true,
      },
      select: { id: true },
    });

    const result = existing
      ? await prisma.taxReturn.update({
          where: { id: existing.id },
          data: {
            taxableAmount: calculated.taxableAmount,
            outputTax: calculated.outputTax,
            inputTax: calculated.inputTax,
            withholdingTax: calculated.withholdingTax,
            netTaxPayable: calculated.netTaxPayable,
            preparedBy: context.userId,
            taxObligationId: obligation?.id ?? undefined,
          },
          include: { taxRegime: true, taxPeriod: true, taxObligation: true },
        })
      : await prisma.taxReturn.create({
          data: {
            organizationId: context.organizationId,
            taxRegimeId,
            taxPeriodId,
            taxObligationId: obligation?.id ?? null,
            returnType,
            status: "DRAFT",
            taxableAmount: calculated.taxableAmount,
            outputTax: calculated.outputTax,
            inputTax: calculated.inputTax,
            withholdingTax: calculated.withholdingTax,
            netTaxPayable: calculated.netTaxPayable,
            preparedBy: context.userId,
          },
          include: { taxRegime: true, taxPeriod: true, taxObligation: true },
        });

    await audit(context.organizationId, context.userId, existing ? "RECALCULATE" : "CREATE", {
      entity: "TaxReturn",
      entityId: result.id,
      taxPeriodId,
      returnType,
    });

    return res.status(existing ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    console.error("[TAX] Return calculation failed:", error);
    return failure(res, "TAX_RETURN_CALCULATION_FAILED", "Failed to calculate the tax return.", 500);
  }
};

export const updateTaxReturnStatus = async (req: AuthRequest, res: Response) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const id = text(req.params.id, 100);
  const status = text(req.body?.status, 40).toUpperCase();

  if (!id || !["DRAFT", "UNDER_REVIEW", "APPROVED", "FILED"].includes(status)) {
    return failure(res, "INVALID_TAX_RETURN_STATUS", "A valid tax return status is required.");
  }

  try {
    const existing = await prisma.taxReturn.findFirst({
      where: { id, organizationId: context.organizationId },
      include: { taxPeriod: true },
    });
    if (!existing) return failure(res, "TAX_RETURN_NOT_FOUND", "Tax return was not found.", 404);

    if (existing.taxPeriod.status.toUpperCase() === "CLOSED" && status !== "FILED") {
      return failure(res, "TAX_PERIOD_CLOSED", "The return belongs to a closed tax period.", 409);
    }

    const current = existing.status.toUpperCase();
    const transitions: Record<string, string[]> = {
      DRAFT: ["UNDER_REVIEW"],
      UNDER_REVIEW: ["DRAFT", "APPROVED"],
      APPROVED: ["FILED"],
      FILED: [],
    };

    if (!transitions[current]?.includes(status)) {
      return failure(
        res,
        "INVALID_TAX_RETURN_TRANSITION",
        `Cannot change tax return from ${current} to ${status}.`,
        409,
      );
    }

    const updated = await prisma.taxReturn.update({
      where: { id },
      data: {
        status,
        reviewedBy: status === "UNDER_REVIEW" ? context.userId : existing.reviewedBy,
        approvedBy: status === "APPROVED" ? context.userId : existing.approvedBy,
        approvedAt: status === "APPROVED" ? new Date() : existing.approvedAt,
        filedAt: status === "FILED" ? new Date() : existing.filedAt,
      },
      include: { taxRegime: true, taxPeriod: true },
    });

    await audit(context.organizationId, context.userId, "STATUS_CHANGE", {
      entity: "TaxReturn",
      entityId: id,
      from: current,
      to: status,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[TAX] Return status update failed:", error);
    return failure(res, "TAX_RETURN_STATUS_FAILED", "Failed to update tax return status.", 500);
  }
};

/**
 * Create the compatibility TaxFiling directly from a calculated TaxReturn.
 * This prevents manual tax totals from bypassing the tax transaction engine.
 */
export const createFilingFromTaxReturn = async (
  req: AuthRequest,
  res: Response,
) => {
  const context = tenant(req);
  if (!context) return failure(res, "TENANT_SESSION_REQUIRED", "A tenant session is required.", 403);

  const taxReturnId = text(req.params.id, 100);
  const filingReference = optionalText(req.body?.filingReference, 120);
  const notes = optionalText(req.body?.notes, 2000);

  try {
    const taxReturn = await prisma.taxReturn.findFirst({
      where: { id: taxReturnId, organizationId: context.organizationId },
      include: { taxPeriod: true, taxRegime: true, taxObligation: true },
    });
    if (!taxReturn) return failure(res, "TAX_RETURN_NOT_FOUND", "Tax return was not found.", 404);

    if (!["APPROVED", "FILED"].includes(taxReturn.status.toUpperCase())) {
      return failure(res, "TAX_RETURN_NOT_APPROVED", "Only an approved tax return can create a filing.", 409);
    }

    const obligation = taxReturn.taxObligationId
      ? await prisma.taxObligation.findFirst({
          where: { id: taxReturn.taxObligationId, organizationId: context.organizationId },
        })
      : await prisma.taxObligation.findFirst({
          where: {
            organizationId: context.organizationId,
            taxType: taxReturn.taxRegime.taxType,
            isActive: true,
          },
        });

    if (!obligation) {
      return failure(
        res,
        "TAX_OBLIGATION_NOT_FOUND",
        "No active tax obligation is configured for this tax regime.",
        409,
      );
    }

    const existing = await prisma.taxFiling.findFirst({
      where: {
        organizationId: context.organizationId,
        taxReturnId,
      },
      select: { id: true },
    });
    if (existing) return failure(res, "TAX_FILING_EXISTS", "A filing already exists for this tax return.", 409);

    const adjustments = Number(taxReturn.adjustments);
    const penalties = Number(taxReturn.penalties);
    const interest = Number(taxReturn.interest);
    const taxAmount = Number(taxReturn.netTaxPayable);
    const totalPayable = taxAmount + adjustments + penalties + interest;

    const filing = await prisma.taxFiling.create({
      data: {
        organizationId: context.organizationId,
        taxObligationCode: obligation.taxType,
        taxPeriodId: taxReturn.taxPeriodId,
        taxReturnId,
        taxPeriodStart: taxReturn.taxPeriod.periodStart,
        taxPeriodEnd: taxReturn.taxPeriod.periodEnd,
        dueDate: taxReturn.taxPeriod.filingDueDate || taxReturn.taxPeriod.periodEnd,
        taxableAmount: Number(taxReturn.taxableAmount),
        taxAmount,
        adjustments,
        penalties,
        interest,
        totalPayable,
        filingReference,
        filingStatus: "DRAFT",
        paymentStatus: "UNPAID",
        preparedBy: context.userId,
        notes,
      },
      include: { payments: true },
    });

    await audit(context.organizationId, context.userId, "CREATE", {
      entity: "TaxFiling",
      entityId: filing.id,
      taxReturnId,
    });

    return res.status(201).json({ success: true, data: filing });
  } catch (error) {
    console.error("[TAX] Filing creation failed:", error);
    return failure(res, "TAX_FILING_CREATE_FAILED", "Failed to create the tax filing.", 500);
  }
};
