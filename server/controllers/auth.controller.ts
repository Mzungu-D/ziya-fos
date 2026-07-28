import {
  Request,
  Response,
} from "express";

import prisma from "../config/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import {
  sendEmail,
} from "../config/mailer";

const OTP_EXPIRY_MINUTES = 10;
const JWT_EXPIRY = "1d";

/* =========================================================
   HELPERS
========================================================= */

function getJwtSecret(): string {
  const secret =
    process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return secret;
}

function normalizeEmail(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function normalizeOtp(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function generateOtp(): string {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
}

/* =========================================================
   LOGIN
   PASSWORD -> EMAIL OTP

   Phone OTP provider will be integrated separately.

   Supports:

   1. PLATFORM account
      platformRole = PLATFORM_ADMIN
      No tenant membership required.

   2. TENANT account
      Active OrganizationMember required.

   No JWT is issued until OTP verification succeeds.
========================================================= */

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const password =
      typeof req.body?.password ===
      "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message:
          "Email and password are required.",
      });
    }

    const user =
      await prisma.user.findUnique({
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
          platformRole: true,

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
        message:
          "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message:
          "Account is disabled.",
      });
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message:
          "Invalid email or password.",
      });
    }

    const isPlatformAdmin =
      user.platformRole ===
      "PLATFORM_ADMIN";

    if (
      !isPlatformAdmin &&
      user.memberships.length === 0
    ) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message:
          "This account does not have access to an active organization.",
      });
    }

    const otp =
      generateOtp();

    const expiresAt =
      new Date(
        Date.now() +
          OTP_EXPIRY_MINUTES *
            60 *
            1000
      );

    /*
     * Remove previous OTP attempts before
     * creating a new verification code.
     */
    await prisma.otpVerification.deleteMany({
      where: {
        userId: user.id,
      },
    });

    /*
     * Current Prisma OtpVerification model:
     *
     * code
     * expiresAt
     * verifiedAt
     *
     * channel/otp/verified are intentionally
     * not used because they are not present
     * in the current database schema.
     */
    await prisma.otpVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        phoneNumber:
          user.phoneNumber,
        code: otp,
        expiresAt,
        verifiedAt: null,
      },
    });

    try {
      await sendEmail(
        user.email,
        "Your Ziya FOS verification code",
        `
          <h2>
            Financial Operating System
          </h2>

          <p>
            Hello ${user.name},
          </p>

          <p>
            Your verification code is:
          </p>

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
      message:
        "Verification code sent successfully.",

      verification: {
        email: user.email,
        channel: "EMAIL",

        sessionType:
          isPlatformAdmin
            ? "PLATFORM"
            : "TENANT",
      },
    });
  } catch (error) {
    console.error(
      "[AUTH] Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "LOGIN_ERROR",
      message:
        "Unable to complete login.",
    });
  }
};

/* =========================================================
   VERIFY OTP

   OTP ->
   PLATFORM JWT
   OR
   TENANT JWT
========================================================= */

export const verifyOtp = async (
  req: Request,
  res: Response
) => {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const otp =
      normalizeOtp(
        req.body?.otp
      );

    const requestedOrganizationId =
      typeof req.body
        ?.organizationId === "string"
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

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          platformRole: true,

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
        message:
          "User account was not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message:
          "Account is disabled.",
      });
    }

    /*
     * Current schema uses:
     *
     * code        -> OTP value
     * verifiedAt  -> null means unused
     */
    const record =
      await prisma.otpVerification.findFirst({
        where: {
          userId: user.id,
          email: user.email,
          code: otp,
          verifiedAt: null,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (!record) {
      return res.status(401).json({
        success: false,
        code: "INVALID_OTP",
        message:
          "Invalid verification code.",
      });
    }

    if (
      new Date() >
      record.expiresAt
    ) {
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

    /* =====================================================
       PLATFORM ADMIN SESSION
    ===================================================== */

    if (
      user.platformRole ===
      "PLATFORM_ADMIN"
    ) {
      const token =
        jwt.sign(
          {
            userId: user.id,
            sessionType:
              "PLATFORM",
            platformRole:
              "PLATFORM_ADMIN",
          },
          getJwtSecret(),
          {
            expiresIn:
              JWT_EXPIRY,
          }
        );

      await prisma.otpVerification.update({
        where: {
          id: record.id,
        },

        data: {
          verifiedAt:
            new Date(),
        },
      });

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
        message:
          "Platform login successful.",

        token,

        sessionType:
          "PLATFORM",

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber:
            user.phoneNumber,
          platformRole:
            user.platformRole,
        },
      });
    }

    /* =====================================================
       TENANT SESSION
    ===================================================== */

    if (
      user.memberships.length === 0
    ) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message:
          "This account does not have access to an active organization.",
      });
    }

    let membership =
      requestedOrganizationId
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
        code:
          "ORGANIZATION_ACCESS_DENIED",
        message:
          "You do not have access to the selected organization.",
      });
    }

    if (!membership) {
      membership =
        user.memberships.find(
          (item) =>
            item.isDefault
        ) ??
        user.memberships[0];
    }

    if (!membership) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message:
          "No active organization is available for this account.",
      });
    }

    const token =
      jwt.sign(
        {
          userId: user.id,
          sessionType:
            "TENANT",
          organizationId:
            membership.organizationId,
          role:
            membership.role,
        },
        getJwtSecret(),
        {
          expiresIn:
            JWT_EXPIRY,
        }
      );

    await prisma.otpVerification.update({
      where: {
        id: record.id,
      },

      data: {
        verifiedAt:
          new Date(),
      },
    });

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
      message:
        "Login successful.",

      token,

      sessionType:
        "TENANT",

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber:
          user.phoneNumber,
        role:
          membership.role,
      },

      organization: {
        id:
          membership.organization.id,
        name:
          membership.organization.name,
        slug:
          membership.organization.slug,
        logoUrl:
          membership.organization.logoUrl,
        country:
          membership.organization.country,
        currency:
          membership.organization.currency,
      },

      organizations:
        user.memberships.map(
          (item) => ({
            id:
              item.organization.id,
            name:
              item.organization.name,
            slug:
              item.organization.slug,
            logoUrl:
              item.organization.logoUrl,
            role:
              item.role,
            isDefault:
              item.isDefault,
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
      code:
        "OTP_VERIFICATION_ERROR",
      message:
        "Unable to complete verification.",
    });
  }
};