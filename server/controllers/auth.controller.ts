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
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const STANDARD_SESSION_DAYS = 1;
const REMEMBERED_SESSION_DAYS = 30;
const STANDARD_SESSION_EXPIRY = "1d";
const REMEMBERED_SESSION_EXPIRY = "30d";

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
  if (typeof value === "string" && value.trim().toUpperCase() === "PHONE") {
    return "PHONE";
  }
  return "EMAIL";
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  const visible = localPart.substring(0, Math.min(2, localPart.length));
  return `${visible}***@${domain}`;
}

function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) return "****";
  return "*".repeat(Math.max(0, phoneNumber.length - 4)) + phoneNumber.slice(-4);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

/* =========================================================
   LOGIN
========================================================= */

export const login = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const otpChannel = normalizeOtpChannel(req.body?.otpChannel);
    const submittedPhoneNumber =
      typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
        isActive: true,
        platformRole: true,
        loginAttempts: true,
        lockedUntil: true,
        memberships: {
          where: {
            isActive: true,
            organization: { status: "ACTIVE" },
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

    /* =====================================================
       ACCOUNT LOCKOUT CHECK
    ===================================================== */

    if (user.lockedUntil) {
      if (new Date() < user.lockedUntil) {
        const minutesLeft = Math.ceil(
          (user.lockedUntil.getTime() - Date.now()) / 60000
        );
        return res.status(429).json({
          success: false,
          code: "ACCOUNT_LOCKED",
          message: `Account is temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
          lockedUntil: user.lockedUntil,
        });
      }

      // Lock window expired — clear it
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
    }

    /* =====================================================
       PASSWORD CHECK
    ===================================================== */

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const newAttempts = (user.loginAttempts ?? 0) + 1;
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
            : null,
        },
      });

      if (shouldLock) {
        return res.status(429).json({
          success: false,
          code: "ACCOUNT_LOCKED",
          message: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
        });
      }

      const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message:
          remaining > 0
            ? `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`
            : "Invalid email or password.",
      });
    }

    // Password correct — reset lockout counters
    if ((user.loginAttempts ?? 0) > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
    }

    const isPlatformAdmin = user.platformRole === "PLATFORM_ADMIN";

    if (!isPlatformAdmin && user.memberships.length === 0) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message: "This account does not have access to an active organization.",
      });
    }

    /* =====================================================
       DETERMINE OTP DESTINATION
    ===================================================== */

    let normalizedPhoneNumber: string | null = null;

    if (otpChannel === "PHONE") {
      const phoneCandidate =
        submittedPhoneNumber ||
        (user.phoneVerifiedAt && user.phoneNumber ? user.phoneNumber : "");

      if (!phoneCandidate) {
        return res.status(400).json({
          success: false,
          code: "PHONE_NUMBER_REQUIRED",
          message: "Enter the phone number where you want to receive the verification code.",
        });
      }

      try {
        normalizedPhoneNumber = normalizeKenyanPhoneNumber(phoneCandidate);
      } catch {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE_NUMBER",
          message: "Enter a valid Kenyan mobile phone number.",
        });
      }
    }

    /* =====================================================
       OTP RESEND COOLDOWN
    ===================================================== */

    const existingOtp = await prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        type: "LOGIN",
        verifiedAt: null,
        isInvalidated: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingOtp) {
      const ageMilliseconds = Date.now() - existingOtp.createdAt.getTime();
      const cooldownMilliseconds = OTP_RESEND_COOLDOWN_SECONDS * 1000;

      if (ageMilliseconds < cooldownMilliseconds) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((cooldownMilliseconds - ageMilliseconds) / 1000)
        );

        res.setHeader("Retry-After", retryAfterSeconds.toString());

        return res.status(429).json({
          success: false,
          code: "OTP_COOLDOWN",
          message: `A verification code was already sent. Please wait ${retryAfterSeconds} seconds before requesting another code.`,
          retryAfterSeconds,
        });
      }
    }

    /* =====================================================
       INVALIDATE OLD OTPs & CREATE NEW ONE
    ===================================================== */

    await prisma.otpVerification.updateMany({
      where: {
        userId: user.id,
        type: "LOGIN",
        isInvalidated: false,
      },
      data: { isInvalidated: true },
    });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const otpRecord = await prisma.otpVerification.create({
      data: {
        userId: user.id,
        type: "LOGIN",
        email: otpChannel === "EMAIL" ? user.email : null,
        phoneNumber: otpChannel === "PHONE" ? normalizedPhoneNumber : null,
        code: otp,
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
            <h2>Ziya Financial Operating System</h2>
            <p>Hello ${user.name},</p>
            <p>Your verification code is:</p>
            <h1 style="letter-spacing: 5px;">${otp}</h1>
            <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
            <p>Do not share this code with anyone.</p>
            <p>If you did not request this login, you can ignore this message.</p>
          `
        );
      } catch (error) {
        console.error("[AUTH] Email OTP delivery failed:", error);

        await prisma.otpVerification.update({
          where: { id: otpRecord.id },
          data: { isInvalidated: true },
        });

        return res.status(503).json({
          success: false,
          code: "OTP_DELIVERY_FAILED",
          message: "Verification code could not be sent by email. Please try again.",
        });
      }

      return res.status(200).json({
        success: true,
        requiresOtp: true,
        message: "Verification code sent successfully by email.",
        verification: {
          channel: "EMAIL",
          destination: maskEmail(user.email),
          sessionType: isPlatformAdmin ? "PLATFORM" : "TENANT",
        },
      });
    }

    /* =====================================================
       PHONE OTP
    ===================================================== */

    if (!normalizedPhoneNumber) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isInvalidated: true },
      });

      return res.status(400).json({
        success: false,
        code: "PHONE_NUMBER_REQUIRED",
        message: "A valid phone number is required.",
      });
    }

    try {
      await sendPhoneOtp(normalizedPhoneNumber, otp);
    } catch (error) {
      console.error("[AUTH] Phone OTP delivery failed:", error);

      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isInvalidated: true },
      });

      return res.status(503).json({
        success: false,
        code: "OTP_DELIVERY_FAILED",
        message: "Verification code could not be sent by phone. Please try again or use email verification.",
      });
    }

    return res.status(200).json({
      success: true,
      requiresOtp: true,
      message: "Verification code sent successfully by phone.",
      verification: {
        channel: "PHONE",
        destination: maskPhoneNumber(normalizedPhoneNumber),
        sessionType: isPlatformAdmin ? "PLATFORM" : "TENANT",
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
========================================================= */

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = normalizeOtp(req.body?.otp);
    const otpChannel = normalizeOtpChannel(req.body?.otpChannel);
    const requestedOrganizationId =
      typeof req.body?.organizationId === "string"
        ? req.body.organizationId.trim()
        : "";
    const rememberMe = req.body?.rememberMe === true;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Email and verification code are required.",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_OTP_FORMAT",
        message: "Verification code must contain exactly 6 digits.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
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
            organization: { status: "ACTIVE" },
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

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      return res.status(429).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: `Account is temporarily locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        lockedUntil: user.lockedUntil,
      });
    }

    /* =====================================================
       FIND ACTIVE OTP RECORD
    ===================================================== */

    const record = await prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        type: "LOGIN",
        verifiedAt: null,
        isInvalidated: false,
        ...(otpChannel === "PHONE"
          ? { phoneNumber: { not: null }, email: null }
          : { email: user.email, phoneNumber: null }),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return res.status(401).json({
        success: false,
        code: "INVALID_OTP",
        message: "No active verification code found. Please request a new one.",
      });
    }

    if (new Date() > record.expiresAt) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { isInvalidated: true },
      });

      return res.status(401).json({
        success: false,
        code: "OTP_EXPIRED",
        message: "Verification code has expired. Please request a new one.",
      });
    }

    /* =====================================================
       CODE MATCH + BRUTE FORCE PROTECTION
    ===================================================== */

    if (record.code !== otp) {
      const newAttempts = record.attempts + 1;
      const maxedOut = newAttempts >= MAX_OTP_ATTEMPTS;

      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: newAttempts, isInvalidated: maxedOut },
      });

      if (maxedOut) {
        return res.status(401).json({
          success: false,
          code: "OTP_MAX_ATTEMPTS",
          message: "Too many incorrect attempts. Please request a new verification code.",
        });
      }

      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      return res.status(401).json({
        success: false,
        code: "INVALID_OTP",
        message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
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
          message: "Phone verification could not be completed.",
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          phoneNumber: record.phoneNumber,
          phoneVerifiedAt: new Date(),
        },
      });
    }

    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { verifiedAt: new Date() },
    });

    await prisma.otpVerification.updateMany({
      where: { userId: user.id, id: { not: record.id }, isInvalidated: false },
      data: { isInvalidated: true },
    });

    const verifiedPhoneNumber =
      otpChannel === "PHONE" ? record.phoneNumber : user.phoneNumber;
    const verifiedPhoneAt =
      otpChannel === "PHONE" ? new Date() : user.phoneVerifiedAt;

    const clientIp = getClientIp(req);
    const userAgent = req.headers["user-agent"] ?? null;

    /* =====================================================
       CREATE SESSION IN DATABASE
    ===================================================== */

    const sessionToken = generateSessionToken();
    const sessionDays = rememberMe ? REMEMBERED_SESSION_DAYS : STANDARD_SESSION_DAYS;
    const sessionExpiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
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

    await prisma.user.update({
      where: { id: user.id },
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

    if (user.platformRole === "PLATFORM_ADMIN") {
      const token = jwt.sign(
        {
          userId: user.id,
          sessionId: session.id,
          sessionType: "PLATFORM",
          rememberMe,
          platformRole: "PLATFORM_ADMIN",
        },
        getJwtSecret(),
        { expiresIn: rememberMe ? REMEMBERED_SESSION_EXPIRY : STANDARD_SESSION_EXPIRY }
      );

      return res.status(200).json({
        success: true,
        message: "Platform login successful.",
        token,
        sessionType: "PLATFORM",
        verificationChannel: otpChannel,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: verifiedPhoneNumber,
          phoneVerifiedAt: verifiedPhoneAt,
          platformRole: user.platformRole,
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
        message: "This account does not have access to an active organization.",
      });
    }

    let membership = requestedOrganizationId
      ? user.memberships.find((item) => item.organizationId === requestedOrganizationId)
      : undefined;

    if (requestedOrganizationId && !membership) {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_ACCESS_DENIED",
        message: "You do not have access to the selected organization.",
      });
    }

    if (!membership) {
      membership = user.memberships.find((item) => item.isDefault) ?? user.memberships[0];
    }

    if (!membership) {
      return res.status(403).json({
        success: false,
        code: "NO_ORGANIZATION_ACCESS",
        message: "No active organization is available for this account.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        sessionId: session.id,
        sessionType: "TENANT",
        rememberMe,
        organizationId: membership.organizationId,
        role: membership.role,
      },
      getJwtSecret(),
      { expiresIn: rememberMe ? REMEMBERED_SESSION_EXPIRY : STANDARD_SESSION_EXPIRY }
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
        phoneNumber: verifiedPhoneNumber,
        phoneVerifiedAt: verifiedPhoneAt,
        role: membership.role,
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        logoUrl: membership.organization.logoUrl,
        country: membership.organization.country,
        currency: membership.organization.currency,
      },
      organizations: user.memberships.map((item) => ({
        id: item.organization.id,
        name: item.organization.name,
        slug: item.organization.slug,
        logoUrl: item.organization.logoUrl,
        role: item.role,
        isDefault: item.isDefault,
      })),
    });
  } catch (error) {
    console.error("[AUTH] OTP verification error:", error);

    return res.status(500).json({
      success: false,
      code: "OTP_VERIFICATION_ERROR",
      message: "Unable to complete verification.",
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
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as {
          sessionId?: string;
          userId?: string;
        };

        if (decoded.sessionId) {
          await prisma.session.updateMany({
            where: {
              id: decoded.sessionId,
              userId: decoded.userId,
            },
            data: { isActive: false },
          });
        }
      } catch {
        // Token invalid or expired — nothing to revoke
      }
    }

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
/* =========================================================
   PHONE LOGIN  (phone number only → OTP, no password)
========================================================= */

export const phoneLogin = async (req: Request, res: Response) => {
  try {
    const rawPhone = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";

    if (!rawPhone) {
      return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Phone number is required." });
    }

    let normalizedPhone: string;
    try { normalizedPhone = normalizeKenyanPhoneNumber(rawPhone); }
    catch { return res.status(400).json({ success: false, code: "INVALID_PHONE_NUMBER", message: "Enter a valid Kenyan mobile phone number." }); }

    const user = await prisma.user.findFirst({
      where: { phoneNumber: normalizedPhone, phoneVerifiedAt: { not: null }, isActive: true },
      select: {
        id: true, name: true, email: true, phoneNumber: true,
        phoneVerifiedAt: true, platformRole: true,
        memberships: {
          where: { isActive: true, organization: { status: "ACTIVE" } },
          select: { id: true, organizationId: true },
        },
      },
    });

    if (!user) {
      return res.status(200).json({
        success: true, requiresOtp: true,
        message: "If this number is registered, a verification code has been sent.",
        verification: { channel: "PHONE", destination: maskPhoneNumber(normalizedPhone), sessionType: "TENANT" },
      });
    }

    const isPlatformAdmin = user.platformRole === "PLATFORM_ADMIN";
    if (!isPlatformAdmin && user.memberships.length === 0) {
      return res.status(403).json({ success: false, code: "NO_ORGANIZATION_ACCESS", message: "This account does not have access to an active organization." });
    }

    const existingOtp = await prisma.otpVerification.findFirst({
      where: { userId: user.id, type: "LOGIN", verifiedAt: null, isInvalidated: false },
      orderBy: { createdAt: "desc" },
    });

    if (existingOtp) {
      const ageMs      = Date.now() - existingOtp.createdAt.getTime();
      const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
      if (ageMs < cooldownMs) {
        const retryAfter = Math.max(1, Math.ceil((cooldownMs - ageMs) / 1000));
        res.setHeader("Retry-After", retryAfter.toString());
        return res.status(429).json({ success: false, code: "OTP_COOLDOWN", message: `A code was already sent. Please wait ${retryAfter} seconds.`, retryAfterSeconds: retryAfter });
      }
    }

    await prisma.otpVerification.updateMany({ where: { userId: user.id, type: "LOGIN", isInvalidated: false }, data: { isInvalidated: true } });

    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const otpRecord = await prisma.otpVerification.create({
      data: { userId: user.id, type: "LOGIN", email: null, phoneNumber: normalizedPhone, code: otp, expiresAt, isInvalidated: false, attempts: 0, verifiedAt: null },
    });

    try {
      await sendPhoneOtp(normalizedPhone, otp);
    } catch (error) {
      console.error("[AUTH] Phone-login OTP delivery failed:", error);
      await prisma.otpVerification.update({ where: { id: otpRecord.id }, data: { isInvalidated: true } });
      return res.status(503).json({ success: false, code: "OTP_DELIVERY_FAILED", message: "Verification code could not be sent. Please try again." });
    }

    return res.status(200).json({
      success: true, requiresOtp: true,
      message: "Verification code sent to your phone.",
      verification: { channel: "PHONE", destination: maskPhoneNumber(normalizedPhone), sessionType: isPlatformAdmin ? "PLATFORM" : "TENANT" },
    });
  } catch (error) {
    console.error("[AUTH] Phone login error:", error);
    return res.status(500).json({ success: false, code: "PHONE_LOGIN_ERROR", message: "Unable to complete phone login." });
  }
};

/* =========================================================
   FORGOT PASSWORD
========================================================= */

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Email address is required." });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, isActive: true } });

    if (!user || !user.isActive) {
      return res.status(200).json({ success: true, message: "If this email is registered, a reset link has been sent." });
    }

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: "PASSWORD_RESET" },
      getJwtSecret(),
      { expiresIn: "30m" }
    );

    const appUrl    = process.env.APP_URL ?? "http://localhost:5173";
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

    try {
      await sendEmail(
        user.email,
        "Reset your Ziya FOS password",
        `<h2>Ziya Financial Operating System</h2>
         <p>Hello ${user.name},</p>
         <p>We received a request to reset your password. Click the button below to set a new password:</p>
         <p><a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#6D5DF6;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a></p>
         <p>This link expires in 30 minutes. If you did not request this, you can safely ignore this email.</p>
         <p>Do not share this link with anyone.</p>`
      );
    } catch (error) {
      console.error("[AUTH] Forgot-password email failed:", error);
      return res.status(503).json({ success: false, code: "EMAIL_DELIVERY_FAILED", message: "Could not send reset email. Please try again." });
    }

    return res.status(200).json({ success: true, message: "If this email is registered, a reset link has been sent." });
  } catch (error) {
    console.error("[AUTH] Forgot-password error:", error);
    return res.status(500).json({ success: false, code: "FORGOT_PASSWORD_ERROR", message: "Unable to process request." });
  }
};

/* =========================================================
   RESET PASSWORD
========================================================= */

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const token       = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (!token || !newPassword) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Reset token and new password are required." });
    if (newPassword.length < 8)  return res.status(400).json({ success: false, code: "WEAK_PASSWORD", message: "Password must be at least 8 characters long." });

    let decoded: { userId: string; email: string; type: string };
    try { decoded = jwt.verify(token, getJwtSecret()) as typeof decoded; }
    catch { return res.status(401).json({ success: false, code: "INVALID_RESET_TOKEN", message: "This reset link is invalid or has expired. Please request a new one." }); }

    if (decoded.type !== "PASSWORD_RESET") {
      return res.status(401).json({ success: false, code: "INVALID_RESET_TOKEN", message: "Invalid reset token." });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, email: true, isActive: true } });

    if (!user || !user.isActive || user.email !== decoded.email) {
      return res.status(401).json({ success: false, code: "INVALID_RESET_TOKEN", message: "This reset link is no longer valid." });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, loginAttempts: 0, lockedUntil: null } });
    await prisma.session.updateMany({ where: { userId: user.id }, data: { isActive: false } });

    return res.status(200).json({ success: true, message: "Password reset successfully. You can now sign in with your new password." });
  } catch (error) {
    console.error("[AUTH] Reset-password error:", error);
    return res.status(500).json({ success: false, code: "RESET_PASSWORD_ERROR", message: "Unable to reset password." });
  }
};