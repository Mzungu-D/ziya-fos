import { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const optionalNumber = (value: unknown): number | null => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const optionalDate = (value: unknown): Date | null => {
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
   CREATE PORTFOLIO COMPANY
========================================================= */

export const createPortfolioCompany = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const {
      companyCode,
      companyName,
      registrationNumber,
      kraPin,
      industry,
      businessType,
      contactPerson,
      phoneNumber,
      email,
      address,
      investmentType,
      investmentAmount,
      ownershipPercentage,
      expectedReturn,
      investmentDate,
      currentValuation,
      currentRevenue,
      currentExpenses,
      currentProfit,
      repaymentStatus,
      riskRating,
      status,
    } = req.body;

    if (!companyCode || !companyName) {
      return res.status(400).json({
        success: false,
        message:
          "Company code and company name are required",
      });
    }

    const normalizedCompanyCode =
      String(companyCode).trim();

    const normalizedCompanyName =
      String(companyName).trim();

    if (!normalizedCompanyCode || !normalizedCompanyName) {
      return res.status(400).json({
        success: false,
        message:
          "Company code and company name are required",
      });
    }

    const existingCompany =
      await prisma.portfolioCompany.findFirst({
        where: {
          organizationId,
          companyCode: normalizedCompanyCode,
        },
        select: {
          id: true,
        },
      });

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message:
          "A portfolio company with this code already exists in this organization",
      });
    }

    const parsedInvestmentDate =
      optionalDate(investmentDate);

    if (
      investmentDate &&
      !parsedInvestmentDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid investment date",
      });
    }

    const company =
      await prisma.portfolioCompany.create({
        data: {
          organizationId,

          companyCode:
            normalizedCompanyCode,

          companyName:
            normalizedCompanyName,

          registrationNumber:
            registrationNumber
              ? String(registrationNumber).trim()
              : null,

          kraPin:
            kraPin
              ? String(kraPin).trim()
              : null,

          industry:
            industry
              ? String(industry).trim()
              : null,

          businessType:
            businessType
              ? String(businessType).trim()
              : null,

          contactPerson:
            contactPerson
              ? String(contactPerson).trim()
              : null,

          phoneNumber:
            phoneNumber
              ? String(phoneNumber).trim()
              : null,

          email:
            email
              ? String(email).trim()
              : null,

          address:
            address
              ? String(address).trim()
              : null,

          investmentType:
            investmentType
              ? String(investmentType).trim()
              : null,

          investmentAmount:
            optionalNumber(investmentAmount) ?? 0,

          ownershipPercentage:
            optionalNumber(
              ownershipPercentage
            ),

          expectedReturn:
            optionalNumber(expectedReturn),

          investmentDate:
            parsedInvestmentDate,

          currentValuation:
            optionalNumber(currentValuation),

          currentRevenue:
            optionalNumber(currentRevenue),

          currentExpenses:
            optionalNumber(currentExpenses),

          currentProfit:
            optionalNumber(currentProfit),

          repaymentStatus:
            repaymentStatus
              ? String(repaymentStatus).trim()
              : null,

          riskRating:
            riskRating
              ? String(riskRating).trim()
              : null,

          status:
            status
              ? String(status).trim()
              : "ACTIVE",
        },
      });

    return res.status(201).json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error(
      "CREATE PORTFOLIO COMPANY ERROR:",
      error
    );

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "A portfolio company with this code already exists in this organization",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create portfolio company",
    });
  }
};

/* =========================================================
   GET ALL PORTFOLIO COMPANIES
========================================================= */

export const getPortfolioCompanies = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const companies =
      await prisma.portfolioCompany.findMany({
        where: {
          organizationId,
        },

        include: {
          investments: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      companies,
    });
  } catch (error) {
    console.error(
      "GET PORTFOLIO COMPANIES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch portfolio companies",
    });
  }
};

/* =========================================================
   GET PORTFOLIO COMPANY BY ID
========================================================= */

export const getPortfolioCompanyById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      req.user?.organizationId;

    const id =
      req.params.id as string;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const company =
      await prisma.portfolioCompany.findFirst({
        where: {
          id,
          organizationId,
        },

        include: {
          investments: true,
        },
      });

    if (!company) {
      return res.status(404).json({
        success: false,
        message:
          "Portfolio company not found",
      });
    }

    return res.status(200).json({
      success: true,
      company,
    });
  } catch (error) {
    console.error(
      "GET PORTFOLIO COMPANY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch portfolio company",
    });
  }
};

/* =========================================================
   UPDATE PORTFOLIO COMPANY
========================================================= */

