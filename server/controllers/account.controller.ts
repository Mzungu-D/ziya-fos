import { Request, Response } from "express";
import prisma from "../config/prisma";

export const createAccount = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      code,
      name,
      type,
      description,
      parentId,
    } = req.body;

    const existingAccount = await prisma.account.findUnique({
      where: {
        code,
      },
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: "Account code already exists",
      });
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        type,
        description,
        parentId,
      },
    });

    return res.status(201).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
};

export const getAccounts = async (
  req: Request,
  res: Response
) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: {
        code: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch accounts",
    });
  }
};