import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "../../lib/prisma";
import { smtpConfigured, env } from "../../config/env";
import { renderEmail } from "./templates";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = smtpConfigured ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      tls: { rejectUnauthorized: env.smtpRejectUnauthorized },
    }) : null;
  }
  return transporter;
}

interface SendEmailInput {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  templateKey?: string | null;
  metadata?: Record<string, unknown>;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

interface SendResult {
  status: string;
  message?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  let log: any;
  try {
    log = await prisma.emailLog.create({
      data: {
        toEmail: input.to,
        templateKey: input.templateKey ?? null,
        subject: input.subject ?? "(no subject)",
        status: "PENDING",
        attempts: 0,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch {
    log = undefined as any;
  }

  const transporter = getTransporter();
  const maxAttempts = 3;
  let lastError: Error | undefined;

  if (!transporter || !smtpConfigured) {
    const body = input.html || input.text || input.subject;
    console.log("[email:simulated]", input.to, input.subject, body ? "=> " + body.slice(0, 180) : "");
    try {
      if (log) {
        await prisma.emailLog.update({
          where: { id: log.id },
          data: { status: "SIMULATED", sentAt: new Date(), attempts: maxAttempts },
        });
      }
    } catch {}
    return { status: "SIMULATED" };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const sent = await transporter.sendMail({
        from: env.mailFrom || "no-reply@emc.example",
        replyTo: env.mailReplyTo || undefined,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments,
      });
      try {
        if (log) {
          await prisma.emailLog.update({
            where: { id: log.id },
            data: {
              status: "SENT",
              attempts: attempt,
              sentAt: new Date(),
              metadata: {
                ...(log.metadata as Record<string, unknown> | undefined),
                messageId: sent.messageId,
              },
            },
          });
        }
      } catch {}
      return { status: "SENT", message: sent.messageId };
    } catch (error) {
      lastError = error as Error;
      console.error(`[email] attempt ${attempt} failed for ${input.to}`, lastError.message);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }

  try {
    if (log) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "FAILED", attempts: maxAttempts, error: lastError?.message ?? "unknown" },
      });
    }
  } catch {}
  return { status: "FAILED", message: lastError?.message };
}

interface SendTemplateInput extends SendEmailInput {
  templateKey: string;
  data: Record<string, unknown>;
}

export async function sendTemplateEmail(input: SendTemplateInput): Promise<SendResult> {
  try {
    const rendered = renderEmail(input.templateKey, input.data);
    return await sendEmail({
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: input.templateKey,
      metadata: input.metadata,
      attachments: input.attachments,
    });
  } catch (error) {
    console.error("[email] failed to send template email", input.templateKey, input.to, (error as Error)?.message);
    return { status: "FAILED", message: (error as Error)?.message };
  }
}

export function emailSimulated(): boolean {
  return !smtpConfigured || !getTransporter();
}
