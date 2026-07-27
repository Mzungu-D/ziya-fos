import { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const parseRequiredNumber = (
  value: unknown
): number | null => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
};

const parseOptionalNumber = (
  value: unknown
): number | null => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
};

const parseDate = (
  value: unknown
): Date | null => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
};

/* =========================================================
   CREATE INVESTMENT
========================================================= */

export const createInvestment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message:
          "Organization context is required",
      });
    }

    const {
      investmentCode,
      portfolioCompanyId,
      investmentType,
      fundingRound,
      amount,
      ownershipPercentage,
      valuationBefore,
      valuationAfter,
      expectedReturn,
      investmentDate,
      maturityDate,
      status,
      notes,
    } = req.body;

    if (
      !investmentCode ||
      !portfolioCompanyId ||
      !investmentType ||
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !investmentDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Investment code, portfolio company, investment type, amount and investment date are required",
      });
    }

    const normalizedInvestmentCode =
      String(investmentCode).trim();

    const normalizedInvestmentType =
      String(investmentType).trim();

    if (
      !normalizedInvestmentCode ||
      !normalizedInvestmentType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Investment code and investment type are required",
      });
    }

    /* =====================================================
       VERIFY PORTFOLIO COMPANY BELONGS TO TENANT
    ===================================================== */

    const portfolioCompany =
      await prisma.portfolioCompany.findFirst({
        where: {
          id: String(portfolioCompanyId),
          organizationId,
        },

        select: {
          id: true,
          companyName: true,
        },
      });

    if (!portfolioCompany) {
      return res.status(404).json({
        success: false,
        message:
          "Portfolio company not found",
      });
    }

    /* =====================================================
       TENANT-SCOPED INVESTMENT CODE
    ===================================================== */

    const existingInvestment =
      await prisma.investment.findFirst({
        where: {
          organizationId,
          investmentCode:
            normalizedInvestmentCode,
        },

        select: {
          id: true,
        },
      });

    if (existingInvestment) {
      return res.status(409).json({
        success: false,
        message:
          "Investment code already exists in this organization",
      });
    }

    /* =====================================================
       VALIDATE AMOUNT
    ===================================================== */

    const parsedAmount =
      parseRequiredNumber(amount);

    if (
      parsedAmount === null ||
      parsedAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Investment amount must be a valid non-negative number",
      });
    }

    /* =====================================================
       VALIDATE INVESTMENT DATE
    ===================================================== */

    const parsedInvestmentDate =
      parseDate(investmentDate);

    if (!parsedInvestmentDate) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid investment date",
      });
    }

    /* =====================================================
       VALIDATE MATURITY DATE
    ===================================================== */

    const parsedMaturityDate =
      parseDate(maturityDate);

    if (
      maturityDate &&
      !parsedMaturityDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid maturity date",
      });
    }

    if (
      parsedMaturityDate &&
      parsedMaturityDate <
        parsedInvestmentDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Maturity date cannot be before investment date",
      });
    }

    /* =====================================================
       CREATE
    ===================================================== */

    const investment =
      await prisma.investment.create({
        data: {
          organizationId,

          investmentCode:
            normalizedInvestmentCode,

          portfolioCompanyId:
            portfolioCompany.id,

          investmentType:
            normalizedInvestmentType,

          fundingRound:
            fundingRound
              ? String(fundingRound).trim()
              : null,

          amount:
            parsedAmount,

          ownershipPercentage:
            parseOptionalNumber(
              ownershipPercentage
            ),

          valuationBefore:
            parseOptionalNumber(
              valuationBefore
            ),

          valuationAfter:
            parseOptionalNumber(
              valuationAfter
            ),

          expectedReturn:
            parseOptionalNumber(
              expectedReturn
            ),

          investmentDate:
            parsedInvestmentDate,

          maturityDate:
            parsedMaturityDate,

          status:
            status
              ? String(status).trim()
              : "ACTIVE",

          notes:
            notes
              ? String(notes).trim()
              : null,
        },

        include: {
          portfolioCompany: true,
        },
      });

    return res.status(201).json({
      success: true,
      investment,
    });
  } catch (error: any) {
    console.error(
      "CREATE INVESTMENT ERROR:",
      error
    );

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "Investment code already exists in this organization",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create investment",
    });
  }
};

/* =========================================================
   GET ALL INVESTMENTS
========================================================= */

export const getInvestments = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message:
          "Organization context is required",
      });
    }

    const investments =
      await prisma.investment.findMany({
        where: {
          organizationId,
        },

        include: {
          portfolioCompany: true,
        },

        orderBy: {
          investmentDate: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      investments,
    });
  } catch (error) {
    console.error(
      "GET INVESTMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch investments",
    });
  }
};