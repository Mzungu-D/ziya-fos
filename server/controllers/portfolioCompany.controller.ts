import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPortfolioCompany = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("Incoming Data:", req.body);

    const company = await prisma.portfolioCompany.create({
      data: req.body,
    });

    return res.status(201).json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error("CREATE COMPANY ERROR:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
  }
};

export const getPortfolioCompanies = async (
  req: Request,
  res: Response
) => {
  try {
    const companies = await prisma.portfolioCompany.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      companies,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getPortfolioCompanyById = async (
  req: Request,
  res: Response
) => {
  try {
    const company = await prisma.portfolioCompany.findUnique({
      where: {
        id: req.params.id as string,
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Portfolio company not found",
      });
    }

    return res.status(200).json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updatePortfolioCompany = async (
  req: Request,
  res: Response
) => {
  try {
    const company = await prisma.portfolioCompany.update({
      where: {
        id: req.params.id as string,
      },
      data: req.body,
    });

    return res.status(200).json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deletePortfolioCompany = async (
  req: Request,
  res: Response
) => {
  try {
    await prisma.portfolioCompany.delete({
      where: {
        id: req.params.id as string,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Portfolio company deleted successfully",
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};