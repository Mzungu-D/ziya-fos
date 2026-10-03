import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

/**
 * =========================================================
 * DASHBOARD CONTROLLER
 * =========================================================
 *
 * Production dashboard endpoints.
 *
 * IMPORTANT:
 * - Every query is tenant-scoped.
 * - organizationId is taken from the authenticated session.
 * - The client cannot provide or override organizationId.
 * - Dashboard financial activity comes from JournalEntry,
 *   which is the authoritative accounting source.
 * - Only effective accounting entries are exposed.
 *
 * =========================================================
 */

const EFFECTIVE_STATUSES = ["POSTED", "APPROVED"] as const;

const DEFAULT_TRANSACTION_LIMIT = 5;
const MAX_TRANSACTION_LIMIT = 20;

type TenantContext = {
  userId: string;
  organizationId: string;
};

type DashboardTransaction = {
  id: string;
  reference: string;
  description: string;
  amount: number;
  transactionDate: string;
  createdAt: string;
  status: string;
  entryType: "JOURNAL";
};

/**
 * Resolve and validate the authenticated tenant context.
 *
 * Tenant identity MUST come from the authenticated session.
 * It must never come from req.query, req.body or req.params.
 */
function getTenantContext(
  req: AuthRequest
): TenantContext | null {
  const userId = req.user?.userId?.trim();
  const organizationId = req.user?.organizationId?.trim();

  if (!userId || !organizationId) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  /**
   * Tenant dashboard data must not be exposed to
   * non-tenant sessions.
   */
  if (
    sessionType &&
    sessionType !== "TENANT"
  ) {
    return null;
  }

  return {
    userId,
    organizationId,
  };
}

/**
 * Safely parse the transaction limit.
 */
function getTransactionLimit(
  req: AuthRequest
): number {
  const rawLimit = req.query.limit;

  if (
    typeof rawLimit !== "string" ||
    rawLimit.trim() === ""
  ) {
    return DEFAULT_TRANSACTION_LIMIT;
  }

  const parsedLimit = Number(rawLimit);

  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1
  ) {
    return DEFAULT_TRANSACTION_LIMIT;
  }

  return Math.min(
    parsedLimit,
    MAX_TRANSACTION_LIMIT
  );
}

/**
 * GET /api/dashboard/recent-transactions
 *
 * Returns the most recent posted/approved accounting
 * transactions for the authenticated organization.
 */
export const getRecentTransactions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const tenant = getTenantContext(req);

    if (!tenant) {
      res.status(401).json({
        success: false,
        message:
          "Authenticated tenant context is required.",
      });
      return;
    }

    const limit = getTransactionLimit(req);

    /**
     * Explicit tenant-scoped query.
     *
     * No organization supplied by the frontend is trusted.
     */
    const where: Prisma.JournalEntryWhereInput = {
      organizationId: tenant.organizationId,

      status: {
        in: [...EFFECTIVE_STATUSES],
      },
    };

    const journalEntries =
      await prisma.journalEntry.findMany({
        where,

        orderBy: [
          {
            transactionDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        take: limit,

        select: {
          id: true,
          reference: true,
          description: true,
          amount: true,
          transactionDate: true,
          createdAt: true,
          status: true,
        },
      });

    const transactions: DashboardTransaction[] =
      journalEntries.map((entry) => ({
        id: entry.id,

        reference:
          entry.reference?.trim() ||
          "Unreferenced Journal",

        description:
          entry.description?.trim() ||
          "Journal transaction",

        amount:
          typeof entry.amount === "number"
            ? entry.amount
            : Number(entry.amount),

        transactionDate:
          entry.transactionDate.toISOString(),

        createdAt:
          entry.createdAt.toISOString(),

        status:
          String(entry.status),

        entryType: "JOURNAL",
      }));

    res.status(200).json({
      success: true,

      transactions,

      meta: {
        count: transactions.length,
        limit,
      },
    });
  } catch (error) {
    console.error(
      "[DashboardController] Failed to load recent transactions:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to load recent transactions.",
    });
  }
};
