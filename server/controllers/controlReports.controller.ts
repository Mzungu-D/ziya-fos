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
): boolean =>
  Boolean(filter.gte || filter.lte);

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

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,
          status: { in: ["POSTED", "APPROVED"] },

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate:
                  dateFilter,
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
   Production-grade tenant-scoped audit reporting
========================================================= */

export const getAuditTrailReport = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =======================================================
       TENANT SECURITY
    ======================================================= */

    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    /* =======================================================
       PAGINATION
    ======================================================= */

    const rawPage = Number(
      req.query.page ?? 1
    );

    const rawPageSize = Number(
      req.query.pageSize ?? 25
    );

    const page =
      Number.isFinite(rawPage) &&
      rawPage > 0
        ? Math.floor(rawPage)
        : 1;

    const allowedPageSizes = [
      25,
      50,
      100,
    ];

    const pageSize =
      allowedPageSizes.includes(
        rawPageSize
      )
        ? rawPageSize
        : 25;

    const skip =
      (page - 1) * pageSize;

    /* =======================================================
       FILTERS
    ======================================================= */

    const dateFilter =
      getDateFilter(req);

    const module =
      typeof req.query.module === "string" &&
      req.query.module.trim()
        ? req.query.module.trim()
        : undefined;

    const user =
      typeof req.query.user === "string" &&
      req.query.user.trim()
        ? req.query.user.trim()
        : undefined;

    const action =
      typeof req.query.action === "string" &&
      req.query.action.trim()
        ? req.query.action.trim()
        : undefined;

    const search =
      typeof req.query.search === "string" &&
      req.query.search.trim()
        ? req.query.search.trim()
        : undefined;

    /*
     * Support the existing dateFilter values used by
     * the Audit Trail UI.
     *
     * startDate/endDate remain supported through
     * getDateFilter().
     */
    let effectiveDateFilter =
      hasDateFilter(dateFilter)
        ? dateFilter
        : undefined;

    const requestedDateFilter =
      typeof req.query.dateFilter === "string"
        ? req.query.dateFilter
        : "";

    if (
      !effectiveDateFilter &&
      requestedDateFilter
    ) {
      const now = new Date();

      if (
        requestedDateFilter === "today"
      ) {
        const start =
          new Date(now);

        start.setHours(
          0,
          0,
          0,
          0
        );

        const end =
          new Date(now);

        end.setHours(
          23,
          59,
          59,
          999
        );

        effectiveDateFilter = {
          gte: start,
          lte: end,
        };
      }

      if (
        requestedDateFilter === "7d"
      ) {
        const start =
          new Date(now);

        start.setDate(
          start.getDate() - 7
        );

        start.setHours(
          0,
          0,
          0,
          0
        );

        effectiveDateFilter = {
          gte: start,
          lte: now,
        };
      }

      if (
        requestedDateFilter === "30d"
      ) {
        const start =
          new Date(now);

        start.setDate(
          start.getDate() - 30
        );

        start.setHours(
          0,
          0,
          0,
          0
        );

        effectiveDateFilter = {
          gte: start,
          lte: now,
        };
      }

      if (
        requestedDateFilter === "90d"
      ) {
        const start =
          new Date(now);

        start.setDate(
          start.getDate() - 90
        );

        start.setHours(
          0,
          0,
          0,
          0
        );

        effectiveDateFilter = {
          gte: start,
          lte: now,
        };
      }
    }

    /* =======================================================
       WHERE CLAUSE
       Always tenant scoped.
    ======================================================= */

    const where = {
      organizationId,

      ...(module
        ? {
            module: {
              contains: module,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(user
        ? {
            user: {
              contains: user,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(action
        ? {
            action: {
              equals: action,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(effectiveDateFilter
        ? {
            createdAt:
              effectiveDateFilter,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                user: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                action: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                module: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                details: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    /* =======================================================
       DATABASE QUERIES
       Count is independent of the current page.
    ======================================================= */

    const [
      total,
      records,
      summaryRecords,
    ] = await Promise.all([
      prisma.auditTrail.count({
        where,
      }),

      prisma.auditTrail.findMany({
        where,

        select: {
          id: true,
          user: true,
          action: true,
          module: true,
          details: true,
          createdAt: true,
        },

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        skip,

        take: pageSize,
      }),

      /*
       * Summary totals must not be calculated from the
       * current page. This query retrieves only the fields
       * needed for accurate filtered summary statistics.
       */
      prisma.auditTrail.findMany({
        where,

        select: {
          user: true,
          module: true,
        },
      }),
    ]);

    /* =======================================================
       SUMMARY
    ======================================================= */

    const users =
      new Set(
        summaryRecords.map(
          (record) => record.user
        )
      );

    const modules =
      new Set(
        summaryRecords.map(
          (record) => record.module
        )
      );

    /* =======================================================
       RESPONSE DATA
    ======================================================= */

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

    const totalPages =
      total === 0
        ? 1
        : Math.ceil(
            total / pageSize
          );

    /*
     * If a client requests a page beyond the available
     * range, return an empty page rather than leaking
     * records from another range or silently changing
     * the requested page.
     */
    const currentPage =
      page > totalPages
        ? page
        : page;

    return res.status(200).json({
      success: true,

      data,

      totals: {
        auditEvents:
          total,

        users:
          users.size,

        modules:
          modules.size,
      },

      pagination: {
        page: currentPage,

        pageSize,

        total,

        totalPages,
      },

      meta: {
        organizationId,

        filters: {
          search:
            search ?? "",

          module:
            module ?? "",

          action:
            action ?? "",

          user:
            user ?? "",

          dateFilter:
            requestedDateFilter,

          startDate:
            effectiveDateFilter?.gte
              ?.toISOString() ?? null,

          endDate:
            effectiveDateFilter?.lte
              ?.toISOString() ?? null,
        },

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

    const entries =
      accountIds.size > 0
        ? await prisma.journalEntry.findMany({
            where: {
              organizationId,
              status: {
                in: [
                  "POSTED",
                  "APPROVED",
                ],
              },

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

            debit += Number(
              line.debit
            );

            credit += Number(
              line.credit
            );
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