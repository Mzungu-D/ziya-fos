import { Request, Response } from "express";
import prisma from "../config/prisma";

/*
|--------------------------------------------------------------------------
| Create Investment
|--------------------------------------------------------------------------
*/
export const createInvestment = async (
  req: Request,
  res: Response
) => {
  try {
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

    const existingInvestment = await prisma.investment.findUnique({
      where: {
        investmentCode,
      },
    });

    if (existingInvestment) {
      return res.status(400).json({
        success: false,
        message: "Investment code already exists",
      });
    }

    const investment = await prisma.investment.create({
      data: {
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
      },
    });

    return res.status(201).json({
      success: true,
      investment,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create investment",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get All Investments
|--------------------------------------------------------------------------
*/
export const getInvestments = async (
  req: Request,
  res: Response
) => {
  try {
    const investments = await prisma.investment.findMany({
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
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch investments",
    });
  }
};