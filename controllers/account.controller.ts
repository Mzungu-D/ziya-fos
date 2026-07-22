import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
|--------------------------------------------------------------------------
| GET ALL ACCOUNTS
|--------------------------------------------------------------------------
*/

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
      orderBy: { code: "asc" },
    });

    return res.status(200).json({ success: true, accounts });
  } catch (error) {
    console.error("GET ACCOUNTS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load accounts",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ONE ACCOUNT
|--------------------------------------------------------------------------
*/

export const getAccount = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    return res.status(200).json({ success: true, account });
  } catch (error) {
    console.error("GET ACCOUNT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load account",
    });
  }
};

/*
|--------------------------------------------------------------------------
| CREATE ACCOUNT
|--------------------------------------------------------------------------
*/

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { code, name, type, description, parentId } = req.body;

    if (!code || !name || !type) {
      return res.status(400).json({
        success: false,
        message: "Account code, name and type are required",
      });
    }

    const account = await prisma.account.create({
      data: {
        code: (code as string).trim(),
        name: (name as string).trim(),
        type: type as string,
        description: description ? (description as string).trim() || null : null,
        parentId: parentId ? (parentId as string) : null,
      },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return res.status(201).json({ success: true, account });
  } catch (error: any) {
    console.error("CREATE ACCOUNT ERROR:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "An account with this code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE ACCOUNT
|--------------------------------------------------------------------------
*/

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { code, name, type, description, parentId } = req.body;

    if (!code || !name || !type) {
      return res.status(400).json({
        success: false,
        message: "Account code, name and type are required",
      });
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        code: (code as string).trim(),
        name: (name as string).trim(),
        type: type as string,
        description: description ? (description as string).trim() || null : null,
        parentId: parentId ? (parentId as string) : null,
      },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return res.status(200).json({ success: true, account });
  } catch (error: any) {
    console.error("UPDATE ACCOUNT ERROR:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "An account with this code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update account",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE ACCOUNT
|--------------------------------------------------------------------------
*/

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const account = await prisma.account.findUnique({ where: { id } });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // 1. Delete all journal entries linked to this account
    await prisma.journalEntry.deleteMany({
      where: {
        OR: [
          { debitAccountId: id },
          { creditAccountId: id },
        ],
      },
    });

    // 2. Unlink child accounts
    await prisma.account.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });

    // 3. Delete the account
    await prisma.account.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error: any) {
    console.error("DELETE ACCOUNT ERROR:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};