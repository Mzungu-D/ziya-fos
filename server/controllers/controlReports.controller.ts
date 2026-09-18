import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   TYPES
========================================================= */

type DateFilter = {
  gte?: Date;
  lte?: Date;
};

/* =========================================================
   HELPERS
========================================================= */

const round = (value: number): number =>
  Math.round(value * 100) / 100;

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

const getDateFilter = (
  req: AuthRequest
): DateFilter => {
  const filter: DateFilter = {};

  if (req.query.startDate) {
    const startDate = new Date(
      String(req.query.startDate)
    );

    if (!Number.isNaN(startDate.getTime())) {
      startDate.setHours(0, 0, 0, 0);
      filter.gte = startDate;
    }
  }

  if (req.query.endDate) {
    const endDate = new Date(
      String(req.query.endDate)
    );

    if (!Number.isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      filter.lte = endDate;
    }
  }

  return filter;
};

const hasDateFilter = (
  filter: DateFilter
): boolean => Boolean(filter.gte || filter.lte);

/* =========================================================
   GENERAL LEDGER REPORT
========================================================= */

export const getGeneralLedgerReport = async (
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

    const dateFilter = getDateFilter(req);

    const accountId =
      typeof req.query.accountId === "string"
        ? req.query.accountId
        : undefined;

    /*
     * If a specific account was requested, verify that
     * the account belongs to the authenticated tenant.
     */
    if (accountId) {
      const account =
        await prisma.account.findFirst({
          where: {
            id: accountId,
            organizationId,
          },
          select: {
            id: true,
          },
        });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found.",
        });
      }
    }

    /*
     * JournalEntryLine is the authoritative accounting source.
     * A journal can contain more than one debit or credit line,
     * so the ledger must never reconstruct entries from the
     * legacy debitAccountId / creditAccountId / amount fields.
     */
    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,
          status: { in: ["POSTED", "APPROVED"] },

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate: dateFilter,
              }
            : {}),

          ...(accountId
            ? {
                lines: {
                  some: {
                    accountId,
                  },
                },
              }
            : {}),
        },

        select: {
          id: true,
          reference: true,
          description: true,
          transactionDate: true,
          status: true,
          createdAt: true,

          lines: {
            orderBy: {
              lineNumber: "asc",
            },

            select: {
              id: true,
              accountId: true,
              lineNumber: true,
              debit: true,
              credit: true,

              account: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },

        orderBy: [
          {
            transactionDate: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });

    const data = entries.flatMap((entry) =>
      entry.lines
        .filter(
          (line) =>
            !accountId ||
            line.accountId === accountId
        )
        .map((line) => ({
          transactionDate:
            entry.transactionDate,

          reference:
            entry.reference,

          description:
            entry.description,

          accountId:
            line.accountId,

          accountCode:
            line.account.code,

          accountName:
            line.account.name,

          debit:
            round(Number(line.debit)),

          credit:
            round(Number(line.credit)),

          status:
            entry.status,
        }))
    );

    const totalDebit =
      data.reduce(
        (sum, row) =>
          sum + row.debit,
        0
      );

    const totalCredit =
      data.reduce(
        (sum, row) =>
          sum + row.credit,
        0
      );

    return res.status(200).json({
      success: true,

      data,

      totals: {
        debit:
          round(totalDebit),

        credit:
          round(totalCredit),

        difference:
          round(
            totalDebit -
              totalCredit
          ),
      },

      meta: {
        organizationId,

        journalEntries:
          entries.length,

        ledgerLines:
          data.length,

        accountId:
          accountId ?? "ALL",

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "GENERAL LEDGER REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate general ledger report",
    });
  }
};

/* =========================================================
   JOURNAL REPORT
========================================================= */

export const getJournalReport = async (
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

    const dateFilter =
      getDateFilter(req);

    const status =
      typeof req.query.status === "string"
        ? req.query.status.toUpperCase()
        : undefined;

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,

          ...(status
            ? {
                status,
              }
            : {}),

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate:
                  dateFilter,
              }
            : {}),
        },

        include: {
          debitAccount: true,
          creditAccount: true,
        },

        orderBy: {
          transactionDate: "desc",
        },
      });

    const data =
      entries.map((entry) => ({
        id:
          entry.id,

        transactionDate:
          entry.transactionDate,

        reference:
          entry.reference,

        description:
          entry.description,

        debitAccount:
          `${entry.debitAccount.code} - ${entry.debitAccount.name}`,

        creditAccount:
          `${entry.creditAccount.code} - ${entry.creditAccount.name}`,

        amount:
          round(
            Number(entry.amount)
          ),

        status:
          entry.status,

        createdBy:
          entry.createdBy ?? "-",

        postedBy:
          entry.postedBy ?? "-",

        approvedBy:
          entry.approvedBy ?? "-",

        postedAt:
          entry.postedAt,

        approvedAt:
          entry.approvedAt,

        notes:
          entry.notes ?? "-",
      }));

    const totalAmount =
      entries.reduce(
        (sum, entry) =>
          sum +
          Number(entry.amount),
        0
      );

    const postedEntries =
      entries.filter(
        (entry) =>
          entry.status === "POSTED"
      ).length;

    const draftEntries =
      entries.filter(
        (entry) =>
          entry.status === "DRAFT"
      ).length;

    const reversedEntries =
      entries.filter(
        (entry) =>
          entry.status === "REVERSED"
      ).length;

    return res.status(200).json({
      success: true,

      data,

      totals: {
        entries:
          entries.length,

        amount:
          round(totalAmount),

        postedEntries,

        draftEntries,

        reversedEntries,
      },

      meta: {
        organizationId,

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "JOURNAL REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate journal report",
    });
  }
};

