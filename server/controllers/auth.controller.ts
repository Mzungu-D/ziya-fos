import type { Request, Response } from "express-serve-static-core";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { sendEmail } from "../config/mailer";

import {
  sendPhoneOtp,
  normalizeKenyanPhoneNumber,
} from "../services/infinityTech.service";

import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const STANDARD_SESSION_DAYS = 1;
const REMEMBERED_SESSION_DAYS = 30;
const STANDARD_SESSION_EXPIRY = "1d";
const REMEMBERED_SESSION_EXPIRY = "30d";
const TRUSTED_DEVICE_COOKIE = "ziya_fos_trusted_device";
const TRUSTED_DEVICE_DAYS = 30;

type OtpChannel = "EMAIL" | "PHONE";

/* =========================================================
   HELPERS
========================================================= */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeOtp(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 12);
}

/**
 * Supports legacy plaintext OTP records during the transition to hashed OTPs.
 * New OTPs are always stored as bcrypt hashes.
 */
async function verifyOtpCode(
  storedCode: string,
  submittedOtp: string
): Promise<boolean> {
  if (storedCode.startsWith("$2")) {
    return bcrypt.compare(submittedOtp, storedCode);
  }

  const stored = Buffer.from(storedCode, "utf8");
  const submitted = Buffer.from(submittedOtp, "utf8");

  return (
    stored.length === submitted.length &&
    crypto.timingSafeEqual(stored, submitted)
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) return email;

  const visible = localPart.substring(
    0,
    Math.min(2, localPart.length)
  );

  return `${visible}***@${domain}`;
}

function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) return "****";

  return (
    "*".repeat(
      Math.max(0, phoneNumber.length - 4)
    ) + phoneNumber.slice(-4)
  );
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress ?? "unknown";
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const prefix = `${name}=`;
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!item) return null;
  const value = item.slice(prefix.length).trim();
  return value ? decodeURIComponent(value) : null;
}

