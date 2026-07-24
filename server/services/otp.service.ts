import crypto from "crypto";

export const OTP_EXPIRY_MINUTES = 10;

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function getOtpExpiry(): Date {
  return new Date(
    Date.now() +
      OTP_EXPIRY_MINUTES * 60 * 1000
  );
}

export function isOtpExpired(
  expiresAt: Date
): boolean {
  return Date.now() > expiresAt.getTime();
}