/* =========================================================
   AUDIT TRAIL REPORT
========================================================= */

export const getAuditTrailReport = async (
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

    const dateFilter =
      getDateFilter(req);

    const module =
      typeof req.query.module === "string"
        ? req.query.module
        : undefined;

    const user =
      typeof req.query.user === "string"
        ? req.query.user
        : undefined;

    const records =
      await prisma.auditTrail.findMany({
        where: {
          organizationId,

          ...(module
            ? {
                module: {
                  contains: module,
                  mode: "insensitive",
                },
              }
            : {}),

          ...(user
            ? {
                user: {
                  contains: user,
                  mode: "insensitive",
                },
              }
            : {}),

          ...(hasDateFilter(dateFilter)
            ? {
                createdAt:
                  dateFilter,
              }
            : {}),
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    const data =
      records.map((record) => ({
        id:
          record.id,

        date:
          record.createdAt,

        user:
          record.user,

        action:
          record.action,

        module:
          record.module,

        details:
          record.details,
      }));

    const users =
      new Set(
        records.map(
          (record) => record.user
        )
      );

    const modules =
      new Set(
        records.map(
          (record) => record.module
        )
      );

    return res.status(200).json({
      success: true,

      data,

      totals: {
        auditEvents:
          records.length,

        users:
          users.size,

        modules:
          modules.size,
      },

      meta: {
        organizationId,

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "AUDIT TRAIL REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate audit trail report",
    });
  }
};

/* =========================================================
   CUSTOM FINANCIAL REPORT

   Controlled report selection only.
   Arbitrary SQL/database queries are not accepted.
========================================================= */

export const getCustomReport = async (
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

    const dateFilter =
      getDateFilter(req);

    const accountType =
      typeof req.query.accountType === "string"
        ? req.query.accountType.toUpperCase()
        : undefined;

    const accountId =
      typeof req.query.accountId === "string"
        ? req.query.accountId
        : undefined;

    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId,

          ...(accountType
            ? {
                type: accountType,
              }
            : {}),

          ...(accountId
            ? {
                id: accountId,
              }
            : {}),
        },

        orderBy: {
          code: "asc",
        },
      });

    /*
     * If an account ID was explicitly supplied but no
     * account exists inside this organization, do not
     * silently query another tenant's account.
     */
    if (
      accountId &&
      accounts.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const accountIds =
      new Set(
        accounts.map(
          (account) =>
            account.id
        )
      );

    /*
     * JournalEntryLine is the authoritative accounting source.
     * Only posted journal lines belonging to this tenant and
     * selected accounts are included in the report.
     */
    const entries =
      accountIds.size > 0
        ? await prisma.journalEntry.findMany({
            where: {
              organizationId,
              status: { in: ["POSTED", "APPROVED"] },

              ...(hasDateFilter(dateFilter)
                ? {
                    transactionDate:
                      dateFilter,
                  }
                : {}),

              lines: {
                some: {
                  accountId: {
                    in: Array.from(
                      accountIds
                    ),
                  },
                },
              },
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
          })
        : [];

    const data =
      accounts.map((account) => {
        let debit = 0;
        let credit = 0;

        for (const entry of entries) {
          for (const line of entry.lines) {
            if (
              line.accountId !==
              account.id
            ) {
              continue;
            }

            debit += Number(line.debit);
            credit += Number(line.credit);
          }
        }

        return {
          accountId:
            account.id,

          accountCode:
            account.code,

          accountName:
            account.name,

          accountType:
            account.type,

          debit:
            round(debit),

          credit:
            round(credit),

          netBalance:
            round(
              debit - credit
            ),
        };
      });

    const filteredData =
      data.filter(
        (row) =>
          row.debit !== 0 ||
          row.credit !== 0
      );

    const totalDebit =
      filteredData.reduce(
        (sum, row) =>
          sum + row.debit,
        0
      );

    const totalCredit =
      filteredData.reduce(
        (sum, row) =>
          sum + row.credit,
        0
      );

    return res.status(200).json({
      success: true,

      data:
        filteredData,

      totals: {
        accounts:
          filteredData.length,

        debit:
          round(totalDebit),

        credit:
          round(totalCredit),

        netBalance:
          round(
            totalDebit -
              totalCredit
          ),
      },

      meta: {
        organizationId,

        accountType:
          accountType ?? "ALL",

        accountId:
          accountId ?? "ALL",

        selectedAccounts:
          accountIds.size,

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "CUSTOM REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate custom financial report",
    });
  }
};
