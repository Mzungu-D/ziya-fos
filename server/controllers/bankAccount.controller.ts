import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createBankAccount = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      bankName,
      accountName,
      accountNumber,
      branchName,
      currency,
      openingBalance,
      integrationEnabled,
      integrationProvider,
      apiBaseUrl,
      apiKey,
      apiSecret,
      webhookUrl
    } = req.body;

    const bankAccount = await prisma.bankAccount.create({
      data: {
        bankName,
        accountName,
        accountNumber,
        branchName,
        currency: currency || "KES",
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,

        integrationEnabled:
          integrationEnabled || false,

        integrationProvider,
        apiBaseUrl,
        apiKey,
        apiSecret,
        webhookUrl,

        connectionStatus: "DISCONNECTED",
        status: "ACTIVE"
      }
    });

    return res.status(201).json({
      success: true,
      bankAccount
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create bank account"
    });
  }
};

export const getBankAccounts = async (
  req: Request,
  res: Response
) => {
  try {
    const bankAccounts =
      await prisma.bankAccount.findMany({
        orderBy: {
          createdAt: "desc"
        }
      });

    return res.status(200).json({
      success: true,
      bankAccounts
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bank accounts"
    });
  }
};