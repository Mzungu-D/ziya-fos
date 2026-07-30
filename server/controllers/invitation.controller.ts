/*
 * OTPs are account-specific.
 *
 * Remove previous OTP attempts before
 * creating a new one.
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
        This verification code will expire shortly.
      </p>

      <p>
        If you did not attempt to sign in to Ziya FOS,
        you can ignore this email.
      </p>
    `
  );
} catch (error) {
  /*
   * Remove the OTP if delivery fails.
   *
   * This prevents an undelivered verification
   * code from remaining valid in the database.
   */
  await prisma.otpVerification.deleteMany({
    where: {
      userId: user.id,
      code: otp,
    },
  });

  console.error(
    "[AUTH] OTP email delivery failed:",
    error
  );

  return res.status(500).json({
    success: false,
    code: "OTP_DELIVERY_FAILED",
    message:
      "Verification code could not be sent. Please try again.",
  });
}