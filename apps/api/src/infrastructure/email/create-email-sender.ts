import nodemailer from "nodemailer";
import type { IEmailSender } from "../../domain/ports/email-sender.js";

/**
 * SMTP email when env is configured; otherwise a silent no-op (dev-friendly).
 */
export function createEmailSender(): IEmailSender {
  const explicitOff = process.env.EMAIL_ENABLED === "false";
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.EMAIL_FROM?.trim() || user || "noreply@localhost";
  const port = Number(process.env.SMTP_PORT || "587");

  const canSend = !explicitOff && Boolean(host && user && pass);

  if (!canSend) {
    return {
      async send() {
        /* noop — SMTP not configured */
      },
    };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return {
    async send(input) {
      await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    },
  };
}