function setTrustedDeviceCookie(res: Response, token: string): void {
  const maxAge = TRUSTED_DEVICE_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append("Set-Cookie", `${TRUSTED_DEVICE_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function clearTrustedDeviceCookie(res: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append("Set-Cookie", `${TRUSTED_DEVICE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

/* =========================================================
   RBAC
========================================================= */

/**
 * Resolves the permissions exposed to the authenticated
 * tenant session.
 *
 * Standard roles use the current server-side role template.
 * CUSTOM uses only explicitly stored permissions.
 * Unknown roles fail closed.
 */
function resolveEffectivePermissions(
  role: string,
  storedPermissions: unknown
): string[] {
  if (role === "OWNER") {
    return ["*"];
  }

  if (isRoleTemplate(role)) {
    return getRoleTemplatePermissions(role);
  }

  if (role === "CUSTOM") {
    return Array.isArray(storedPermissions)
      ? storedPermissions.filter(
          (permission): permission is string =>
            typeof permission === "string"
        )
      : [];
  }

  return [];
}

/* =========================================================
   LOGIN
========================================================= */

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(req.body?.email);

    const rawPassword =
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

    if (!rawPassword) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_REQUIRED",
        message: "Password is required.",
      });
    }

    let normalizedPhoneNumber: string | null = null;

    /* =====================================================
       PHONE LOGIN IDENTIFIER
    ===================================================== */

    if (otpChannel === "PHONE") {
      if (!submittedPhoneNumber) {
        return res.status(400).json({
          success: false,
          code: "PHONE_NUMBER_REQUIRED",
          message: "Phone number is required.",
        });
      }

      try {
        normalizedPhoneNumber =
          normalizeKenyanPhoneNumber(
            submittedPhoneNumber
          );
      } catch {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE_NUMBER",
          message:
            "Enter a valid Kenyan mobile phone number.",
        });
      }
    } else if (!email) {
      /* =====================================================
         EMAIL LOGIN IDENTIFIER
      ===================================================== */

      return res.status(400).json({
        success: false,
        code: "EMAIL_REQUIRED",
        message: "Email address is required.",
      });
    }

    /* =====================================================
       FIND USER
    ===================================================== */

    const user =
      otpChannel === "PHONE"
        ? await prisma.user.findFirst({
            where: {
              phoneNumber: normalizedPhoneNumber,
            },

            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              phoneVerifiedAt: true,
              password: true,
              isActive: true,
              platformRole: true,
              lockedUntil: true,
              loginAttempts: true,

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
                  permissions: true,
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
          })
        : await prisma.user.findUnique({
            where: {
              email,
            },

            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              phoneVerifiedAt: true,
              password: true,
              isActive: true,
              platformRole: true,
              lockedUntil: true,
              loginAttempts: true,

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
                  permissions: true,
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
        message: "Invalid login credentials.",
      });
    }

    /* =====================================================
       ACCOUNT STATUS
    ===================================================== */

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message:
          "Your account is currently disabled. Please contact your administrator.",
      });
    }

    if (
      user.lockedUntil &&
      new Date() < user.lockedUntil
    ) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) /
          60000
      );

      return res.status(429).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: `Your account is temporarily locked. Try again in ${minutesLeft} minute${
          minutesLeft === 1 ? "" : "s"
        }.`,
        lockedUntil: user.lockedUntil,
      });
    }

    /* =====================================================
       PASSWORD VERIFICATION
    ===================================================== */

    const passwordMatches = await bcrypt.compare(
      rawPassword,
      user.password
    );

    if (!passwordMatches) {
      const nextAttempts =
        user.loginAttempts + 1;

      const shouldLock =
        nextAttempts >= MAX_LOGIN_ATTEMPTS;

      const lockedUntil = shouldLock
        ? new Date(
            Date.now() +
              LOCKOUT_DURATION_MINUTES * 60 * 1000
          )
        : null;

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          loginAttempts: nextAttempts,
          lockedUntil,
        },
      });

      if (shouldLock) {
        return res.status(429).json({
          success: false,
          code: "ACCOUNT_LOCKED",
          message: `Too many failed login attempts. Your account is temporarily locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
          lockedUntil,
        });
      }

      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid login credentials.",
      });
    }

    /* =====================================================
       ORGANIZATION ACCESS
    ===================================================== */

    const isPlatformAdmin =
      user.platformRole === "PLATFORM_ADMIN";

    if (
      !isPlatformAdmin &&
      user.memberships.length === 0
    ) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message:
          "Your account has not been granted access to an active Ziya FOS organization.",
      });
    }

    /* =====================================================
       TRUSTED DEVICE LOGIN

       The trusted-device credential is server-side. It is
       stored in an HttpOnly cookie and points to a dedicated
       30-day Session record. The current login session is
       still created separately, so normal logout revokes
       only the active session.
    ===================================================== */

    const trustedDeviceToken = getCookie(req, TRUSTED_DEVICE_COOKIE);

    if (trustedDeviceToken) {
      const trustedSession = await prisma.session.findFirst({
        where: {
          token: trustedDeviceToken,
          userId: user.id,
          isActive: true,
          rememberMe: true,
        },
        select: { id: true, expiresAt: true },
      });

      if (trustedSession && trustedSession.expiresAt > new Date()) {
        const clientIp = getClientIp(req);
        const userAgent = req.headers["user-agent"] ?? null;
        const currentSessionToken = generateSessionToken();
        const currentSession = await prisma.session.create({
          data: {
            userId: user.id,
            token: currentSessionToken,
            expiresAt: new Date(Date.now() + STANDARD_SESSION_DAYS * 24 * 60 * 60 * 1000),
            rememberMe: false,
            ipAddress: clientIp,
            userAgent,
            isActive: true,
          },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: clientIp,
            loginAttempts: 0,
            lockedUntil: null,
          },
        });

        if (isPlatformAdmin) {
          const token = jwt.sign(
            {
              userId: user.id,
              sessionId: currentSession.id,
              sessionType: "PLATFORM",
              rememberMe: false,
              platformRole: "PLATFORM_ADMIN",
            },
            getJwtSecret(),
            { expiresIn: STANDARD_SESSION_EXPIRY }
          );

          setTrustedDeviceCookie(res, trustedDeviceToken);

          return res.status(200).json({
            success: true,
            message: "Login successful on trusted device.",
            token,
            sessionType: "PLATFORM",
            verificationChannel: "TRUSTED_DEVICE",
            user: {
              id: user.id, name: user.name, email: user.email,
              phoneNumber: user.phoneNumber, phoneVerifiedAt: user.phoneVerifiedAt,
              platformRole: user.platformRole,
            },
          });
        }

        const membership = user.memberships.find((item) => item.isDefault) ?? user.memberships[0];
        if (!membership) {
          return res.status(403).json({
            success: false,
            code: "NO_ORGANIZATION_ACCESS",
            message: "No active organization is available for this account.",
          });
        }

        const token = jwt.sign(
          {
            userId: user.id, sessionId: currentSession.id, sessionType: "TENANT",
            rememberMe: false, organizationId: membership.organizationId, role: membership.role,
          },
          getJwtSecret(),
          { expiresIn: STANDARD_SESSION_EXPIRY }
        );

        setTrustedDeviceCookie(res, trustedDeviceToken);

        return res.status(200).json({
          success: true,
          message: "Login successful on trusted device.",
          token,
          sessionType: "TENANT",
          verificationChannel: "TRUSTED_DEVICE",
          user: {
            id: user.id, name: user.name, email: user.email,
            phoneNumber: user.phoneNumber, phoneVerifiedAt: user.phoneVerifiedAt,
            organizationId: membership.organizationId, organizationRole: membership.role,
            permissions: resolveEffectivePermissions(
              membership.role,
              membership.permissions
            ),
          },
          organization: {
            id: membership.organization.id, name: membership.organization.name,
            slug: membership.organization.slug, logoUrl: membership.organization.logoUrl,
          },
          organizations: user.memberships.map((item) => ({
            id: item.organization.id, name: item.organization.name, slug: item.organization.slug,
            logoUrl: item.organization.logoUrl, role: item.role, isDefault: item.isDefault,
          })),
        });
      }

      clearTrustedDeviceCookie(res);
    }

    /* =====================================================
       DETERMINE OTP DESTINATION
    ===================================================== */

    if (
      otpChannel === "PHONE" &&
      !normalizedPhoneNumber
    ) {
      return res.status(400).json({
        success: false,
        code: "PHONE_NUMBER_REQUIRED",
        message:
          "A valid phone number is required.",
      });
    }

    /* =====================================================
       OTP RESEND COOLDOWN
    ===================================================== */

    const existingOtp =
      await prisma.otpVerification.findFirst({
        where: {
          userId: user.id,
          type: "LOGIN",
          verifiedAt: null,
          isInvalidated: false,

          ...(otpChannel === "PHONE"
            ? {
                phoneNumber: normalizedPhoneNumber,
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
              (cooldownMilliseconds -
                ageMilliseconds) /
                1000
            )
          );

        res.setHeader(
          "Retry-After",
          retryAfterSeconds.toString()
        );

        return res.status(429).json({
          success: false,
          code: "OTP_COOLDOWN",
          message: `A verification code was already sent. Please wait ${retryAfterSeconds} seconds before requesting another code.`,
          retryAfterSeconds,
        });
      }
    }

    /* =====================================================
       INVALIDATE OLD OTPs
    ===================================================== */

    await prisma.otpVerification.updateMany({
      where: {
        userId: user.id,
        type: "LOGIN",
        isInvalidated: false,
      },

      data: {
        isInvalidated: true,
      },
    });

    /* =====================================================
       CREATE NEW OTP
    ===================================================== */

    const otp = generateOtp();

    const expiresAt = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES * 60 * 1000
    );

    const otpRecord =
      await prisma.otpVerification.create({
        data: {
          userId: user.id,
          type: "LOGIN",

          email:
            otpChannel === "EMAIL"
              ? user.email
              : null,

          phoneNumber:
            otpChannel === "PHONE"
              ? normalizedPhoneNumber
              : null,

          code: await hashOtp(otp),
          expiresAt,
          isInvalidated: false,
          attempts: 0,
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
            <div style="margin:0;padding:40px 20px;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

                <div style="padding:28px 32px;background:#0D9488;">
                  <div style="font-size:22px;font-weight:700;color:#ffffff;">
                    Ziya FOS
                  </div>

                  <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.8);">
                    Financial Operating System
                  </div>
                </div>

                <div style="padding:36px 32px;">

                  <p style="margin:0 0 16px;font-size:16px;color:#20243A;">
                    Hello ${user.name},
                  </p>

                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">
                    Use the verification code below to securely sign in to your Ziya FOS account.
                  </p>

                  <div style="margin:0 0 24px;padding:20px;text-align:center;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">

                    <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">
                      Verification code
                    </div>

                    <div style="font-size:32px;line-height:1;font-weight:700;letter-spacing:8px;color:#20243A;">
                      ${otp}
                    </div>

                  </div>

                  <p style="margin:0 0 10px;font-size:14px;color:#4b5563;">
                    This code expires in ${OTP_EXPIRY_MINUTES} minutes.
                  </p>

                  <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;">
                    If you did not request this code, you can safely ignore this email.
                    Never share your verification code with anyone.
                  </p>

                </div>

                <div style="padding:20px 32px;border-top:1px solid #e5e7eb;background:#fafafa;">

                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    © ${new Date().getFullYear()} Ziya FOS. All rights reserved.
                  </p>

                </div>

              </div>
            </div>
          `
        );
      } catch (error) {
        console.error(
          "[AUTH] Email OTP delivery failed:",
          error
        );

        await prisma.otpVerification.update({
          where: {
            id: otpRecord.id,
          },

          data: {
            isInvalidated: true,
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
          destination: maskEmail(
            user.email
          ),

          sessionType: isPlatformAdmin
            ? "PLATFORM"
            : "TENANT",
        },
      });
    }

    /* =====================================================
       PHONE OTP
    ===================================================== */

    if (!normalizedPhoneNumber) {
      await prisma.otpVerification.update({
        where: {
          id: otpRecord.id,
        },

        data: {
          isInvalidated: true,
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

      await prisma.otpVerification.update({
        where: {
          id: otpRecord.id,
        },

        data: {
          isInvalidated: true,
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
        destination: maskPhoneNumber(
          normalizedPhoneNumber
        ),

        sessionType: isPlatformAdmin
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
      message: "Unable to complete login.",
    });
  }
};

/* =========================================================
   VERIFY OTP
========================================================= */

export const verifyOtp = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(
      req.body?.email
    );

    const phoneNumber =
      typeof req.body?.phoneNumber === "string"
        ? req.body.phoneNumber.trim()
        : "";

    const otp = normalizeOtp(
      req.body?.otp
    );

    const otpChannel =
      normalizeOtpChannel(
        req.body?.otpChannel
      );

    const requestedOrganizationId =
      typeof req.body?.organizationId === "string"
        ? req.body.organizationId.trim()
        : "";

    const rememberMe =
      req.body?.rememberMe === true;

    const trustDevice =
      req.body?.trustDevice === true;

    let normalizedPhoneNumber:
      | string
      | null = null;

    /* =====================================================
       PHONE OTP IDENTIFIER
    ===================================================== */

    if (otpChannel === "PHONE") {
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          code: "PHONE_NUMBER_REQUIRED",
          message:
            "Phone number and verification code are required.",
        });
      }

      try {
        normalizedPhoneNumber =
          normalizeKenyanPhoneNumber(
            phoneNumber
          );
      } catch {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE_NUMBER",
          message:
            "Enter a valid Kenyan mobile phone number.",
        });
      }
    } else if (!email) {
      /* =====================================================
         EMAIL OTP IDENTIFIER
      ===================================================== */

      return res.status(400).json({
        success: false,
        code: "EMAIL_REQUIRED",
        message:
          "Email address and verification code are required.",
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        code: "OTP_REQUIRED",
        message:
          "Verification code is required.",
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

    /* =====================================================
       FIND USER
    ===================================================== */

    const user =
      otpChannel === "PHONE"
        ? await prisma.user.findFirst({
            where: {
              phoneNumber:
                normalizedPhoneNumber,
            },

            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              phoneVerifiedAt: true,
              isActive: true,
              platformRole: true,
              lockedUntil: true,

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
                  permissions: true,

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
          })
        : await prisma.user.findUnique({
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
              lockedUntil: true,

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
                  permissions: true,

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
        message: "Account is disabled.",
      });
    }

    if (
      user.lockedUntil &&
      new Date() < user.lockedUntil
    ) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() -
          Date.now()) /
          60000
      );

      return res.status(429).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: `Account is temporarily locked. Try again in ${minutesLeft} minute${
          minutesLeft === 1 ? "" : "s"
        }.`,
        lockedUntil: user.lockedUntil,
      });
    }

    /* =====================================================
       FIND ACTIVE OTP RECORD
    ===================================================== */

    const record =
      await prisma.otpVerification.findFirst({
        where: {
          userId: user.id,
          type: "LOGIN",
          verifiedAt: null,
          isInvalidated: false,

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
          "No active verification code found. Please request a new one.",
      });
    }

    if (new Date() > record.expiresAt) {
      await prisma.otpVerification.update({
        where: {
          id: record.id,
        },

        data: {
          isInvalidated: true,
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
       CODE MATCH + BRUTE FORCE PROTECTION
    ===================================================== */

    const otpMatches = await verifyOtpCode(
      record.code,
      otp
    );

    if (!otpMatches) {
      const newAttempts =
        record.attempts + 1;

      const maxedOut =
        newAttempts >= MAX_OTP_ATTEMPTS;

      await prisma.otpVerification.update({
        where: {
          id: record.id,
        },

        data: {
          attempts: newAttempts,
          isInvalidated: maxedOut,
        },
      });

      if (maxedOut) {
        return res.status(401).json({
          success: false,
          code: "OTP_MAX_ATTEMPTS",
          message:
            "Too many incorrect attempts. Please request a new verification code.",
        });
      }

      const remaining =
        MAX_OTP_ATTEMPTS - newAttempts;

      return res.status(401).json({
        success: false,
        code: "INVALID_OTP",
        message: `Invalid verification code. ${remaining} attempt${
          remaining === 1 ? "" : "s"
        } remaining.`,
      });
    }

    /* =====================================================
       OTP VERIFIED — PHONE OWNERSHIP CONFIRMED
    ===================================================== */

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
          phoneVerifiedAt: new Date(),
        },
      });
    }

    const claimedOtp = await prisma.otpVerification.updateMany({
      where: {
        id: record.id,
        verifiedAt: null,
        isInvalidated: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        verifiedAt: new Date(),
      },
    });

    if (claimedOtp.count !== 1) {
      return res.status(401).json({
        success: false,
        code: "OTP_ALREADY_USED",
        message:
          "This verification code has already been used or is no longer valid. Please request a new code.",
      });
    }

    await prisma.otpVerification.updateMany({
      where: {
        userId: user.id,
        id: {
          not: record.id,
        },
        isInvalidated: false,
      },

      data: {
        isInvalidated: true,
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

    const clientIp =
      getClientIp(req);

    const userAgent =
      req.headers["user-agent"] ?? null;

    /* =====================================================
       CREATE SESSION IN DATABASE
    ===================================================== */

    const sessionToken =
      generateSessionToken();

    const sessionDays = rememberMe
      ? REMEMBERED_SESSION_DAYS
      : STANDARD_SESSION_DAYS;

    const sessionExpiresAt =
      new Date(
        Date.now() +
          sessionDays *
            24 *
            60 *
            60 *
            1000
      );

    const session =
      await prisma.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt: sessionExpiresAt,
          rememberMe,
          ipAddress: clientIp,
          userAgent,
          isActive: true,
        },
      });

    /* =====================================================
       TRUST THIS DEVICE FOR 30 DAYS
    ===================================================== */

    if (trustDevice) {
      const trustedToken = generateSessionToken();

      await prisma.session.create({
        data: {
          userId: user.id,
          token: trustedToken,
          expiresAt: new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000),
          rememberMe: true,
          ipAddress: clientIp,
          userAgent,
          isActive: true,
        },
      });

      setTrustedDeviceCookie(res, trustedToken);
    }


    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

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
          sessionId: session.id,
          sessionType: "PLATFORM",
          rememberMe,
          platformRole:
            "PLATFORM_ADMIN",
        },

        getJwtSecret(),

        {
          expiresIn: rememberMe
            ? REMEMBERED_SESSION_EXPIRY
            : STANDARD_SESSION_EXPIRY,
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Platform login successful.",
        token,
        sessionType: "PLATFORM",
        verificationChannel:
          otpChannel,

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
          (item) => item.isDefault
        ) ??
        user.memberships[0];
    }

    if (!membership) {
      return res.status(403).json({
        success: false,
        code:
          "NO_ORGANIZATION_ACCESS",
        message:
          "No active organization is available for this account.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        sessionId: session.id,
        sessionType: "TENANT",
        rememberMe,
        organizationId:
          membership.organizationId,
        role: membership.role,
      },

      getJwtSecret(),

      {
        expiresIn: rememberMe
          ? REMEMBERED_SESSION_EXPIRY
          : STANDARD_SESSION_EXPIRY,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      sessionType: "TENANT",
      verificationChannel:
        otpChannel,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber:
          verifiedPhoneNumber,
        phoneVerifiedAt:
          verifiedPhoneAt,
        organizationId:
          membership.organizationId,
        organizationRole:
          membership.role,
        permissions:
          resolveEffectivePermissions(
            membership.role,
            membership.permissions
          ),
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
            role: item.role,
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

/* =========================================================
   LOGOUT
========================================================= */

export const logout = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const authHeader =
      req.headers.authorization;

    const token =
      authHeader &&
      authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (token) {
      try {
        const decoded =
          jwt.verify(
            token,
            getJwtSecret()
          ) as {
            sessionId?: string;
            userId?: string;
          };

        if (decoded.sessionId) {
          await prisma.session.updateMany({
            where: {
              id: decoded.sessionId,
              userId: decoded.userId,
            },

            data: {
              isActive: false,
            },
          });
        }
      } catch {
        // Token invalid or expired — nothing to revoke
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully.",
    });
  } catch (error) {
    console.error(
      "[AUTH] Logout error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "LOGOUT_ERROR",
      message:
        "Unable to complete logout.",
    });
  }
};

