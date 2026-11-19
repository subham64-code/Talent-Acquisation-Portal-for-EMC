import { prisma } from "../lib/prisma";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { env } from "../config/env";

const REQUIRED_FIELDS = [
  "fullName",
  "personalEmail",
  "mobile",
  "departmentId",
  "designationId",
  "qualification",
  "totalExperience",
  "specialization",
  "employmentTypeId",
  "workLocation",
];

function completionOf(fields: any): number {
  if (!fields) return 0;
  const filled = REQUIRED_FIELDS.filter((key) => {
    const value = fields[key];
    return value !== undefined && value !== null && String(value).trim().length > 0;
  }).length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

export function startEmployeeInvitationReminderScheduler() {
  const reminderHours = Number(process.env.EMPLOYEE_INVITE_REMINDER_HOURS ?? "72");
  const reminderMs = Math.max(1, reminderHours) * 60 * 60 * 1000;
  const appUrl = env.appUrl;

  const run = async () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - reminderMs);
    const due = await prisma.employeeUpdateInvitation.findMany({
      where: {
        usedAt: null,
        OR: [
          { lastReminderSentAt: null, createdAt: { lte: cutoff } },
          { lastReminderSentAt: { lte: cutoff } },
        ],
      },
      include: { employee: true },
      take: 100,
    });

    for (const invitation of due) {
      const draft = invitation.draft as any;
      const fields = (invitation.submission as any)?.fields ?? draft ?? null;
      const completion = completionOf(fields);
      if (completion >= 100) continue;

      await prisma.employeeUpdateInvitation.update({
        where: { id: invitation.id },
        data: {
          reminderCount: (invitation.reminderCount ?? 0) + 1,
          lastReminderSentAt: now,
        },
      });
      await prisma.employeeInviteReminder.create({
        data: {
          invitationId: invitation.id,
          purpose: "reminder",
          profileCompletion: completion,
          renewedToken: false,
          sentAt: now,
        },
      });
      void sendTemplateEmail({
        to: invitation.employee.officialEmail,
        templateKey: "hr_notification",
        data: {
          name: invitation.employee.fullName,
          title: "Action required: complete your EMC profile",
          message: `Your employee profile is ${completion}% complete. The secure link never expires — please open it and submit your profile at your earliest convenience. We'll send reminders every 3 days until you do.`,
          link: appUrl,
        },
        metadata: { invitationId: invitation.id, employeeId: invitation.employeeId, reminderPurpose: "reminder" },
      });
    }

  };

  // Run once at startup and then hourly.
  run().catch((error) => console.error("[invitation-reminder] initial run failed:", String((error?.message ?? error)).split("\n")[0]));
  const timer = setInterval(() => {
    run().catch((error) => console.error("[invitation-reminder] run failed:", String((error?.message ?? error)).split("\n")[0]));
  }, 60 * 60 * 1000);
  timer.unref();
}
