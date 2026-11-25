import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { prisma } from "../../lib/prisma";
import { brevoConfigured, resendConfigured, smtpConfigured, env } from "../../config/env";
import { renderEmail } from "./templates";

let transporter: Transporter | null | undefined;
let resendClient: Resend | null | undefined;

function getResend(): Resend | null {
  if (resendClient === undefined) {
    resendClient = resendConfigured ? new Resend(env.resendApiKey) : null;
  }
  return resendClient;
}

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = smtpConfigured ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      tls: { rejectUnauthorized: env.smtpRejectUnauthorized },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    } as any) : null;
  }
  return transporter;
}

const brevoSender = () => ({
  name: env.brevoSenderName || "EMC Talent Acquisition",
  email: env.brevoSenderEmail,
});

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

  const resend = getResend();
  const transporter = getTransporter();
  const maxAttempts = 3;
  let lastError: Error | undefined;

  const sendViaBrevo = async (): Promise<SendResult | null> => {
    if (!brevoConfigured) return null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": env.brevoApiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: brevoSender(),
            to: [{ email: input.to }],
            subject: input.subject ?? "(no subject)",
            htmlContent: input.html || `<p>${input.text ?? input.subject ?? ""}</p>`,
            textContent: input.text,
            replyTo: env.mailReplyTo ? { email: env.mailReplyTo } : undefined,
            attachments: input.attachments?.map((a) => ({ name: a.filename, content: a.content.toString("base64") })),
          }),
        });
        if (!response.ok) {
          throw new Error(`Brevo ${response.status}: ${(await response.text()).slice(0, 300)}`);
        }
        const payload = (await response.json().catch(() => null)) as { messageId?: string } | null;
        try {
          if (log) {
            await prisma.emailLog.update({
              where: { id: log.id },
              data: {
                status: "SENT",
                attempts: attempt,
                sentAt: new Date(),
                metadata: { ...(log.metadata as Record<string, unknown> | undefined), messageId: payload?.messageId, provider: "brevo" },
              },
            });
          }
        } catch {}
        return { status: "SENT", message: payload?.messageId ?? "brevo" };
      } catch (error) {
        lastError = error as Error;
        console.error(`[email:brevo] attempt ${attempt} failed for ${input.to}`, lastError.message);
        if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
    return null;
  };

  const sendViaResend = async (): Promise<SendResult | null> => {
    if (!resend) return null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const sent = await resend.emails.send({
          from: env.mailFrom || "no-reply@emc.example",
          to: [input.to],
          subject: input.subject ?? "(no subject)",
          html: input.html,
          text: input.text,
          replyTo: env.mailReplyTo || undefined,
          attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
        } as any);
        if ((sent as any)?.error) throw new Error((sent as any).error.message || "Resend send failed");
        try { if (log) await prisma.emailLog.update({ where: { id: log.id }, data: { status: "SENT", attempts: attempt, sentAt: new Date(), metadata: { ...(log.metadata as Record<string, unknown> | undefined), messageId: (sent as any)?.data?.id, provider: "resend" } } }); } catch {}
        return { status: "SENT", message: (sent as any)?.data?.id };
      } catch (error) {
        lastError = error as Error;
        console.error(`[email:resend] attempt ${attempt} failed for ${input.to}`, lastError.message);
        if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
    return null;
  };

  const brevoResult = await sendViaBrevo();
  if (brevoResult) return brevoResult;

  if (!transporter || !smtpConfigured) {
    const resendResult = await sendViaResend();
    if (resendResult) return resendResult;
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
                provider: "smtp",
              },
            },
          });
        }
      } catch {}
      return { status: "SENT", message: sent.messageId };
    } catch (error) {
      lastError = error as Error;
      console.error(`[email:smtp] attempt ${attempt} failed for ${input.to}`, lastError.message);
      try { if (log) await prisma.emailLog.update({ where: { id: log.id }, data: { attempts: attempt, error: lastError.message } }); } catch {}
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  const resendFallback = await sendViaResend();
  if (resendFallback) return resendFallback;

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
  return !brevoConfigured && !resendConfigured && (!smtpConfigured || !getTransporter());
}