/* =========================================================
   PHONE OTP RESEND
========================================================= */

export const phoneLogin = async (
  req: Request,
  res: Response
) => {
  try {
    const rawPhone =
      typeof req.body?.phoneNumber ===
      "string"
        ? req.body.phoneNumber.trim()
        : "";

    if (!rawPhone) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message:
          "Phone number is required.",
      });
    }

    let normalizedPhone: string;

    try {
      normalizedPhone =
        normalizeKenyanPhoneNumber(
          rawPhone
        );
    } catch {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_PHONE_NUMBER",
        message:
          "Enter a valid Kenyan mobile phone number.",
      });
    }

    /* =====================================================
       FIND ACTIVE USER
    ===================================================== */

    const user =
      await prisma.user.findFirst({
        where: {
          phoneNumber:
            normalizedPhone,
          isActive: true,
        },

        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
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
            },
          },
        },
      });

    if (!user) {
      return res.status(400).json({
        success: false,
        code:
          "NO_PHONE_LOGIN_SESSION",
        message:
          "No active phone verification session was found. Start sign-in with your phone number and password.",
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
        code:
          "NO_ORGANIZATION_ACCESS",
        message:
          "This account does not have access to an active organization.",
      });
    }

    /* =====================================================
       ONLY ALLOW RESEND AFTER A VALID LOGIN START
    ===================================================== */

    const existingOtp =
      await prisma.otpVerification.findFirst(
        {
          where: {
            userId: user.id,
            type: "LOGIN",
            phoneNumber:
              normalizedPhone,
            email: null,
            verifiedAt: null,
            isInvalidated: false,
          },

          orderBy: {
            createdAt: "desc",
          },
        }
      );

    if (!existingOtp) {
      return res.status(400).json({
        success: false,
        code:
          "NO_PHONE_LOGIN_SESSION",
        message:
          "No active phone verification session was found. Start sign-in with your phone number and password.",
      });
    }

    const ageMilliseconds =
      Date.now() -
      existingOtp.createdAt.getTime();

    const cooldownMilliseconds =
      OTP_RESEND_COOLDOWN_SECONDS *
      1000;

    if (
      ageMilliseconds <
      cooldownMilliseconds
    ) {
      const retryAfterSeconds =
        Math.max(
          1,
          Math.ceil(
            (cooldownMilliseconds -
              ageMilliseconds) /
              1000
          )
        );

      res.setHeader(
        "Retry-After",
        retryAfterSeconds.toString()
      );

      return res.status(429).json({
        success: false,
        code: "OTP_COOLDOWN",
        message: `A verification code was already sent. Please wait ${retryAfterSeconds} seconds.`,
        retryAfterSeconds,
      });
    }

    /* =====================================================
       INVALIDATE PREVIOUS OTP
    ===================================================== */

    await prisma.otpVerification.updateMany({
      where: {
        userId: user.id,
        type: "LOGIN",
        isInvalidated: false,
      },

      data: {
        isInvalidated: true,
      },
    });

    /* =====================================================
       CREATE RESEND OTP
    ===================================================== */

    const otp = generateOtp();

    const expiresAt = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES *
          60 *
          1000
    );

    const otpRecord =
      await prisma.otpVerification.create({
        data: {
          userId: user.id,
          type: "LOGIN",
          email: null,
          phoneNumber:
            normalizedPhone,
          code: await hashOtp(otp),
          expiresAt,
          isInvalidated: false,
          attempts: 0,
          verifiedAt: null,
        },
      });

    try {
      await sendPhoneOtp(
        normalizedPhone,
        otp
      );
    } catch (error) {
      console.error(
        "[AUTH] Phone OTP resend failed:",
        error
      );

      await prisma.otpVerification.update({
        where: {
          id: otpRecord.id,
        },

        data: {
          isInvalidated: true,
        },
      });

      return res.status(503).json({
        success: false,
        code:
          "OTP_DELIVERY_FAILED",
        message:
          "Verification code could not be sent. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      requiresOtp: true,
      message:
        "A new verification code was sent to your phone.",

      verification: {
        channel: "PHONE",
        destination:
          maskPhoneNumber(
            normalizedPhone
          ),
        sessionType:
          isPlatformAdmin
            ? "PLATFORM"
            : "TENANT",
      },
    });
  } catch (error) {
    console.error(
      "[AUTH] Phone OTP resend error:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "PHONE_OTP_RESEND_ERROR",
      message:
        "Unable to resend the phone verification code.",
    });
  }
};

