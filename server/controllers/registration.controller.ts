import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";

/* =========================================================
   HELPERS
========================================================= */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = slugify(base);
  let existing  = await prisma.organization.findUnique({ where: { slug: candidate } });
  let suffix    = 1;
  while (existing) {
    candidate = `${slugify(base)}-${suffix}`;
    existing  = await prisma.organization.findUnique({ where: { slug: candidate } });
    suffix++;
  }
  return candidate;
}

/* =========================================================
   REGISTER ORGANIZATION
   POST /api/auth/register

   Creates:
   1. Organization  (status PENDING – awaits platform approval)
   2. User          (hashed password, role OWNER)
   3. OrganizationMember (role OWNER, isDefault true)
   4. Subscription  (plan STARTER, status TRIAL, amount 0)

   No token is issued. The organisation must be approved
   by a PLATFORM_ADMIN before it can log in.
========================================================= */

export const registerOrganization = async (req: Request, res: Response) => {
  try {
    const orgName     = typeof req.body?.orgName     === "string" ? req.body.orgName.trim()     : "";
    const ownerName   = typeof req.body?.ownerName   === "string" ? req.body.ownerName.trim()   : "";
    const email       = typeof req.body?.email       === "string" ? req.body.email.trim().toLowerCase() : "";
    const password    = typeof req.body?.password    === "string" ? req.body.password            : "";
    const country     = typeof req.body?.country     === "string" ? req.body.country.trim()     : "Kenya";
    const currency    = typeof req.body?.currency    === "string" ? req.body.currency.trim()    : "KES";
    const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : null;

    /* ── Validation ──────────────────────────────────────── */

    if (!orgName)   return res.status(400).json({ success: false, message: "Organisation name is required." });
    if (!ownerName) return res.status(400).json({ success: false, message: "Your full name is required." });
    if (!email)     return res.status(400).json({ success: false, message: "Email address is required." });
    if (!password)  return res.status(400).json({ success: false, message: "Password is required." });

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    /* ── Check email uniqueness ──────────────────────────── */

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address already exists. Please log in instead.",
      });
    }

    /* ── Check org name uniqueness ───────────────────────── */

    const existingOrg = await prisma.organization.findFirst({
      where: { name: { equals: orgName, mode: "insensitive" } },
    });
    if (existingOrg) {
      return res.status(409).json({
        success: false,
        message: "An organisation with this name is already registered. Please choose a different name.",
      });
    }

    /* ── Hash password ───────────────────────────────────── */

    const passwordHash = await bcrypt.hash(password, 12);

    /* ── Generate unique slug ────────────────────────────── */

    const slug = await uniqueSlug(orgName);

    /* ── Create all records in a transaction ─────────────── */

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name:     orgName,
          slug,
          country:  country  || "Kenya",
          currency: currency || "KES",
          status:   "PENDING",
        },
      });

      const user = await tx.user.create({
        data: {
          name:        ownerName,
          email,
          password:    passwordHash,
          role:        "OWNER",
          isActive:    true,
          phoneNumber: phoneNumber || null,
        },
      });

      await tx.organizationMember.create({
        data: {
          userId:         user.id,
          organizationId: organization.id,
          role:           "OWNER",
          isActive:       true,
          isDefault:      true,
        },
      });

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          plan:           "STARTER",
          status:         "TRIAL",
          billingCycle:   "MONTHLY",
          amount:         0,
          currency:       currency || "KES",
          trialEndsAt:    trialEnd,
        },
      });

      return { organization, user };
    });

    /* ── Audit log ───────────────────────────────────────── */

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: result.user.id,
        actorEmail:  email,
        action:      "ORGANIZATION_REGISTERED",
        resource:    "ORGANIZATION",
        resourceId:  result.organization.id,
        details:     `Self-registration: ${orgName} (${email})`,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Registration successful! Your account is under review. " +
        "You will be able to log in once your organisation has been approved.",
      organization: {
        id:   result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
    });
  } catch (error) {
    console.error("[AUTH] Registration failed:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};