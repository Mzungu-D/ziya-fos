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
   AUDIT TRAIL HELPERS
========================================================= */

/**
 * Converts technical values such as:
 *
 * EXPENSE_PAYMENT
 * journal-entry
 * payment_reference
 *
 * into readable text.
 */
const humanizeAuditValue = (
  value: unknown
): string => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Converts stored audit actions into
 * professional human-readable labels.
 */
const humanizeAuditAction = (
  action: string
): string => {
  const normalized = String(action || "")
    .trim()
    .toUpperCase();

  const labels: Record<string, string> = {
    CREATE: "Created",
    CREATED: "Created",

    UPDATE: "Updated",
    UPDATED: "Updated",

    DELETE: "Deleted",
    DELETED: "Deleted",

    SUBMIT: "Submitted",
    SUBMITTED: "Submitted",

    APPROVE: "Approved",
    APPROVED: "Approved",

    REJECT: "Rejected",
    REJECTED: "Rejected",

    POST: "Posted",
    POSTED: "Posted",

    REVERSE: "Reversed",
    REVERSED: "Reversed",

    LOGIN: "Logged in",
    LOGOUT: "Logged out",

    VIEW: "Viewed",

    EXPORT: "Exported",
    IMPORT: "Imported",

    PAYMENT: "Processed payment",
    PAID: "Marked as paid",

    ASSIGN: "Assigned",
    UNASSIGN: "Unassigned",

    ACTIVATE: "Activated",
    DEACTIVATE: "Deactivated",

    INVITE: "Invited",
    INVITED: "Invited",
  };

  return (
    labels[normalized] ??
    humanizeAuditValue(normalized)
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
};

/**
 * Converts internal module names into
 * readable business terminology.
 */
const humanizeAuditModule = (
  module: string
): string => {
  const normalized = String(module || "")
    .trim()
    .toUpperCase();

  const labels: Record<string, string> = {
    JOURNAL: "journal entry",
    JOURNAL_ENTRY: "journal entry",

    EXPENSE: "expense",
    EXPENSE_PAYMENT: "expense payment",

    PROCUREMENT: "procurement",

    ACCOUNTS_PAYABLE: "accounts payable",
    ACCOUNTS_RECEIVABLE: "accounts receivable",

    INVOICE: "invoice",
    PAYMENT: "payment",

    PAYROLL: "payroll",

    ASSET: "asset",
    ASSET_ASSIGNMENT: "asset assignment",

    BANK: "bank account",
    BANK_ACCOUNT: "bank account",

    MPESA: "M-Pesa",

    BUDGET: "budget",

    ACCOUNT: "chart of accounts",
    CHART_OF_ACCOUNTS: "chart of accounts",

    USER: "user",
    ORGANIZATION: "organization",

    SETTINGS: "settings",

    AUTH: "authentication",
    AUTHENTICATION: "authentication",

    REPORT: "report",

    APPROVAL: "approval",

    CUSTOMER: "customer",
    VENDOR: "vendor",

    HR: "HR",
    EMPLOYEE: "employee",
  };

  return (
    labels[normalized] ??
    humanizeAuditValue(normalized)
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
};

/**
 * Extract useful business information from
 * structured audit JSON.
 */
const buildAuditSummary = ({
  action,
  module,
  details,
}: {
  action: string;
  module: string;
  details: string;
}): string => {
  const actionLabel =
    humanizeAuditAction(action);

  const moduleLabel =
    humanizeAuditModule(module);

  const rawDetails =
    String(details ?? "").trim();

  if (!rawDetails) {
    return `${actionLabel} ${moduleLabel}`;
  }

  /*
   * Many audit events are stored as JSON.
   * Convert those into readable business summaries.
   */
  try {
    const parsed = JSON.parse(
      rawDetails
    );

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      const reference =
        parsed.expenseCode ??
        parsed.invoiceNumber ??
        parsed.invoiceCode ??
        parsed.reference ??
        parsed.journalReference ??
        parsed.journalCode ??
        parsed.requestCode ??
        parsed.assetCode ??
        parsed.employeeNumber ??
        parsed.paymentReference ??
        parsed.paymentCode ??
        parsed.customerCode ??
        parsed.vendorCode ??
        parsed.code;

      const description =
        parsed.description ??
        parsed.name ??
        parsed.title;

      const amount =
        parsed.amount ??
        parsed.totalAmount ??
        parsed.paymentAmount;

      const currency =
        parsed.currency ??
        parsed.currencyCode;

      const status =
        parsed.status;

      /*
       * Example:
       *
       * Created expense EXP-001 —
       * Office supplies — KES 15,000
       */
      if (
        reference &&
        description &&
        amount !== undefined &&
        amount !== null
      ) {
        const amountText =
          currency
            ? `${humanizeAuditValue(
                currency
              )} ${humanizeAuditValue(
                amount
              )}`
            : humanizeAuditValue(
                amount
              );

        return `${actionLabel} ${moduleLabel} ${humanizeAuditValue(
          reference
        )} — ${humanizeAuditValue(
          description
        )} — ${amountText}`;
      }

      /*
       * Example:
       *
       * Approved expense EXP-001 —
       * Office supplies
       */
      if (
        reference &&
        description
      ) {
        return `${actionLabel} ${moduleLabel} ${humanizeAuditValue(
          reference
        )} — ${humanizeAuditValue(
          description
        )}`;
      }

      /*
       * Example:
       *
       * Approved expense EXP-001
       */
      if (reference) {
        if (status) {
          return `${actionLabel} ${moduleLabel} ${humanizeAuditValue(
            reference
          )} — Status: ${humanizeAuditValue(
            status
          )}`;
        }

        return `${actionLabel} ${moduleLabel} ${humanizeAuditValue(
          reference
        )}`;
      }

      /*
       * Example:
       *
       * Updated expense — Office supplies
       */
      if (description) {
        return `${actionLabel} ${moduleLabel} — ${humanizeAuditValue(
          description
        )}`;
      }

      /*
       * Approval/payment records may contain
       * only an entity ID.
       */
      const entityId =
        parsed.expenseId ??
        parsed.invoiceId ??
        parsed.journalEntryId ??
        parsed.procurementRequestId ??
        parsed.assetId ??
        parsed.paymentId ??
        parsed.customerId ??
        parsed.vendorId ??
        parsed.userId;

      if (entityId) {
        return `${actionLabel} ${moduleLabel} (${String(
          entityId
        )})`;
      }
    }
  } catch {
    /*
     * Not JSON.
     *
     * Existing audit records can already contain
     * useful human-readable descriptions.
     */
  }

  /*
   * Preserve existing plain-text audit details.
   */
  if (
    !rawDetails.startsWith("{") &&
    !rawDetails.startsWith("[")
  ) {
    return rawDetails;
  }

  return `${actionLabel} ${moduleLabel}`;
};

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
        message:
          "Authentication required.",
      });
    }

    const dateFilter =
      getDateFilter(req);

    const accountId =
      typeof req.query.accountId ===
      "string"
        ? req.query.accountId.trim()
        : undefined;

    /*
     * Verify the account belongs to
     * the authenticated organization.
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
          message:
            "Account not found.",
        });
      }
    }

    /*
     * JournalEntryLine is the authoritative
     * accounting source.
     */
    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,

          status: {
            in: [
              "POSTED",
              "APPROVED",
            ],
          },

          ...(hasDateFilter(
            dateFilter
          )
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
            transactionDate:
              "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });

    const data =
      entries.flatMap(
        (entry) =>
          entry.lines
            .filter(
              (line) =>
                !accountId ||
                line.accountId ===
                  accountId
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
                round(
                  Number(
                    line.debit
                  )
                ),

              credit:
                round(
                  Number(
                    line.credit
                  )
                ),

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
        message:
          "Authentication required.",
      });
    }

    const dateFilter =
      getDateFilter(req);

    const status =
      typeof req.query.status ===
      "string"
        ? req.query.status
            .trim()
            .toUpperCase()
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

          ...(hasDateFilter(
            dateFilter
          )
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
          transactionDate:
            "desc",
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
            Number(
              entry.amount
            )
          ),

        status:
          entry.status,

        createdBy:
          entry.createdBy ??
          "-",

        postedBy:
          entry.postedBy ??
          "-",

        approvedBy:
          entry.approvedBy ??
          "-",

        postedAt:
          entry.postedAt,

        approvedAt:
          entry.approvedAt,

        notes:
          entry.notes ??
          "-",
      }));

    const totalAmount =
      entries.reduce(
        (sum, entry) =>
          sum +
          Number(
            entry.amount
          ),
        0
      );

    const postedEntries =
      entries.filter(
        (entry) =>
          entry.status ===
          "POSTED"
      ).length;

    const draftEntries =
      entries.filter(
        (entry) =>
          entry.status ===
          "DRAFT"
      ).length;

    const reversedEntries =
      entries.filter(
        (entry) =>
          entry.status ===
          "REVERSED"
      ).length;

    return res.status(200).json({
      success: true,

      data,

      totals: {
        entries:
          entries.length,

        amount:
          round(
            totalAmount
          ),

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

/**
 * GET /api/financial-reports/audit-trail
 *
 * Tenant-safe audit reporting.
 *
 * Supported query parameters:
 *
 * page
 * pageSize
 * module
 * action
 * user
 * search
 * startDate
 * endDate
 *
 * Examples:
 *
 * ?page=1&pageSize=25
 * ?module=EXPENSE
 * ?action=APPROVED
 * ?user=john@example.com
 * ?search=office
 * ?startDate=2026-09-01&endDate=2026-09-18
 */
export const getAuditTrailReport = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =====================================================
       TENANT SECURITY
    ===================================================== */

    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    /* =====================================================
       PAGINATION
    ===================================================== */

    const parsedPage =
      Number(
        req.query.page ?? 1
      );

    const parsedPageSize =
      Number(
        req.query.pageSize ?? 25
      );

    const page =
      Number.isFinite(
        parsedPage
      ) &&
      parsedPage >= 1
        ? Math.floor(
            parsedPage
          )
        : 1;

    const allowedPageSizes = [
      25,
      50,
      100,
    ];

    const pageSize =
      allowedPageSizes.includes(
        parsedPageSize
      )
        ? parsedPageSize
        : 25;

    /* =====================================================
       FILTERS
    ===================================================== */

    const module =
      typeof req.query.module ===
      "string" &&
      req.query.module.trim()
        ? req.query.module
            .trim()
        : undefined;

    const action =
      typeof req.query.action ===
      "string" &&
      req.query.action.trim()
        ? req.query.action
            .trim()
        : undefined;

    const search =
      typeof req.query.search ===
      "string" &&
      req.query.search.trim()
        ? req.query.search
            .trim()
        : undefined;

    const user =
      typeof req.query.user ===
      "string" &&
      req.query.user.trim()
        ? req.query.user
            .trim()
        : undefined;

    const dateFilter =
      getDateFilter(req);

    /* =====================================================
       RESOLVE USER FILTER
    ===================================================== */

    let matchingUserIds:
      | string[]
      | undefined;

    /*
     * Explicit User filter.
     *
     * Search:
     * - User ID
     * - Name
     * - Email
     *
     * Only active members of the current
     * organization are considered.
     */
    if (user) {
      const matchingMembers =
        await prisma.organizationMember.findMany(
          {
            where: {
              organizationId,

              isActive: true,

              user: {
                OR: [
                  {
                    id: {
                      contains:
                        user,
                      mode: "insensitive",
                    },
                  },

                  {
                    name: {
                      contains:
                        user,
                      mode: "insensitive",
                    },
                  },

                  {
                    email: {
                      contains:
                        user,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },

            select: {
              userId: true,
            },
          }
        );

      matchingUserIds =
        Array.from(
          new Set(
            matchingMembers.map(
              (member) =>
                member.userId
            )
          )
        );

      /*
       * No matching tenant user means
       * there can be no matching audit record.
       */
      if (
        matchingUserIds.length ===
        0
      ) {
        return res.status(200).json({
          success: true,

          data: [],

          totals: {
            auditEvents: 0,
            users: 0,
            modules: 0,
          },

          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },

          meta: {
            organizationId,

            filters: {
              module:
                module ?? null,

              action:
                action ?? null,

              user:
                user ?? null,

              search:
                search ?? null,
            },

            generatedAt:
              new Date().toISOString(),
          },
        });
      }
    }

    /* =====================================================
       SEARCH USER RESOLUTION
    ===================================================== */

    let searchUserIds:
      | string[]
      | undefined;

    /*
     * General search should also understand
     * the actual person's name and email.
     *
     * Example:
     *
     * search=dennis
     * search=dennis@example.com
     */
    if (search) {
      const searchMembers =
        await prisma.organizationMember.findMany(
          {
            where: {
              organizationId,

              isActive: true,

              user: {
                OR: [
                  {
                    id: {
                      contains:
                        search,
                      mode: "insensitive",
                    },
                  },

                  {
                    name: {
                      contains:
                        search,
                      mode: "insensitive",
                    },
                  },

                  {
                    email: {
                      contains:
                        search,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },

            select: {
              userId: true,
            },
          }
        );

      searchUserIds =
        Array.from(
          new Set(
            searchMembers.map(
              (member) =>
                member.userId
            )
          )
        );
    }

    /* =====================================================
       WHERE CLAUSE
    ===================================================== */

    const where = {
      organizationId,

      ...(module
        ? {
            module: {
              contains:
                module,
              mode:
                "insensitive" as const,
            },
          }
        : {}),

      ...(action
        ? {
            action: {
              contains:
                action,
              mode:
                "insensitive" as const,
            },
          }
        : {}),

      ...(matchingUserIds
        ? {
            user: {
              in:
                matchingUserIds,
            },
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                action: {
                  contains:
                    search,
                  mode:
                    "insensitive" as const,
                },
              },

              {
                module: {
                  contains:
                    search,
                  mode:
                    "insensitive" as const,
                },
              },

              {
                details: {
                  contains:
                    search,
                  mode:
                    "insensitive" as const,
                },
              },

              {
                user: {
                  contains:
                    search,
                  mode:
                    "insensitive" as const,
                },
              },

              ...(searchUserIds &&
              searchUserIds.length >
                0
                ? [
                    {
                      user: {
                        in:
                          searchUserIds,
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),

      ...(hasDateFilter(
        dateFilter
      )
        ? {
            createdAt:
              dateFilter,
          }
        : {}),
    };

    /* =====================================================
       FETCH PAGE + TOTAL
    ===================================================== */

    const [
      total,
      records,
    ] = await Promise.all([
      prisma.auditTrail.count({
        where,
      }),

      prisma.auditTrail.findMany({
        where,

        orderBy: [
          {
            createdAt:
              "desc",
          },

          {
            id: "desc",
          },
        ],

        skip:
          (page - 1) *
          pageSize,

        take:
          pageSize,

        select: {
          id: true,
          user: true,
          action: true,
          module: true,
          details: true,
          createdAt: true,
        },
      }),
    ]);

    /* =====================================================
       RESOLVE USERS FOR CURRENT PAGE
    ===================================================== */

    const auditUserIds =
      Array.from(
        new Set(
          records
            .map(
              (record) =>
                record.user
            )
            .filter(
              (value) =>
                Boolean(value) &&
                value !== "SYSTEM"
            )
        )
      );

    const users =
      auditUserIds.length > 0
        ? await prisma.user.findMany(
            {
              where: {
                id: {
                  in:
                    auditUserIds,
                },

                /*
                 * Critical tenant isolation:
                 *
                 * The user must belong to
                 * the organization currently
                 * being viewed.
                 */
                memberships: {
                  some: {
                    organizationId,
                    isActive: true,
                  },
                },
              },

              select: {
                id: true,
                name: true,
                email: true,
              },
            }
          )
        : [];

    const userMap =
      new Map(
        users.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );

    /* =====================================================
       MAP AUDIT RECORDS
    ===================================================== */

    const data =
      records.map((record) => {
        const resolvedUser =
          userMap.get(
            record.user
          );

        const isSystemUser =
          record.user ===
          "SYSTEM";

        const userName =
          resolvedUser?.name?.trim() ||
          resolvedUser?.email?.trim() ||
          (isSystemUser
            ? "System"
            : "Unknown user");

        const userEmail =
          resolvedUser?.email ??
          null;

        return {
          id:
            record.id,

          date:
            record.createdAt,

          createdAt:
            record.createdAt,

          /*
           * Keep the original technical
           * ID for audit/debug purposes.
           */
          userId:
            record.user,

          /*
           * Human-readable identity.
           */
          userName,

          userEmail,

          /*
           * Backward compatibility with
           * the existing Audit Trails UI.
           */
          user:
            userName,

          action:
            record.action,

          module:
            record.module,

          /*
           * Human-readable description
           * for the main table.
           */
          summary:
            buildAuditSummary({
              action:
                record.action,

              module:
                record.module,

              details:
                record.details,
            }),

          /*
           * Preserve the original audit
           * payload for the detail drawer.
           */
          details:
            record.details,
        };
      });

    /* =====================================================
       SUMMARY COUNTS
    ===================================================== */

    /*
     * Use groupBy instead of loading the
     * entire audit table into memory.
     */
    const [
      userGroups,
      moduleGroups,
    ] = await Promise.all([
      prisma.auditTrail.groupBy({
        by: ["user"],
        where,
      }),

      prisma.auditTrail.groupBy({
        by: ["module"],
        where,
      }),
    ]);

    /*
     * Only real tenant users count as
     * active audit users.
     *
     * SYSTEM is not a person.
     */
    const auditTenantUserIds =
      userGroups
        .map(
          (group) =>
            group.user
        )
        .filter(
          (id) =>
            Boolean(id) &&
            id !== "SYSTEM"
        );

    const tenantUsers =
      auditTenantUserIds.length >
      0
        ? await prisma.user.count({
            where: {
              id: {
                in:
                  auditTenantUserIds,
              },

              memberships: {
                some: {
                  organizationId,
                  isActive: true,
                },
              },
            },
          })
        : 0;

    const modules =
      moduleGroups.length;

    const totalPages =
      total > 0
        ? Math.ceil(
            total / pageSize
          )
        : 0;

    /*
     * If a filter change makes the
     * requested page invalid, return
     * an empty page rather than silently
     * changing the requested page.
     */
    const hasPageData =
      total === 0 ||
      page <= totalPages;

    const finalData =
      hasPageData
        ? data
        : [];

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      data: finalData,

      totals: {
        auditEvents:
          total,

        users:
          tenantUsers,

        modules,
      },

      pagination: {
        page,

        pageSize,

        total,

        totalPages,

        hasPreviousPage:
          page > 1 &&
          totalPages > 0,

        hasNextPage:
          page <
            totalPages,
      },

      meta: {
        organizationId,

        filters: {
          module:
            module ?? null,

          action:
            action ?? null,

          user:
            user ?? null,

          search:
            search ?? null,
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
        "Failed to generate audit trail report.",
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
        message:
          "Authentication required.",
      });
    }

    const dateFilter =
      getDateFilter(req);

    const accountType =
      typeof req.query.accountType ===
      "string"
        ? req.query.accountType
            .trim()
            .toUpperCase()
        : undefined;

    const accountId =
      typeof req.query.accountId ===
      "string"
        ? req.query.accountId.trim()
        : undefined;

    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId,

          ...(accountType
            ? {
                type:
                  accountType,
              }
            : {}),

          ...(accountId
            ? {
                id:
                  accountId,
              }
            : {}),
        },

        orderBy: {
          code: "asc",
        },
      });

    /*
     * Explicit account IDs must belong
     * to the current organization.
     */
    if (
      accountId &&
      accounts.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Account not found.",
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
     * JournalEntryLine is the authoritative
     * accounting source.
     */
    const entries =
      accountIds.size > 0
        ? await prisma.journalEntry.findMany(
            {
              where: {
                organizationId,

                status: {
                  in: [
                    "POSTED",
                    "APPROVED",
                  ],
                },

                ...(hasDateFilter(
                  dateFilter
                )
                  ? {
                      transactionDate:
                        dateFilter,
                    }
                  : {}),

                lines: {
                  some: {
                    accountId: {
                      in:
                        Array.from(
                          accountIds
                        ),
                    },
                  },
                },
              },

              select: {
                lines: {
                  select: {
                    accountId:
                      true,

                    debit:
                      true,

                    credit:
                      true,
                  },
                },
              },
            }
          )
        : [];

    const data =
      accounts.map(
        (account) => {
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
                debit -
                  credit
              ),
          };
        }
      );

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
          accountType ??
          "ALL",

        accountId:
          accountId ??
          "ALL",

        selectedAccounts:
          accountIds.size,

        currency:
          "KES",

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