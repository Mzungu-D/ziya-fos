import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

/* =========================================================
   INCOME STATEMENT
========================================================= */

export const getIncomeStatement = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    /* =====================================================
       REPORT PERIOD
    ===================================================== */

    const {
      startDate,
      endDate,
    } = req.query;

    const dateFilter: {
      gte?: Date;
      lte?: Date;
    } = {};

    if (startDate) {
      const parsedStartDate =
        new Date(String(startDate));

      if (
        Number.isNaN(
          parsedStartDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate",
        });
      }

      parsedStartDate.setHours(
        0,
        0,
        0,
        0
      );

      dateFilter.gte =
        parsedStartDate;
    }

    if (endDate) {
      const parsedEndDate =
        new Date(String(endDate));

      if (
        Number.isNaN(
          parsedEndDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid endDate",
        });
      }

      parsedEndDate.setHours(
        23,
        59,
        59,
        999
      );

      dateFilter.lte =
        parsedEndDate;
    }

    if (
      dateFilter.gte &&
      dateFilter.lte &&
      dateFilter.gte >
        dateFilter.lte
    ) {
      return res.status(400).json({
        success: false,
        message:
          "startDate cannot be after endDate",
      });
    }

    /* =====================================================
       TENANT ACCOUNTS
    ===================================================== */

    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId,
          type: {
            in: [
              "REVENUE",
              "EXPENSE",
            ],
          },
        },

        orderBy: {
          code: "asc",
        },
      });

    /* =====================================================
       POSTED JOURNAL ENTRIES
       
       JournalEntryLine is authoritative.
    ===================================================== */

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,
          status: { in: ["POSTED", "APPROVED"] },

          ...(dateFilter.gte ||
          dateFilter.lte
            ? {
                transactionDate:
                  dateFilter,
              }
            : {}),
        },

        select: {
          lines: {
            select: {
              accountId: true,
              debit: true,
              credit: true,
            },
          },
        },
      });

    /* =====================================================
       ACCOUNT MOVEMENTS
    ===================================================== */

    const movements = new Map<
      string,
      {
        debit: number;
        credit: number;
      }
    >();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const movement =
          movements.get(line.accountId) ?? {
            debit: 0,
            credit: 0,
          };

        movement.debit +=
          Number(line.debit);

        movement.credit +=
          Number(line.credit);

        movements.set(
          line.accountId,
          movement
        );
      }
    }

    /* =====================================================
       REVENUE
    ===================================================== */

    const revenue = accounts
      .filter(
        (account) =>
          account.type === "REVENUE"
      )
      .map((account) => {
        const movement =
          movements.get(account.id) ?? {
            debit: 0,
            credit: 0,
          };

        return {
          id: account.id,
          code: account.code,
          name: account.name,

          amount:
            movement.credit -
            movement.debit,
        };
      })
      .filter(
        (account) =>
          Math.abs(account.amount) >=
          0.01
      );

    /* =====================================================
       EXPENSES
    ===================================================== */

    const expenses = accounts
      .filter(
        (account) =>
          account.type === "EXPENSE"
      )
      .map((account) => {
        const movement =
          movements.get(account.id) ?? {
            debit: 0,
            credit: 0,
          };

        return {
          id: account.id,
          code: account.code,
          name: account.name,

          amount:
            movement.debit -
            movement.credit,
        };
      })
      .filter(
        (account) =>
          Math.abs(account.amount) >=
          0.01
      );

    /* =====================================================
       TOTALS
    ===================================================== */

    const totalRevenue =
      revenue.reduce(
        (total, account) =>
          total + account.amount,
        0
      );

    const totalExpenses =
      expenses.reduce(
        (total, account) =>
          total + account.amount,
        0
      );

    const netProfit =
      totalRevenue -
      totalExpenses;

    const profitMargin =
      totalRevenue !== 0
        ? (netProfit /
            totalRevenue) *
          100
        : 0;

    return res.status(200).json({
      success: true,

      revenue,
      expenses,

      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        profitMargin,
      },

      meta: {
        organizationId,

        startDate:
          dateFilter.gte
            ?.toISOString() ?? null,

        endDate:
          dateFilter.lte
            ?.toISOString() ?? null,

        postedEntries:
          entries.length,

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "INCOME STATEMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate income statement",
    });
  }
};
