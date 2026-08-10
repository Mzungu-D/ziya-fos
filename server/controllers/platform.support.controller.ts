import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* ── helpers ─────────────────────────────────────────────── */

async function nextTicketNumber(): Promise<string> {
  const last = await prisma.supportTicket.findFirst({
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });
  const num = last ? parseInt(last.ticketNumber.replace("TKT-", ""), 10) + 1 : 1;
  return `TKT-${String(num).padStart(4, "0")}`;
}

/* =========================================================
   STATS
   GET /api/platform/support/stats
========================================================= */
export const getSupportStats = async (_req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      openCount,
      inProgressCount,
      resolvedToday,
      totalClosed,
      criticalCount,
      allResolved,
    ] = await Promise.all([
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
      prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.supportTicket.count({
        where: { status: "RESOLVED", resolvedAt: { gte: today } },
      }),
      prisma.supportTicket.count({ where: { status: "CLOSED" } }),
      prisma.supportTicket.count({
        where: { priority: "CRITICAL", status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.supportTicket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    /* avg resolution time in hours */
    let avgResolutionHrs = 0;
    if (allResolved.length) {
      const totalMs = allResolved.reduce((acc, t) => {
        return acc + (t.resolvedAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgResolutionHrs = Math.round(totalMs / allResolved.length / 3_600_000);
    }

    /* priority breakdown (open + in_progress only) */
    const priorityBreakdown = await prisma.supportTicket.groupBy({
      by: ["priority"],
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      _count: true,
    });

    /* category breakdown */
    const categoryBreakdown = await prisma.supportTicket.groupBy({
      by: ["category"],
      _count: true,
    });

    return res.json({
      success: true,
      stats: {
        openCount,
        inProgressCount,
        resolvedToday,
        totalClosed,
        criticalCount,
        avgResolutionHrs,
        priorityBreakdown: priorityBreakdown.map((p) => ({
          priority: p.priority,
          count:    p._count,
        })),
        categoryBreakdown: categoryBreakdown.map((c) => ({
          category: c.category,
          count:    c._count,
        })),
      },
    });
  } catch (error) {
    console.error("[PLATFORM] getSupportStats error:", error);
    return res.status(500).json({ success: false, message: "Failed to load support stats." });
  }
};

/* =========================================================
   LIST
   GET /api/platform/support/tickets
========================================================= */
export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page     as string) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 20);
    const search   = (req.query.search   as string) || "";
    const status   = (req.query.status   as string) || "";
    const priority = (req.query.priority as string) || "";
    const category = (req.query.category as string) || "";

    const where: Parameters<typeof prisma.supportTicket.findMany>[0]["where"] = {
      AND: [
        search ? {
          OR: [
            { subject:       { contains: search, mode: "insensitive" } },
            { ticketNumber:  { contains: search, mode: "insensitive" } },
            { organization:  { name: { contains: search, mode: "insensitive" } } },
          ],
        } : {},
        status   ? { status   } : {},
        priority ? { priority } : {},
        category ? { category } : {},
      ],
    };

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip:  (page - 1) * pageSize,
        take:  pageSize,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return res.json({
      success: true,
      tickets,
      pagination: {
        page, pageSize, total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[PLATFORM] getTickets error:", error);
    return res.status(500).json({ success: false, message: "Failed to load tickets." });
  }
};

/* =========================================================
   GET ONE
   GET /api/platform/support/tickets/:id
========================================================= */
export const getTicket = async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
    return res.json({ success: true, ticket });
  } catch (error) {
    console.error("[PLATFORM] getTicket error:", error);
    return res.status(500).json({ success: false, message: "Failed to load ticket." });
  }
};

/* =========================================================
   CREATE
   POST /api/platform/support/tickets
========================================================= */
export const createTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, subject, description, priority, category } = req.body;

    if (!organizationId || !subject || !description) {
      return res.status(400).json({ success: false, message: "organizationId, subject and description are required." });
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    const ticketNumber = await nextTicketNumber();

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        organizationId,
        subject,
        description,
        priority:  priority  || "MEDIUM",
        category:  category  || "GENERAL",
        status:    "OPEN",
      },
      include: { organization: { select: { id: true, name: true } } },
    });

    await prisma.platformAuditLog.create({
      data: {
        action:     "SUPPORT_TICKET_CREATED",
        entityType: "SupportTicket",
        entityId:   ticket.id,
        performedBy: req.user?.id ?? "system",
        details:    { ticketNumber, subject, organizationId },
      },
    });

    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error("[PLATFORM] createTicket error:", error);
    return res.status(500).json({ success: false, message: "Failed to create ticket." });
  }
};

/* =========================================================
   UPDATE
   PATCH /api/platform/support/tickets/:id
========================================================= */
export const updateTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, category, adminNotes } = req.body;

    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Ticket not found." });

    const data: Record<string, unknown> = {};
    if (status)     data.status     = status;
    if (priority)   data.priority   = priority;
    if (category)   data.category   = category;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    if (status === "RESOLVED" && existing.status !== "RESOLVED") {
      data.resolvedAt = new Date();
    }
    if (status === "CLOSED" && existing.status !== "CLOSED") {
      data.closedAt = new Date();
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data,
      include: { organization: { select: { id: true, name: true } } },
    });

    await prisma.platformAuditLog.create({
      data: {
        action:     "SUPPORT_TICKET_UPDATED",
        entityType: "SupportTicket",
        entityId:   ticket.id,
        performedBy: req.user?.id ?? "system",
        details:    { ticketNumber: ticket.ticketNumber, changes: data },
      },
    });

    return res.json({ success: true, ticket });
  } catch (error) {
    console.error("[PLATFORM] updateTicket error:", error);
    return res.status(500).json({ success: false, message: "Failed to update ticket." });
  }
};