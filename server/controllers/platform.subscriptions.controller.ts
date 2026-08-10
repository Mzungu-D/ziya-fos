import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   GET ALL SUBSCRIPTIONS
   GET /api/platform/subscriptions
========================================================= */
export const getSubscriptions = async (req: AuthRequest, res: Response) => {
  try {
    const q      = typeof req.query.q      === "string" ? req.query.q.trim()      : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const plan   = typeof req.query.plan   === "string" ? req.query.plan.trim()   : "";
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 30);
    const skip   = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (plan)   where.plan   = plan;
    if (q) {
      where.organization = {
        OR: [
          { name:  { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    const [total, subscriptions] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          organization: {
            select: {
              id:      true,
              name:    true,
              slug:    true,
              email:   true,
              country: true,
              status:  true,
              logoUrl: true,
            },
          },
        },
      }),
    ]);

    const [activeCount, trialCount, expiredCount, totalRevenue] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
      prisma.subscription.aggregate({
        where: { status: "ACTIVE" },
        _sum:  { amount: true },
      }),
    ]);

    return res.json({
      success: true,
      subscriptions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      stats: {
        active:         activeCount,
        trial:          trialCount,
        expired:        expiredCount,
        monthlyRevenue: totalRevenue._sum.amount ?? 0,
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Subscriptions fetch failed:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve subscriptions." });
  }
};

/* =========================================================
   GET SINGLE SUBSCRIPTION
   GET /api/platform/subscriptions/:id
========================================================= */
export const getSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Subscription ID is required." });

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true, name: true, slug: true, email: true,
            phoneNumber: true, country: true, status: true, logoUrl: true,
          },
        },
      },
    });

    if (!subscription) return res.status(404).json({ success: false, message: "Subscription not found." });

    return res.json({ success: true, subscription });
  } catch (error) {
    console.error("[PLATFORM] Subscription fetch failed:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve subscription." });
  }
};

/* =========================================================
   CREATE SUBSCRIPTION
   POST /api/platform/subscriptions
========================================================= */
export const createSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const {
      organizationId, plan, status, billingCycle,
      amount, currency, startDate, endDate, trialEndsAt, notes,
    } = req.body as {
      organizationId: string;
      plan:           string;
      status:         string;
      billingCycle:   string;
      amount:         number;
      currency?:      string;
      startDate?:     string;
      endDate?:       string;
      trialEndsAt?:   string;
      notes?:         string;
    };

    if (!organizationId || !plan || !billingCycle || amount == null) {
      return res.status(400).json({
        success: false,
        message: "organizationId, plan, billingCycle and amount are required.",
      });
    }

    const org = await prisma.organization.findUnique({
      where:  { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    const existing = await prisma.subscription.findUnique({ where: { organizationId } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This organization already has a subscription. Edit it instead.",
      });
    }

    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        plan,
        status:       status       ?? "TRIAL",
        billingCycle: billingCycle ?? "MONTHLY",
        amount,
        currency:     currency     ?? "KES",
        startDate:    startDate    ? new Date(startDate)    : new Date(),
        endDate:      endDate      ? new Date(endDate)      : null,
        trialEndsAt:  trialEndsAt  ? new Date(trialEndsAt) : null,
        notes:        notes        ?? null,
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorEmail:  org.name,
        action:      "SUBSCRIPTION_CREATED",
        resource:    "SUBSCRIPTION",
        resourceId:  subscription.id,
        details:     `Created ${plan} subscription for ${org.name}`,
      },
    });

    return res.status(201).json({ success: true, subscription });
  } catch (error) {
    console.error("[PLATFORM] Create subscription failed:", error);
    return res.status(500).json({ success: false, message: "Unable to create subscription." });
  }
};

/* =========================================================
   UPDATE SUBSCRIPTION
   PATCH /api/platform/subscriptions/:id
========================================================= */
export const updateSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Subscription ID is required." });

    const existing = await prisma.subscription.findUnique({
      where:   { id },
      include: { organization: { select: { name: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Subscription not found." });

    const {
      plan, status, billingCycle, amount,
      currency, endDate, trialEndsAt, notes,
    } = req.body as Partial<{
      plan:         string;
      status:       string;
      billingCycle: string;
      amount:       number;
      currency:     string;
      endDate:      string | null;
      trialEndsAt:  string | null;
      notes:        string | null;
    }>;

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...(plan         != null ? { plan }         : {}),
        ...(status       != null ? { status }       : {}),
        ...(billingCycle != null ? { billingCycle } : {}),
        ...(amount       != null ? { amount }       : {}),
        ...(currency     != null ? { currency }     : {}),
        ...(endDate     !== undefined ? { endDate:     endDate     ? new Date(endDate)     : null } : {}),
        ...(trialEndsAt !== undefined ? { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null } : {}),
        ...(notes       !== undefined ? { notes }   : {}),
        ...(status === "CANCELLED"   ? { cancelledAt: new Date() } : {}),
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorEmail:  existing.organization.name,
        action:      "SUBSCRIPTION_UPDATED",
        resource:    "SUBSCRIPTION",
        resourceId:  id,
        details:     `Updated subscription for ${existing.organization.name}`,
      },
    });

    return res.json({ success: true, subscription: updated });
  } catch (error) {
    console.error("[PLATFORM] Update subscription failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update subscription." });
  }
};