/* =========================================================
   FORGOT PASSWORD
========================================================= */

export const forgotPassword = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(
      req.body?.email
    );

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message:
          "Email address is required.",
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
          isActive: true,
        },
      });

    if (!user || !user.isActive) {
      return res.status(200).json({
        success: true,
        message:
          "If this email is registered, a reset link has been sent.",
      });
    }

    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        type: "PASSWORD_RESET",
      },

      getJwtSecret(),

      {
        expiresIn: "30m",
      }
    );

    const appUrl =
      process.env.APP_URL ??
      "http://localhost:5173";

    const resetLink =
      `${appUrl}/reset-password?token=${resetToken}`;

    try {
      await sendEmail(
        user.email,
        "Reset your Ziya FOS password",

        `<h2>Ziya Financial Operating System</h2>
         <p>Hello ${escapeHtml(user.name)},</p>
         <p>We received a request to reset your password. Click the button below to set a new password:</p>
         <p>
           <a
             href="${escapeHtml(resetLink)}"
             style="display:inline-block;padding:12px 28px;background:#6D5DF6;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;"
           >
             Reset Password
           </a>
         </p>
         <p>This link expires in 30 minutes. If you did not request this, you can safely ignore this email.</p>
         <p>Do not share this link with anyone.</p>`
      );
    } catch (error) {
      console.error(
        "[AUTH] Forgot-password email failed:",
        error
      );

      return res.status(503).json({
        success: false,
        code:
          "EMAIL_DELIVERY_FAILED",
        message:
          "Could not send reset email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "If this email is registered, a reset link has been sent.",
    });
  } catch (error) {
    console.error(
      "[AUTH] Forgot-password error:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "FORGOT_PASSWORD_ERROR",
      message:
        "Unable to process request.",
    });
  }
};

