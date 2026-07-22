import { Request, Response } from "express";
import prisma from "../config/prisma";

/*
|--------------------------------------------------------------------------
| CREATE ACCOUNT
|--------------------------------------------------------------------------
*/
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

    if (!code || !name || !type) {
      return res.status(400).json({
        success: false,
        message: "Code, account name and type are required",
      });
    }

    const existingAccount = await prisma.account.findUnique({
      where: { code },
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: "Account code already exists",
      });
    }

    if (parentId) {
      const parent = await prisma.account.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent account does not exist",
        });
      }
    }

    const account = await prisma.account.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        type: type.trim(),
        description: description?.trim() || null,
        parentId: parentId || null,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    console.error("CREATE ACCOUNT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL ACCOUNTS
|--------------------------------------------------------------------------
*/
export const getAccounts = async (
  req: Request,
  res: Response
) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
          orderBy: {
            code: "asc",
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error("GET ACCOUNTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch accounts",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ONE ACCOUNT
|--------------------------------------------------------------------------
*/
export const getAccount = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const account = await prisma.account.findUnique({
      where: { id },

      include: {
        parent: true,
        children: true,
        debitEntries: true,
        creditEntries: true,
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    return res.status(200).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error("GET ACCOUNT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch account",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE ACCOUNT
|--------------------------------------------------------------------------
*/
export const updateAccount = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const {
      code,
      name,
      type,
      description,
      parentId,
    } = req.body;

    const existingAccount = await prisma.account.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (code && code !== existingAccount.code) {
      const codeExists = await prisma.account.findUnique({
        where: { code },
      });

      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: "Account code already exists",
        });
      }
    }

    if (parentId === id) {
      return res.status(400).json({
        success: false,
        message: "An account cannot be its own parent",
      });
    }

    if (parentId) {
      const parent = await prisma.account.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent account does not exist",
        });
      }
    }

    const account = await prisma.account.update({
      where: { id },

      data: {
        ...(code !== undefined && {
          code: code.trim(),
        }),

        ...(name !== undefined && {
          name: name.trim(),
        }),

        ...(type !== undefined && {
          type: type.trim(),
        }),

        ...(description !== undefined && {
          description: description?.trim() || null,
        }),

        ...(parentId !== undefined && {
          parentId: parentId || null,
        }),
      },

      include: {
        parent: true,
        children: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Account updated successfully",
      account,
    });
  } catch (error) {
    console.error("UPDATE ACCOUNT ERROR:", error);

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
export const deleteAccount = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const account = await prisma.account.findUnique({
      where: { id },

      include: {
        debitEntries: {
          select: { id: true },
        },

        creditEntries: {
          select: { id: true },
        },

        children: {
          select: { id: true },
        },
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (
      account.debitEntries.length > 0 ||
      account.creditEntries.length > 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This account cannot be deleted because it has financial transactions",
      });
    }

    if (account.children.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "This account cannot be deleted because it has sub-accounts",
      });
    }

    await prisma.account.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("DELETE ACCOUNT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};