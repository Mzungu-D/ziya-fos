import { ensureTenantBaseline } from "../services/tenantProvisioning.service";
import { Request, Response } from "express";

import {
  normalizeKenyanPhoneNumber,
} from "../services/infinityTech.service";
import bcrypt from "bcryptjs";

import prisma from "../config/prisma";
import { sendEmail } from "../config/mailer";

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

  let existing = await prisma.organization.findUnique({
    where: { slug: candidate },
  });

  let suffix = 1;

  while (existing) {
    candidate = `${slugify(base)}-${suffix}`;

    existing = await prisma.organization.findUnique({
      where: { slug: candidate },
    });

    suffix++;
  }

  return candidate;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function getAppUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

/* =========================================================
   REGISTER ORGANIZATION

   POST /api/auth/register

   Self-registration creates:

   1. Organization with PENDING status
   2. User with OWNER role
   3. OrganizationMember with OWNER role
   4. Subscription using the selected plan

   The organization remains pending until Platform
   Administration approves it.

   No automatic trial expiry is applied here.
========================================================= */

export const registerOrganization = async (
  req: Request,
  res: Response
) => {
  try {
    const orgName =
      typeof req.body?.orgName === "string"
        ? req.body.orgName.trim()
        : "";

    const ownerName =
      typeof req.body?.ownerName === "string"
        ? req.body.ownerName.trim().replace(/\s+/g, " ")
        : "";

    const email = normalizeEmail(req.body?.email);

    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

    const country =
      typeof req.body?.country === "string"
        ? req.body.country.trim()
        : "Kenya";

    const currency =
      typeof req.body?.currency === "string"
        ? req.body.currency.trim()
        : "KES";

    const rawPhoneNumber =
      typeof req.body?.phoneNumber === "string"
        ? req.body.phoneNumber.trim()
        : "";

    let phoneNumber: string | null = null;

    if (rawPhoneNumber) {
      try {
        phoneNumber =
          normalizeKenyanPhoneNumber(
            rawPhoneNumber
          );
      } catch {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE_NUMBER",
          message:
            "Please provide a valid Kenyan phone number.",
        });
      }
    }

    const plan =
      typeof req.body?.plan === "string" &&
      req.body.plan.trim()
        ? req.body.plan.trim().toUpperCase()
        : "STARTER";

    const rawBillingCycle =
      typeof req.body?.billingCycle === "string" &&
      req.body.billingCycle.trim()
        ? req.body.billingCycle.trim().toUpperCase()
        : "MONTHLY";

    const billingCycle =
      rawBillingCycle === "ANNUAL"
        ? "YEARLY"
        : rawBillingCycle;

    /* -------------------------------------------------------
       Validation
    ------------------------------------------------------- */

    if (!orgName) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_NAME_REQUIRED",
        message: "Organization name is required.",
      });
    }

    if (!ownerName) {
      return res.status(400).json({
        success: false,
        code: "OWNER_NAME_REQUIRED",
        message: "Your full name is required.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_REQUIRED",
        message: "Email address is required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_REQUIRED",
        message: "Password is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_TOO_SHORT",
        message: "Password must be at least 8 characters.",
      });
    }

    const validPlans = [
      "STARTER",
      "PROFESSIONAL",
      "ENTERPRISE",
    ];

    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PLAN",
        message: "The selected plan is invalid.",
      });
    }

    if (!["MONTHLY", "YEARLY"].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_BILLING_CYCLE",
        message: "The selected billing cycle is invalid.",
      });
    }

    /* -------------------------------------------------------
       Phone uniqueness
    ------------------------------------------------------- */

    if (phoneNumber) {
      const existingPhoneUser =
        await prisma.user.findFirst({
          where: {
            phoneNumber,
          },
          select: {
            id: true,
          },
        });

      if (existingPhoneUser) {
        return res.status(409).json({
          success: false,
          code: "PHONE_NUMBER_ALREADY_REGISTERED",
          message:
            "This phone number is already registered with a Ziya FOS account.",
        });
      }
    }
    /* -------------------------------------------------------
       Email uniqueness
    ------------------------------------------------------- */

    const existingUser =
      await prisma.user.findUnique({
        where: { email },
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_REGISTERED",
        message:
          "An account with this email address already exists. Please log in instead.",
      });
    }

    /* -------------------------------------------------------
       Organization uniqueness
    ------------------------------------------------------- */

    const existingOrg =
      await prisma.organization.findFirst({
        where: {
          name: {
            equals: orgName,
            mode: "insensitive",
          },
        },
      });

    if (existingOrg) {
      return res.status(409).json({
        success: false,
        code: "ORGANIZATION_ALREADY_REGISTERED",
        message:
          "An organization with this name is already registered. Please choose a different name.",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const slug =
      await uniqueSlug(orgName);

    /* -------------------------------------------------------
       Create organization, Owner and subscription
    ------------------------------------------------------- */

    const result =
      await prisma.$transaction(async (tx) => {
        const organization =
          await tx.organization.create({
            data: {
              name: orgName,
              slug,
              country: country || "Kenya",
              currency: currency || "KES",
              status: "PENDING",
            },
          });

        const user =
          await tx.user.create({
            data: {
              name: ownerName,
              email,
              password: passwordHash,
              role: "OWNER",
              isActive: true,
              phoneNumber: phoneNumber || null,
            },
          });

        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: "OWNER",
            permissions: ["*"],
            isActive: true,
            isDefault: true,
          },
        });

        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            plan,
            status: "PENDING",
            billingCycle,
            amount: 0,
            currency: currency || "KES",
            startDate: new Date(),
            endDate: null,
            trialEndsAt: null,
            cancelledAt: null,
            notes:
              "Self-registered organization awaiting Platform Administration approval.",
          },
        });

        return {
          organization,
          user,
        };
      });

    /* -------------------------------------------------------
       Platform audit
    ------------------------------------------------------- */

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: result.user.id,
        actorEmail: email,
        action: "ORGANIZATION_REGISTERED",
        resource: "ORGANIZATION",
        resourceId: result.organization.id,
        details:
          `Self-registration: ${orgName} (${email}), plan=${plan}, billingCycle=${billingCycle}`,
      },
    });

    /* -------------------------------------------------------
       Registration confirmation email
    ------------------------------------------------------- */

    try {
      await sendEmail(
        email,
        `Registration received — ${result.organization.name}`,
        `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#20243A;">
  <div style="max-width:620px;margin:40px auto;background:#ffffff;border-radius:12px;padding:40px;">
    <div style="font-size:22px;font-weight:700;margin-bottom:28px;">
      Ziya FOS
    </div>

    <h1 style="font-size:28px;margin:0 0 16px;">
      Registration received
    </h1>

    <p style="font-size:15px;line-height:1.7;">
      Hello ${ownerName},
    </p>

    <p style="font-size:15px;line-height:1.7;">
      Thank you for registering <strong>${result.organization.name}</strong>
      with Ziya FOS.
    </p>

    <p style="font-size:15px;line-height:1.7;">
      Your organization is currently being reviewed by the Ziya FOS
      platform administration team. You will receive another email
      when your organization has been approved.
    </p>

    <div style="background:#f7f7f8;border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;">
        <strong>Organization:</strong> ${result.organization.name}
      </p>
      <p style="margin:0 0 8px;">
        <strong>Plan:</strong> ${plan}
      </p>
      <p style="margin:0;">
        <strong>Billing cycle:</strong> ${billingCycle}
      </p>
    </div>

    <p style="font-size:14px;line-height:1.7;color:#555;">
      No action is required from you at this stage.
      Please keep this email for your records.
    </p>

    <p style="font-size:13px;color:#888;margin-top:32px;">
      Ziya FOS<br>
      simple.ethical.future.
    </p>
  </div>
</body>
</html>
        `
      );
    } catch (emailError) {
      console.error(
        "[AUTH] Registration confirmation email failed:",
        emailError
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Your organization is under review. You will receive an email when it has been approved.",
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        status: result.organization.status,
        plan,
        billingCycle,
      },
    });
  } catch (error) {
    console.error(
      "[AUTH] Organization registration failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "REGISTRATION_FAILED",
      message:
        "Registration failed. Please try again.",
    });
  }
};