/* =========================================================
   RESET PASSWORD
========================================================= */

export const resetPassword = async (
  req: Request,
  res: Response
) => {
  try {
    const token =
      typeof req.body?.token === "string"
        ? req.body.token.trim()
        : "";

    const newPassword =
      typeof req.body?.newPassword ===
      "string"
        ? req.body.newPassword
        : "";

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message:
          "Reset token and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        code: "WEAK_PASSWORD",
        message:
          "Password must be at least 8 characters long.",
      });
    }

    let decoded: {
      userId: string;
      email: string;
      type: string;
    };

    try {
      decoded =
        jwt.verify(
          token,
          getJwtSecret()
        ) as typeof decoded;
    } catch {
      return res.status(401).json({
        success: false,
        code:
          "INVALID_RESET_TOKEN",
        message:
          "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    if (
      decoded.type !==
      "PASSWORD_RESET"
    ) {
      return res.status(401).json({
        success: false,
        code:
          "INVALID_RESET_TOKEN",
        message:
          "Invalid reset token.",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: decoded.userId,
        },

        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

    if (
      !user ||
      !user.isActive ||
      user.email !== decoded.email
    ) {
      return res.status(401).json({
        success: false,
        code:
          "INVALID_RESET_TOKEN",
        message:
          "This reset link is no longer valid.",
      });
    }

    const hashed =
      await bcrypt.hash(
        newPassword,
        12
      );

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        password: hashed,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await prisma.session.updateMany({
      where: {
        userId: user.id,
      },

      data: {
        isActive: false,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error(
      "[AUTH] Reset-password error:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "RESET_PASSWORD_ERROR",
      message:
        "Unable to reset password.",
    });
  }
};