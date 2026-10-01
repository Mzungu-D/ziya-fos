import nodemailer from "nodemailer";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `[MAILER] Missing required environment variable: ${name}`
    );
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
 * SMTP TLS:
 *
 * 465 = implicit TLS
 * 587 = STARTTLS
 * Other ports = normal SMTP connection
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

  ...(smtpPort === 587
    ? {
        requireTLS: true,
      }
    : {}),

  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
});

/**
 * Sends an email through the configured SMTP provider.
 *
 * Important:
 * A successful sendMail() call means the SMTP server
 * accepted the message. It does not necessarily mean
 * the recipient's mailbox has delivered it to Inbox.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string
) => {
  const recipient = to.trim();
  const cleanSubject = subject.trim();
  const cleanHtml = html.trim();

  if (!recipient) {
    throw new Error(
      "[MAILER] Recipient email address is required."
    );
  }

  if (!cleanSubject) {
    throw new Error(
      "[MAILER] Email subject is required."
    );
  }

  if (!cleanHtml) {
    throw new Error(
      "[MAILER] Email HTML content is required."
    );
  }

  try {
    const result = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: recipient,
      subject: cleanSubject,
      html: cleanHtml,
    });

    console.info("[MAILER] Email accepted by SMTP server:", {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
      envelope: result.envelope,
    });

    /*
     * Normally Nodemailer reports rejected recipients here.
     * Treat a completely rejected delivery as an error so
     * the authentication controller does not report success.
     */
    if (
      Array.isArray(result.rejected) &&
      result.rejected.length > 0 &&
      (!Array.isArray(result.accepted) ||
        result.accepted.length === 0)
    ) {
      throw new Error(
        `[MAILER] SMTP rejected recipient: ${recipient}`
      );
    }

    return result;
  } catch (error) {
    console.error("[MAILER] Email delivery failed:", {
      recipient,
      subject: cleanSubject,
      smtpHost,
      smtpPort,
      error,
    });

    throw error;
  }
};