import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../config/mailer";

const prisma = new PrismaClient();

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
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
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is disabled",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate OTP
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // OTP expires in 10 minutes
    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // Delete previous OTPs
    await prisma.otpVerification.deleteMany({
      where: {
        email: user.email,
      },
    });

    // Save new OTP
    await prisma.otpVerification.create({
      data: {
        email: user.email,
        otp,
        expiresAt,
      },
    });

    // Send OTP Email
    await sendEmail(
      user.email,
      "Ziya FOS Login Verification Code",
      `
      <h2>Ziya Financial Operating System</h2>

      <p>Hello ${user.name},</p>

      <p>Your One-Time Password (OTP) is:</p>

      <h1 style="letter-spacing:5px;">${otp}</h1>

      <p>This code expires in 10 minutes.</p>

      <p>If you did not request this login, please ignore this email.</p>
      `
    );

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET || "ziya-secret-key",
      {
        expiresIn: "1d",
      }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};