export const updatePortfolioCompany = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      req.user?.organizationId;

    const id =
      req.params.id as string;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const existingCompany =
      await prisma.portfolioCompany.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!existingCompany) {
      return res.status(404).json({
        success: false,
        message:
          "Portfolio company not found",
      });
    }

    const {
      companyCode,
      companyName,
      registrationNumber,
      kraPin,
      industry,
      businessType,
      contactPerson,
      phoneNumber,
      email,
      address,
      investmentType,
      investmentAmount,
      ownershipPercentage,
      expectedReturn,
      investmentDate,
      currentValuation,
      currentRevenue,
      currentExpenses,
      currentProfit,
      repaymentStatus,
      riskRating,
      status,
    } = req.body;

    let normalizedCompanyCode:
      | string
      | undefined;

    if (companyCode !== undefined) {
      normalizedCompanyCode =
        String(companyCode).trim();

      if (!normalizedCompanyCode) {
        return res.status(400).json({
          success: false,
          message:
            "Company code cannot be empty",
        });
      }

      const duplicate =
        await prisma.portfolioCompany.findFirst({
          where: {
            organizationId,
            companyCode:
              normalizedCompanyCode,

            NOT: {
              id,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "A portfolio company with this code already exists in this organization",
        });
      }
    }

    let normalizedCompanyName:
      | string
      | undefined;

    if (companyName !== undefined) {
      normalizedCompanyName =
        String(companyName).trim();

      if (!normalizedCompanyName) {
        return res.status(400).json({
          success: false,
          message:
            "Company name cannot be empty",
        });
      }
    }

    let parsedInvestmentDate:
      | Date
      | null
      | undefined;

    if (investmentDate !== undefined) {
      parsedInvestmentDate =
        optionalDate(investmentDate);

      if (
        investmentDate &&
        !parsedInvestmentDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid investment date",
        });
      }
    }

    const company =
      await prisma.portfolioCompany.update({
        where: {
          id,
        },

        data: {
          ...(normalizedCompanyCode !== undefined
            ? {
                companyCode:
                  normalizedCompanyCode,
              }
            : {}),

          ...(normalizedCompanyName !== undefined
            ? {
                companyName:
                  normalizedCompanyName,
              }
            : {}),

          ...(registrationNumber !== undefined
            ? {
                registrationNumber:
                  registrationNumber
                    ? String(
                        registrationNumber
                      ).trim()
                    : null,
              }
            : {}),

          ...(kraPin !== undefined
            ? {
                kraPin:
                  kraPin
                    ? String(kraPin).trim()
                    : null,
              }
            : {}),

          ...(industry !== undefined
            ? {
                industry:
                  industry
                    ? String(industry).trim()
                    : null,
              }
            : {}),

          ...(businessType !== undefined
            ? {
                businessType:
                  businessType
                    ? String(
                        businessType
                      ).trim()
                    : null,
              }
            : {}),

          ...(contactPerson !== undefined
            ? {
                contactPerson:
                  contactPerson
                    ? String(
                        contactPerson
                      ).trim()
                    : null,
              }
            : {}),

          ...(phoneNumber !== undefined
            ? {
                phoneNumber:
                  phoneNumber
                    ? String(
                        phoneNumber
                      ).trim()
                    : null,
              }
            : {}),

          ...(email !== undefined
            ? {
                email:
                  email
                    ? String(email).trim()
                    : null,
              }
            : {}),

          ...(address !== undefined
            ? {
                address:
                  address
                    ? String(address).trim()
                    : null,
              }
            : {}),

          ...(investmentType !== undefined
            ? {
                investmentType:
                  investmentType
                    ? String(
                        investmentType
                      ).trim()
                    : null,
              }
            : {}),

          ...(investmentAmount !== undefined
            ? {
                investmentAmount:
                  optionalNumber(
                    investmentAmount
                  ) ?? 0,
              }
            : {}),

          ...(ownershipPercentage !== undefined
            ? {
                ownershipPercentage:
                  optionalNumber(
                    ownershipPercentage
                  ),
              }
            : {}),

          ...(expectedReturn !== undefined
            ? {
                expectedReturn:
                  optionalNumber(
                    expectedReturn
                  ),
              }
            : {}),

          ...(parsedInvestmentDate !== undefined
            ? {
                investmentDate:
                  parsedInvestmentDate,
              }
            : {}),

          ...(currentValuation !== undefined
            ? {
                currentValuation:
                  optionalNumber(
                    currentValuation
                  ),
              }
            : {}),

          ...(currentRevenue !== undefined
            ? {
                currentRevenue:
                  optionalNumber(
                    currentRevenue
                  ),
              }
            : {}),

          ...(currentExpenses !== undefined
            ? {
                currentExpenses:
                  optionalNumber(
                    currentExpenses
                  ),
              }
            : {}),

          ...(currentProfit !== undefined
            ? {
                currentProfit:
                  optionalNumber(
                    currentProfit
                  ),
              }
            : {}),

          ...(repaymentStatus !== undefined
            ? {
                repaymentStatus:
                  repaymentStatus
                    ? String(
                        repaymentStatus
                      ).trim()
                    : null,
              }
            : {}),

          ...(riskRating !== undefined
            ? {
                riskRating:
                  riskRating
                    ? String(
                        riskRating
                      ).trim()
                    : null,
              }
            : {}),

          ...(status !== undefined
            ? {
                status:
                  String(status).trim(),
              }
            : {}),
        },
      });

    return res.status(200).json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error(
      "UPDATE PORTFOLIO COMPANY ERROR:",
      error
    );

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "A portfolio company with this code already exists in this organization",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update portfolio company",
    });
  }
};

/* =========================================================
   DELETE PORTFOLIO COMPANY
========================================================= */

export const deletePortfolioCompany = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      req.user?.organizationId;

    const id =
      req.params.id as string;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const company =
      await prisma.portfolioCompany.findFirst({
        where: {
          id,
          organizationId,
        },

        select: {
          id: true,

          _count: {
            select: {
              investments: true,
            },
          },
        },
      });

    if (!company) {
      return res.status(404).json({
        success: false,
        message:
          "Portfolio company not found",
      });
    }

    if (company._count.investments > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Portfolio company cannot be deleted because it has investment records",
      });
    }

    await prisma.portfolioCompany.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Portfolio company deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE PORTFOLIO COMPANY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete portfolio company",
    });
  }
};