import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../config/mailer";

const prisma = new PrismaClient();

const OTP_EXPIRY_MINUTES = 10;
const JWT_EXPIRY = "1d";

/* =========================================================
   HELPERS
========================================================= */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function normalizeOtp(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/* =========================================================
   LOGIN
   PASSWORD -> OTP

   No JWT is issued here.
========================================================= */

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(req.body?.email);

    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        password: true,
        isActive: true,

        memberships: {
          where: {
            isActive: true,
            organization: {
              status: "ACTIVE",
            },
          },

          select: {
            id: true,
            role: true,
            isDefault: true,
            organizationId: true,

            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message: "Account is disabled.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    /*
     * A valid User account alone is NOT enough.
     * The user must belong to at least one active
     * organization.
     */
    if (user.memberships.length === 0) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message:
          "This account does not have access to an active organization.",
      });
    }

    const otp = generateOtp();

    const expiresAt = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES * 60 * 1000
    );

    /*
     * Remove previous unneeded OTP records.
     */
    await prisma.otpVerification.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.otpVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        channel: "EMAIL",
        otp,
        expiresAt,
        verified: false,
      },
    });

    try {
      await sendEmail(
        user.email,
        "Your Ziya FOS verification code",
        `
          <h2>Financial Operating System</h2>

          <p>Hello ${user.name},</p>

          <p>Your verification code is:</p>

          <h1 style="letter-spacing: 5px;">
            ${otp}
          </h1>

          <p>
            This code expires in
            ${OTP_EXPIRY_MINUTES} minutes.
          </p>

          <p>
            If you did not request this login,
            you can ignore this message.
          </p>
        `
      );
    } catch (error) {
      console.error(
        "[AUTH] OTP email delivery failed:",
        error
      );

      await prisma.otpVerification.deleteMany({
        where: {
          userId: user.id,
        },
      });

      return res.status(503).json({
        success: false,
        code: "OTP_DELIVERY_FAILED",
        message:
          "Verification code could not be sent. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      requiresOtp: true,
      message: "Verification code sent successfully.",

      verification: {
        email: user.email,
        channel: "EMAIL",
      },
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);

    return res.status(500).json({
      success: false,
      code: "LOGIN_ERROR",
      message: "Unable to complete login.",
    });
  }
};

/* =========================================================
   VERIFY OTP
   OTP -> TENANT-AWARE JWT
========================================================= */

export const verifyOtp = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = normalizeOtp(req.body?.otp);

    /*
     * Optional organization selection.
     *
     * Useful when one user belongs to multiple
     * organizations.
     */
    const requestedOrganizationId =
      typeof req.body?.organizationId === "string"
        ? req.body.organizationId.trim()
        : "";

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message:
          "Email and verification code are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,

        memberships: {
          where: {
            isActive: true,
            organization: {
              status: "ACTIVE",
            },
          },

          select: {
            id: true,
            organizationId: true,
            role: true,
            isDefault: true,

            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                country: true,
                currency: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        message: "User account was not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message: "Account is disabled.",
      });
    }

    const record =
      await prisma.otpVerification.findFirst({
        where: {
          userId: user.id,
          email: user.email,
          otp,
          verified: false,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (!record) {
      return res.status(401).json({
        success: false,
        code: "INVALID_OTP",
        message: "Invalid verification code.",
      });
    }

    if (new Date() > record.expiresAt) {
      await prisma.otpVerification.delete({
        where: {
          id: record.id,
        },
      });

      return res.status(401).json({
        success: false,
        code: "OTP_EXPIRED",
        message:
          "Verification code has expired. Please request a new one.",
      });
    }

    if (user.memberships.length === 0) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message:
          "This account does not have access to an active organization.",
      });
    }

    /*
     * ORGANIZATION SELECTION
     *
     * 1. Explicit organization requested
     * 2. Default organization
     * 3. First active membership
     */

    let membership = requestedOrganizationId
      ? user.memberships.find(
          (item) =>
            item.organizationId ===
            requestedOrganizationId
        )
      : undefined;

    if (
      requestedOrganizationId &&
      !membership
    ) {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_ACCESS_DENIED",
        message:
          "You do not have access to the selected organization.",
      });
    }

    if (!membership) {
      membership =
        user.memberships.find(
          (item) => item.isDefault
        ) ?? user.memberships[0];
    }

    if (!membership) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message:
          "No active organization is available for this account.",
      });
    }

    /*
     * IMPORTANT:
     * Role comes from OrganizationMember,
     * not User.role.
     *
     * This allows the same user to have
     * different roles in different organizations.
     */

    const token = jwt.sign(
      {
        userId: user.id,
        organizationId:
          membership.organizationId,
        role: membership.role,
      },
      getJwtSecret(),
      {
        expiresIn: JWT_EXPIRY,
      }
    );

    await prisma.otpVerification.update({
      where: {
        id: record.id,
      },

      data: {
        verified: true,
      },
    });

    /*
     * OTP is single-use.
     */
    await prisma.otpVerification.deleteMany({
      where: {
        userId: user.id,
        id: {
          not: record.id,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: membership.role,
      },

      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        logoUrl:
          membership.organization.logoUrl,
        country:
          membership.organization.country,
        currency:
          membership.organization.currency,
      },

      organizations: user.memberships.map(
        (item) => ({
          id: item.organization.id,
          name: item.organization.name,
          slug: item.organization.slug,
          logoUrl: item.organization.logoUrl,
          role: item.role,
          isDefault: item.isDefault,
        })
      ),
    });
  } catch (error) {
    console.error(
      "[AUTH] OTP verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "OTP_VERIFICATION_ERROR",
      message:
        "Unable to complete verification.",
    });
  }
};