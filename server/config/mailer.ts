import nodemailer from "nodemailer";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`[MAILER] Missing required environment variable: ${name}`);
  }

  return value;
}

function getSmtpPort(): number {
  const rawPort = getRequiredEnv("SMTP_PORT");
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`[MAILER] Invalid SMTP_PORT: ${rawPort}`);
  }

  return port;
}

const smtpHost = getRequiredEnv("SMTP_HOST");
const smtpPort = getSmtpPort();
const smtpUser = getRequiredEnv("SMTP_USER");
const smtpPass = getRequiredEnv("SMTP_PASS");
const smtpFromName = getRequiredEnv("SMTP_FROM_NAME");
const smtpFromEmail = getRequiredEnv("SMTP_FROM_EMAIL");

/*
 * SMTP TLS rules:
 *
 * Port 465  -> implicit TLS
 * Port 587  -> STARTTLS
 * Other     -> plain connection with STARTTLS when advertised
 */
const secure = smtpPort === 465;

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure,

  auth: {
    user: smtpUser,
    pass: smtpPass,
  },

  ...(secure
    ? {}
    : {
        requireTLS: smtpPort === 587,
      }),

  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
});

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
) => {
  const recipient = to.trim();

  if (!recipient) {
    throw new Error("[MAILER] Recipient email address is required.");
  }

  if (!subject.trim()) {
    throw new Error("[MAILER] Email subject is required.");
  }

  if (!html.trim()) {
    throw new Error("[MAILER] Email HTML content is required.");
  }

  try {
    const result = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: recipient,
      subject: subject.trim(),
      html,
    });

    return result;
  } catch (error) {
    console.error("[MAILER] Email delivery failed:", {
      recipient,
      subject: subject.trim(),
      error,
    });

    throw error;
  }
};