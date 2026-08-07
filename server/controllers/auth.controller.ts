import { Request, Response } from "express";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { sendEmail } from "../config/mailer";

import {
  sendPhoneOtp,
  normalizeKenyanPhoneNumber,
} from "../services/infinityTech.service";

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const JWT_EXPIRY = "1d";

type OtpChannel = "EMAIL" | "PHONE";

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

function normalizeOtpChannel(value: unknown): OtpChannel {
  if (
    typeof value === "string" &&
    value.trim().toUpperCase() === "PHONE"
  ) {
    return "PHONE";
  }

  return "EMAIL";
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return email;
  }

  const visible = localPart.substring(
    0,
    Math.min(2, localPart.length)
  );

  return `${visible}***@${domain}`;
}

function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) {
    return "****";
  }

  return (
    "*".repeat(
      Math.max(0, phoneNumber.length - 4)
    ) + phoneNumber.slice(-4)
  );
}

/* =========================================================
   LOGIN

   EMAIL + PASSWORD
        ↓
   CHOOSE EMAIL / PHONE
        ↓
   EMAIL:
     OTP → ACCOUNT EMAIL

   PHONE:
     USER ENTERS PHONE NUMBER
     OTP → ENTERED PHONE NUMBER

   Phone number is NOT trusted or saved yet.
   It is stored temporarily in OtpVerification.

   Only successful OTP verification binds the
   phone number to the User account.

   OTP requests are protected by a server-side
   resend cooldown.
========================================================= */

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(
      req.body?.email
    );

    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

    const otpChannel = normalizeOtpChannel(
      req.body?.otpChannel
    );

    const submittedPhoneNumber =
      typeof req.body?.phoneNumber === "string"
        ? req.body.phoneNumber.trim()
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
          password: true,
          phoneNumber: true,
          phoneVerifiedAt: true,
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
      user.platformRole === "PLATFORM_ADMIN";

    /*
     * PLATFORM_ADMIN does not require
     * tenant membership.
     */
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

    /* =====================================================
       DETERMINE OTP DESTINATION
    ===================================================== */

    let normalizedPhoneNumber:
      | string
      | null = null;

    if (otpChannel === "PHONE") {
      /*
       * First phone verification:
       * user supplies a phone number.
       *
       * Future verification:
       * frontend may omit it and we use
       * the already verified number.
       */
      const phoneCandidate =
        submittedPhoneNumber ||
        (
          user.phoneVerifiedAt &&
          user.phoneNumber
            ? user.phoneNumber
            : ""
        );

      if (!phoneCandidate) {
        return res.status(400).json({
          success: false,
          code: "PHONE_NUMBER_REQUIRED",
          message:
            "Enter the phone number where you want to receive the verification code.",
        });
      }

      try {
        normalizedPhoneNumber =
          normalizeKenyanPhoneNumber(
            phoneCandidate
          );
      } catch {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE_NUMBER",
          message:
            "Enter a valid Kenyan mobile phone number.",
        });
      }
    }

    /* =====================================================
       OTP RESEND COOLDOWN

       This is enforced on the backend.

       Repeated login submissions cannot continuously
       generate SMS/email codes.

       The existing OTP is NOT deleted during cooldown,
       so the code already delivered remains valid.
    ===================================================== */

    const existingOtp =
      await prisma.otpVerification.findFirst({
        where: {
          userId: user.id,
          verifiedAt: null,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (existingOtp) {
      const ageMilliseconds =
        Date.now() -
        existingOtp.createdAt.getTime();

      const cooldownMilliseconds =
        OTP_RESEND_COOLDOWN_SECONDS * 1000;

      if (
        ageMilliseconds <
        cooldownMilliseconds
      ) {
        const retryAfterSeconds =
          Math.max(
            1,
            Math.ceil(
              (
                cooldownMilliseconds -
                ageMilliseconds
              ) / 1000
            )
          );

        res.setHeader(
          "Retry-After",
          retryAfterSeconds.toString()
        );

        return res.status(429).json({
          success: false,
          code: "OTP_COOLDOWN",
          message:
            `A verification code was already sent. Please wait ${retryAfterSeconds} seconds before requesting another code.`,
          retryAfterSeconds,
        });
      }
    }

    /* =====================================================
       CREATE NEW OTP
    ===================================================== */

    const otp = generateOtp();

    const expiresAt = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES *
          60 *
          1000
    );

    /*
     * A newly issued OTP invalidates every previous
     * login OTP for this user.
     */
    await prisma.otpVerification.deleteMany({
      where: {
        userId: user.id,
      },
    });

    /*
     * PHONE numbers remain temporary here.
     *
     * They are only copied to User after
     * successful OTP verification.
     */
    const otpRecord =
      await prisma.otpVerification.create({
        data: {
          userId: user.id,

          email:
            otpChannel === "EMAIL"
              ? user.email
              : null,

          phoneNumber:
            otpChannel === "PHONE"
              ? normalizedPhoneNumber
              : null,

          code: otp,
          expiresAt,
          verifiedAt: null,
        },
      });

    /* =====================================================
       EMAIL OTP
    ===================================================== */

    if (otpChannel === "EMAIL") {
      try {
        await sendEmail(
          user.email,
          "Your Ziya FOS verification code",
          `
            <h2>Ziya Financial Operating System</h2>

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
              Do not share this code with anyone.
            </p>

            <p>
              If you did not request this login,
              you can ignore this message.
            </p>
          `
        );
      } catch (error) {
        console.error(
          "[AUTH] Email OTP delivery failed:",
          error
        );

        await prisma.otpVerification.delete({
          where: {
            id: otpRecord.id,
          },
        });

        return res.status(503).json({
          success: false,
          code: "OTP_DELIVERY_FAILED",
          message:
            "Verification code could not be sent by email. Please try again.",
        });
      }

      return res.status(200).json({
        success: true,
        requiresOtp: true,

        message:
          "Verification code sent successfully by email.",

        verification: {
          channel: "EMAIL",
          destination: maskEmail(user.email),

          sessionType:
            isPlatformAdmin
              ? "PLATFORM"
              : "TENANT",
        },
      });
    }

    /* =====================================================
       PHONE OTP
    ===================================================== */

    if (!normalizedPhoneNumber) {
      await prisma.otpVerification.delete({
        where: {
          id: otpRecord.id,
        },
      });

      return res.status(400).json({
        success: false,
        code: "PHONE_NUMBER_REQUIRED",
        message:
          "A valid phone number is required.",
      });
    }

    try {
      await sendPhoneOtp(
        normalizedPhoneNumber,
        otp
      );
    } catch (error) {
      console.error(
        "[AUTH] Phone OTP delivery failed:",
        error
      );

      await prisma.otpVerification.delete({
        where: {
          id: otpRecord.id,
        },
      });

      return res.status(503).json({
        success: false,
        code: "OTP_DELIVERY_FAILED",
        message:
          "Verification code could not be sent by phone. Please try again or use email verification.",
      });
    }

    return res.status(200).json({
      success: true,
      requiresOtp: true,

      message:
        "Verification code sent successfully by phone.",

      verification: {
        channel: "PHONE",

        destination:
          maskPhoneNumber(
            normalizedPhoneNumber
          ),

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

   EMAIL:
     verifies email OTP

   PHONE:
     verifies OTP against the temporary phone
     stored in OtpVerification.

     ONLY AFTER SUCCESS:
       User.phoneNumber = verified number
       User.phoneVerifiedAt = now()

   Then creates PLATFORM or TENANT JWT.
========================================================= */

export const verifyOtp = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(
      req.body?.email
    );

    const otp = normalizeOtp(
      req.body?.otp
    );

    const otpChannel = normalizeOtpChannel(
      req.body?.otpChannel
    );

    const requestedOrganizationId =
      typeof req.body?.organizationId ===
      "string"
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

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_OTP_FORMAT",
        message:
          "Verification code must contain exactly 6 digits.",
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
          phoneVerifiedAt: true,
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

    /* =====================================================
       FIND OTP RECORD

       We do NOT trust phoneNumber from the
       verification request.

       The destination used during login is
       already stored in OtpVerification.
    ===================================================== */

    const record =
      await prisma.otpVerification.findFirst({
        where: {
          userId: user.id,
          code: otp,
          verifiedAt: null,

          ...(otpChannel === "PHONE"
            ? {
                phoneNumber: {
                  not: null,
                },

                email: null,
              }
            : {
                email: user.email,
                phoneNumber: null,
              }),
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

    /*
     * PHONE OWNERSHIP IS NOW VERIFIED.
     *
     * This is the only point where the
     * phone number becomes trusted.
     */
    if (otpChannel === "PHONE") {
      if (!record.phoneNumber) {
        return res.status(401).json({
          success: false,
          code: "PHONE_VERIFICATION_FAILED",
          message:
            "Phone verification could not be completed.",
        });
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          phoneNumber:
            record.phoneNumber,

          phoneVerifiedAt:
            new Date(),
        },
      });
    }

    /*
     * Mark OTP consumed before creating
     * the authenticated response.
     */
    await prisma.otpVerification.update({
      where: {
        id: record.id,
      },

      data: {
        verifiedAt: new Date(),
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

    const verifiedPhoneNumber =
      otpChannel === "PHONE"
        ? record.phoneNumber
        : user.phoneNumber;

    const verifiedPhoneAt =
      otpChannel === "PHONE"
        ? new Date()
        : user.phoneVerifiedAt;

    /* =====================================================
       PLATFORM ADMIN SESSION
    ===================================================== */

    if (
      user.platformRole ===
      "PLATFORM_ADMIN"
    ) {
      const token = jwt.sign(
        {
          userId: user.id,
          sessionType: "PLATFORM",
          platformRole: "PLATFORM_ADMIN",
        },
        getJwtSecret(),
        {
          expiresIn: JWT_EXPIRY,
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Platform login successful.",

        token,
        sessionType: "PLATFORM",
        verificationChannel: otpChannel,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,

          phoneNumber:
            verifiedPhoneNumber,

          phoneVerifiedAt:
            verifiedPhoneAt,

          platformRole:
            user.platformRole,
        },
      });
    }

    /* =====================================================
       TENANT SESSION
    ===================================================== */

    if (user.memberships.length === 0) {
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

    const token = jwt.sign(
      {
        userId: user.id,
        sessionType: "TENANT",

        organizationId:
          membership.organizationId,

        role: membership.role,
      },
      getJwtSecret(),
      {
        expiresIn: JWT_EXPIRY,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",

      token,
      sessionType: "TENANT",
      verificationChannel: otpChannel,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,

        phoneNumber:
          verifiedPhoneNumber,

        phoneVerifiedAt:
          verifiedPhoneAt,

        role: membership.role,
      },

      organization: {
        id: membership.organization.id,
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
            id: item.organization.id,
            name: item.organization.name,
            slug: item.organization.slug,
            logoUrl:
              item.organization.logoUrl,
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
      code:
        "OTP_VERIFICATION_ERROR",
      message:
        "Unable to complete verification.",
    });
  }
};/* =========================================================
   LOGOUT

   JWTs are stateless, therefore logout is performed by
   clearing the token on the client. This endpoint exists
   so the frontend has a proper logout API and to support
   future session invalidation if refresh tokens or token
   blacklists are introduced.
========================================================= */

export const logout = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("[AUTH] Logout error:", error);

    return res.status(500).json({
      success: false,
      code: "LOGOUT_ERROR",
      message: "Unable to complete logout.",
    });
  }
};