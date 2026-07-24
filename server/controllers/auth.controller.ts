import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return secret;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function generateOtp(): string {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
}

/* =========================================================
   LOGIN
   STEP 1: PASSWORD → SEND OTP
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
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
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
        message: "Invalid email or password.",
      });
    }

    const otp = generateOtp();

    const expiresAt = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES * 60 * 1000
    );

    await prisma.otpVerification.deleteMany({
      where: {
        email: user.email,
      },
    });

    await prisma.otpVerification.create({
      data: {
        email: user.email,
        otp,
        expiresAt,
      },
    });

    try {
      await sendEmail(
        user.email,
        "Ziya FOS Login Verification Code",
        `
          <h2>Ziya Financial Operating System</h2>

          <p>Hello ${user.name},</p>

          <p>Your One-Time Password (OTP) is:</p>

          <h1 style="letter-spacing:5px;">
            ${otp}
          </h1>

          <p>
            This code expires in
            ${OTP_EXPIRY_MINUTES} minutes.
          </p>

          <p>
            If you did not request this login,
            please ignore this email.
          </p>
        `
      );
    } catch (error) {
      console.error(
        "[AUTH] Failed to send OTP email:",
        error
      );

      /*
       * Do not leave an unusable OTP record behind
       * when email delivery fails.
       */
      await prisma.otpVerification.deleteMany({
        where: {
          email: user.email,
        },
      });

      return res.status(503).json({
        success: false,
        message:
          "Verification email could not be sent. Please try again.",
      });
    }

    /*
     * IMPORTANT:
     * No JWT is issued here.
     * Password authentication alone is not enough.
     * OTP must be verified first.
     */

    return res.status(200).json({
      success: true,
      requiresOtp: true,
      message:
        "Verification code sent successfully.",
      email: user.email,
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete login.",
    });
  }
};

/* =========================================================
   VERIFY OTP
   STEP 2: OTP → ISSUE JWT
========================================================= */

export const verifyOtp = async (
  req: Request,
  res: Response
) => {
  try {
    const email = normalizeEmail(req.body?.email);

    const otp =
      typeof req.body?.otp === "string"
        ? req.body.otp.trim()
        : "";

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message:
          "Email and verification code are required.",
      });
    }

    const record =
      await prisma.otpVerification.findFirst({
        where: {
          email,
          otp,
          verified: false,
        },
        orderBy: {
          expiresAt: "desc",
        },
      });

    if (!record) {
      return res.status(401).json({
        success: false,
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
        message:
          "Verification code has expired. Please request a new one.",
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
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account was not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is disabled.",
      });
    }

    const secret = getJwtSecret();

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      secret,
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
     * Remove any remaining OTP records for
     * this account after successful verification.
     */
    await prisma.otpVerification.deleteMany({
      where: {
        email,
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
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "[AUTH] OTP verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to complete verification.",
    });
  }
};