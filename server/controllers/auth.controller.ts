import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../config/mailer";

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

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
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Account is disabled" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.deleteMany({ where: { email: user.email } });

    await prisma.otpVerification.create({
      data: { email: user.email, otp, expiresAt },
    });

    // Send OTP email — log error but don't crash login
    try {
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
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "ziya-secret-key",
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const record = await prisma.otpVerification.findFirst({
      where: { email, otp, verified: false },
    });

    if (!record) {
      return res.status(401).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > record.expiresAt) {
      return res.status(401).json({ success: false, message: "OTP has expired" });
    }

    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    return res.status(200).json({ success: true, message: "OTP verified" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};