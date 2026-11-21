import { env } from "../../config/env";

type TemplateData = Record<string, unknown>;

/** EMC logo hosted on the public site (used inside email clients). */
const EMC_LOGO = "https://ecometrix.co.in/wp-content/uploads/2026/05/cropped-EMC-Logo-White-UT-1-e1780053104843.png";

const BRAND = {
  green: "#198754",
  greenDark: "#0F3D2E",
  greenMid: "#146C43",
  orange: "#F28C28",
  orangeDark: "#D97417",
  ink: "#171717",
  muted: "#5C5C5C",
  light: "#F5F7F6",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function s(data: TemplateData, key: string, fallback = ""): string {
  const value = data[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function ctaButton(label: string, url: string, color: "green" | "orange" = "green"): string {
  if (!url) return "";
  const gradient =
    color === "orange"
      ? `background:#F28C28; background:linear-gradient(135deg, #F5A623 0%, #F28C28 55%, #D97417 100%);`
      : `background:#198754; background:linear-gradient(135deg, #2BA56D 0%, #198754 55%, #146C43 100%);`;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto 8px">
    <tr>
      <td align="center" style="border-radius:14px; ${gradient} box-shadow:0 6px 18px rgba(25,135,84,.35)">
        <a href="${esc(url)}" style="display:inline-block; padding:14px 30px; font-family:Segoe UI,Inter,Arial,sans-serif; font-size:15px; font-weight:700; color:#FFFFFF; text-decoration:none; letter-spacing:.3px">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

/**
 * Modern, responsive EMC-branded email shell.
 * Table based markup for maximum email-client compatibility.
 */
function layout(options: {
  title: string;
  eyebrow?: string;
  preheader?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaColor?: "green" | "orange";
  footnote?: string;
}): string {
  const year = new Date().getFullYear();
  const preheader = esc(options.preheader ?? options.title);
  const eyebrow = options.eyebrow
    ? `<p style="margin:0 0 14px; font-family:Segoe UI,Inter,Arial,sans-serif; font-size:11px; font-weight:800; letter-spacing:2.4px; text-transform:uppercase; color:${BRAND.orange}">${esc(options.eyebrow)}</p>`
    : "";

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<title>${esc(options.title)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .wrapper { width: 100% !important; padding: 10px 8px !important; }
    .card { border-radius: 14px !important; }
    .px-6 { padding-left: 20px !important; padding-right: 20px !important; }
    .h1 { font-size: 22px !important; line-height: 1.3 !important; }
    .brand-top { padding: 18px 16px !important; }
  }
  a { -webkit-text-size-adjust: 100%; }
</style>
</head>
<body style="margin:0;padding:0;background:#F5F7F6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}&nbsp;&nbsp;&zwnj;&nbsp;&nbsp;&zwnj;&nbsp;&nbsp;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7F6; padding:24px 10px">
<tr><td align="center">

<table class="wrapper card" role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(15,61,46,.14);border:1px solid #E6EBE8">

<!-- Header -->
<tr>
  <td class="brand-top" style="background:${BRAND.ink}; background:radial-gradient(1200px 260px at 20% -20%, #1E3B2A 0%, #171717 55%); padding:22px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle">
          <img src="${EMC_LOGO}" alt="EMC" width="132" style="display:block;width:132px;height:auto;border:0;outline:0;max-width:150px">
        </td>
        <td align="right" style="vertical-align:middle">
          <p style="margin:0;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#8BC34A">Talent Acquisition</p>
          <p style="margin:3px 0 0;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#C9D1CC">Portal · EMC</p>
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- Green / orange divider -->
<tr>
  <td style="line-height:0">
    <div style="height:5px;background:linear-gradient(90deg,${BRAND.green} 0%,${BRAND.green} 62%,${BRAND.orange} 62%,${BRAND.orangeDark} 100%)"></div>
  </td>
</tr>

<!-- Body -->
<tr>
  <td class="px-6" style="padding:30px 30px 8px">
    ${eyebrow}
    <h1 class="h1" style="margin:0 0 16px;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:26px;line-height:1.25;font-weight:800;color:${BRAND.ink};letter-spacing:-.2px">${esc(options.title)}</h1>
    <div style="font-family:Segoe UI,Inter,Arial,sans-serif;font-size:14px;line-height:1.75;color:#3B3B3B">
      ${options.body}
    </div>
    ${options.ctaLabel && options.ctaUrl ? ctaButton(options.ctaLabel, options.ctaUrl, options.ctaColor ?? "green") : ""}
    ${
      options.footnote
        ? `<p style="margin:20px 0 0;padding:14px 16px;background:#F5F7F6;border:1px solid #E6EBE8;border-left:3px solid ${BRAND.orange};border-radius:10px;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.muted}">${esc(options.footnote)}</p>`
        : ""
    }
  </td>
</tr>

<!-- Divider -->
<tr><td style="padding:22px 30px 0"><div style="border-top:1px solid #ECEFED"></div></td></tr>

<!-- Footer -->
<tr>
  <td class="px-6" style="padding:20px 30px 26px;background:#FFFFFF">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle">
          <p style="margin:0;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:13px;font-weight:800;color:${BRAND.ink};letter-spacing:.4px">EMC<span style="color:${BRAND.orange}">.</span> Talent Acquisition Portal</p>
          <p style="margin:4px 0 0;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:${BRAND.muted}">
            Ecometrics Consultant Pvt. Ltd. (EMC) &middot; Engineering &middot; GIS &middot; Planning &middot; Infrastructure<br>
            Need help? <a href="mailto:${esc(env.mailReplyTo)}" style="color:${BRAND.green};font-weight:700;text-decoration:none">${esc(env.mailReplyTo)}</a>
          </p>
          <p style="margin:10px 0 0;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:10px;color:#9AA3AD">
            &copy; ${year} EMC. All rights reserved. This is an automated message — please do not reply directly.
          </p>
        </td>
      </tr>
    </table>
  </td>
</tr>

</table>
</td></tr></table>
</body></html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px">${text}</p>`;
}

function detailTable(rows: Array<[string, unknown]>): string {
  const filtered = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!filtered.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #E6EBE8;border-radius:12px;overflow:hidden">${filtered
    .map(
      ([label, value], i) =>
        `<tr style="background:${i % 2 ? "#FAFBFA" : "#FFFFFF"}"><td style="padding:11px 14px;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${BRAND.muted};width:44%">${esc(label)}</td><td style="padding:11px 14px;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:13px;font-weight:600;color:${BRAND.ink}">${esc(value)}</td></tr>`,
    )
    .join("")}</table>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail(templateKey: string, data: TemplateData): RenderedEmail {
  const name = s(data, "name", "Candidate");
  const jobTitle = s(data, "jobTitle", "the position");
  const company = s(data, "companyName", "Ecometrics Consultant Pvt. Ltd. (EMC)");
  const appUrl = s(data, "appUrl", env.appUrl);
  const careerSiteUrl = s(data, "careerSiteUrl", env.careerSiteUrl);

  let subject = "";
  let html = "";

  switch (templateKey) {
    case "employee_update_invitation":
      subject = "Action required: update your EMC employee profile";
      html = layout({
        title: `Hello ${esc(name)}, please update your employee profile`,
        eyebrow: "Employee Information Update",
        preheader: "Your personal employee-information update link is ready.",
        body:
          p(
            `EMC is building a <strong>centralised CV databank</strong> for our employees. We request you to review and update your details and upload your latest CV.`,
          ) +
          detailTable([
            ["Employee ID", data.employeeCode],
            ["Official Email", data.email],
            ["Link Validity", "No expiry — valid until you submit"],
          ]) +
          p(`<strong>No sign-in or HR account is required.</strong> Use the secure button below.`) +
          p(`<strong>This secure link never expires.</strong> If your profile is not submitted, we'll send an automatic reminder every 3 days until you complete it.`) +
          p(`This secure link is unique to you and is used only for your profile update. Please do not forward it.`),
        ctaLabel: "Update my information",
        ctaUrl: s(data, "link"),
        ctaColor: "green",
        footnote: "If you received this email in error, please contact the HR team. This message contains confidential company information.",
      });
      break;

    case "employee_update_reminder": {
      const completion = s(data, "completion", "");
      const purpose = s(data, "purpose", "reminder");
      subject = purpose === "submit"
        ? "Reminder: please submit your EMC employee profile"
        : "Reminder: please update your EMC employee profile";
      html = layout({
        title: `Hello ${esc(name)}, this is a reminder to update your employee profile`,
        eyebrow: "Employee Profile Reminder",
        preheader: "Your personal employee-information link is ready.",
        body:
          p(
            `EMC is building a <strong>centralised CV databank</strong> for our employees. Our records show your profile is <strong>${completion ? `${esc(completion)}% complete` : "not yet complete"}</strong>.`,
          ) +
          detailTable([
            ["Employee ID", data.employeeCode],
            ["Official Email", data.email],
            ["Profile completion", completion ? `${esc(completion)}%` : "Not started"],
          ]) +
          p(`<strong>This secure link never expires.</strong> Use the button below to open the update page. Please note that a fresh link was generated for this reminder — earlier links are no longer valid.`) +
          p(`<strong>No sign-in or HR account is required.</strong> If the button does not work, copy and paste this URL into your browser:<br />${esc(s(data, "link"))}`),
        ctaLabel: "Update my information",
        ctaUrl: s(data, "link"),
        ctaColor: "green",
        footnote: "If you received this email in error, please contact the HR team. This message contains confidential company information.",
      });
      break;
    }

    case "employee_update_changes_requested": {
      const items = Array.isArray(data.notes) ? (data.notes as Array<{ label?: unknown; note?: unknown }>) : [];
      const rows = items
        .map(
          (item, i) =>
            `<tr style="background:${i % 2 ? "#FAFBFA" : "#FFFFFF"}"><td style="padding:11px 14px;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${BRAND.muted};width:44%">${esc(item?.label)}</td><td style="padding:11px 14px;font-family:Segoe UI,Inter,Arial,sans-serif;font-size:13px;font-weight:600;color:${BRAND.ink}">${esc(item?.note || "Please review and correct this field")}</td></tr>`,
        )
        .join("");
      const changesTable = rows
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #E6EBE8;border-radius:12px;overflow:hidden">${rows}</table>`
        : "";
      const introMessage = s(data, "message", "Our HR team reviewed your submission and marked a few items that need correction before it can be applied:");
      subject = "Action required: correct your EMC employee profile";
      html = layout({
        title: `Hello ${esc(name)}, HR requested a few corrections`,
        eyebrow: "Correction Requested",
        preheader: "Please fix the highlighted items and resubmit your employee profile.",
        body:
          p(esc(introMessage)) +
          changesTable +
          detailTable([
            ["Employee ID", data.employeeCode],
            ["Official Email", data.email],
          ]) +
          p(`<strong>The secure link never expires.</strong> Use the button below to open the update page and submit the corrected information. A fresh link was generated for this request — earlier links are no longer valid.`) +
          p(`<strong>No sign-in or HR account is required.</strong> If the button does not work, copy and paste this URL into your browser:<br />${esc(s(data, "link"))}`),
        ctaLabel: "Update my information",
        ctaUrl: s(data, "link"),
        ctaColor: "green",
        footnote: "If you received this email in error, please contact the HR team. This message contains confidential company information.",
      });
      break;
    }

    case "employee_update_confirmation":
      subject = "Your EMC employee profile has been updated";
      html = layout({
        title: "Profile update received",
        eyebrow: "Thank you",
        body:
          p(`Dear ${esc(name)},`) +
          p(`<strong>Your employee information has been submitted successfully.</strong>`) +
          p(`Our HR team has been notified and will review the update if required. Thank you for keeping your profile current.`),
        ctaLabel: "Open EMC careers",
        ctaUrl: appUrl,
      });
      break;

    case "candidate_email_otp":
      subject = `${s(data, "code", "")} is your EMC verification code`;
      html = layout({
        title: "Verify your email address",
        eyebrow: "One-Time Password",
        preheader: "Use this one-time code to access the Talent Acquisition Portal.",
        body:
          p(`Hello ${esc(name)},`) +
          p(`Use the one-time code below to verify your email address and continue on the EMC Talent Acquisition Portal:`) +
          `<div style="margin:22px 0;padding:18px 16px;background:#F0FAF4;border:2px dashed #198754;border-radius:14px;text-align:center">
             <div style="font-family:Consolas,Monaco,monospace;font-size:34px;letter-spacing:10px;font-weight:800;color:#146C43">${esc(s(data, "code"))}</div>
           </div>` +
          detailTable([["Valid for", s(data, "expiresIn", `${env.otpTtlMinutes} minutes`)]]) +
          p(`If you did not request this code, simply ignore this email — your account stays safe.`),
        ctaColor: "green",
      });
      break;

    case "application_confirmation":
      subject = `Application received: ${jobTitle} at EMC`;
      html = layout({
        title: "Your application has been received",
        eyebrow: "We have your application",
        preheader: `Your application for ${jobTitle} has been received by EMC.`,
        body:
          p(`Dear ${esc(name)},`) +
          p(`Thank you for applying for <strong>${esc(jobTitle)}</strong> at ${esc(company)}. We have received your application.`) +
          detailTable([
            ["Application ID", data.applicationCode],
            ["Position", jobTitle],
            ["Department", data.department],
            ["Applied On", data.appliedAt ? new Date(String(data.appliedAt)).toLocaleString() : ""],
          ]) +
          p(`Our recruitment team will review your profile. If your application progresses, we will reach out with the next steps.`),
        ctaLabel: "View my application",
        ctaUrl: s(data, "link", careerSiteUrl),
        ctaColor: "orange",
      });
      break;

    case "candidate_shortlisted":
      subject = `You have been shortlisted for ${jobTitle}`;
      html = layout({
        title: "Good news — you have been shortlisted",
        eyebrow: "Congratulations",
        preheader: `Your application for ${jobTitle} has been shortlisted.`,
        body:
          p(`Dear ${esc(name)},`) +
          p(`We are pleased to let you know that your application for <strong>${esc(jobTitle)}</strong> has been shortlisted.`) +
          p(`Our recruitment team will contact you shortly to arrange the next stage of the selection process.`),
        ctaLabel: "View my applications",
        ctaUrl: s(data, "link", careerSiteUrl),
        ctaColor: "orange",
      });
      break;

    case "interview_scheduled_interviewer":
    case "interview_rescheduled_interviewer":
      subject = `Interview ${templateKey === "interview_rescheduled_interviewer" ? "rescheduled" : "assigned"}: ${s(data, "candidateName", "Candidate")} · ${jobTitle}`;
      html = layout({
        title: templateKey === "interview_rescheduled_interviewer" ? "Your interview has been rescheduled" : "Interview assigned to you",
        eyebrow: "Interviewer Brief",
        preheader: `Interview brief for ${jobTitle}.`,
        body:
          p(`Dear ${esc(name)},`) +
          p(`You have been assigned as <strong>${esc(s(data, "interviewType", "Interviewer"))}</strong> for the interview of <strong>${esc(s(data, "candidateName", "the candidate"))}</strong> for the role of <strong>${esc(jobTitle)}</strong>. Here are the details to prepare:`) +
          detailTable([
            ["Candidate", s(data, "candidateName", "—")],
            ["Round", data.round],
            ["Date & Time", data.scheduledAt ? new Date(String(data.scheduledAt)).toLocaleString() : ""],
            ["Time Zone", data.timezone],
            ["Mode", data.mode],
            ["Location", data.location],
            ["Meeting Link", data.meetingLink],
            ["Interview Type", s(data, "interviewType", "INDIVIDUAL")],
          ]) +
          (data.instructions ? p(`<strong>Instructions:</strong> ${esc(data.instructions)}`) : "") +
          p("Please review the candidate profile and join the interview on time."),
        ctaLabel: data.meetingLink ? "Join Interview" : undefined,
        ctaUrl: data.meetingLink ? s(data, "meetingLink") : undefined,
        ctaColor: "green",
      });
      break;

    case "interview_scheduled":
    case "interview_rescheduled":
      subject = `Interview ${templateKey === "interview_rescheduled" ? "rescheduled" : "scheduled"}: ${jobTitle}`;
      html = layout({
        title: templateKey === "interview_rescheduled" ? "Your interview has been rescheduled" : "Your interview is scheduled",
        eyebrow: "Interview Details",
        preheader: `Interview details for ${jobTitle}.`,
        body:
          p(`Dear ${esc(name)},`) +
          p(`Your interview for <strong>${esc(jobTitle)}</strong> has been ${templateKey === "interview_rescheduled" ? "rescheduled" : "scheduled"}. Here are the details:`) +
          detailTable([
            ["Round", data.round],
            ["Date & Time", data.scheduledAt ? new Date(String(data.scheduledAt)).toLocaleString() : ""],
            ["Time Zone", data.timezone],
            ["Mode", data.mode],
            ["Location", data.location],
            ["Meeting Link", data.meetingLink],
            ["Interviewer", data.interviewerName],
          ]) +
          (data.instructions ? p(`<strong>Instructions:</strong> ${esc(data.instructions)}`) : "") +
          p(`Please join a few minutes early. If you cannot attend, contact us as soon as possible.`),
        ctaLabel: data.meetingLink ? "Join Interview" : undefined,
        ctaUrl: data.meetingLink ? s(data, "meetingLink") : undefined,
        ctaColor: "green",
      });
      break;

    case "interview_cancelled":
      subject = `Interview cancelled: ${jobTitle}`;
      html = layout({
        title: "Your interview has been cancelled",
        eyebrow: "Cancellation Notice",
        body:
          p(`Dear ${esc(name)},`) +
          p(`Your interview for <strong>${esc(jobTitle)}</strong> has been cancelled.`) +
          (data.reason ? p(`<strong>Reason:</strong> ${esc(data.reason)}`) : "") +
          p(`Our recruitment team will contact you regarding the next steps.`),
        footnote: "If you have questions, please reach out to the HR team.",
      });
      break;

    case "candidate_selected":
      subject = `Congratulations — you have been selected for ${jobTitle}`;
      html = layout({
        title: "You have been selected",
        eyebrow: "Congratulations",
        preheader: `Congratulations! You have been selected for ${jobTitle}.`,
        body:
          p(`Dear ${esc(name)},`) +
          p(`We are absolutely delighted to inform you that you have been <strong>selected for ${esc(jobTitle)}</strong> at ${esc(company)}.`) +
          p(`Our HR team will share your offer details and onboarding instructions shortly.`),
        ctaLabel: "View my applications",
        ctaUrl: s(data, "link", careerSiteUrl),
        ctaColor: "orange",
      });
      break;

    case "candidate_rejected":
      subject = `Update on your application for ${jobTitle}`;
      html = layout({
        title: "Update on your application",
        eyebrow: "Application Status",
        body:
          p(`Dear ${esc(name)},`) +
          p(`Thank you for your interest in the <strong>${esc(jobTitle)}</strong> role and for the time you invested in the process.`) +
          p(`After careful consideration, we will not be able to move your application forward at this time.`) +
          (data.reason ? p(`<strong>Feedback:</strong> ${esc(data.reason)}`) : "") +
          p(`We encourage you to keep an eye on future openings that match your experience — we would love to see you apply again.`),
        ctaLabel: "View open positions",
        ctaUrl: s(data, "link", careerSiteUrl),
      });
      break;

    case "offer_letter":
      subject = `Your offer from EMC — ${jobTitle}`;
      html = layout({
        title: "Your offer of employment",
        eyebrow: "Offer of Employment",
        preheader: `Your offer from EMC for ${jobTitle} is attached.`,
        body:
          p(`Dear ${esc(name)},`) +
          p(`We are pleased to extend an offer for the position of <strong>${esc(jobTitle)}</strong> at ${esc(company)}.`) +
          detailTable([
            ["Designation", data.designation],
            ["Department", data.department],
            ["Annual CTC", data.ctc],
            ["Date of Joining", data.joiningDate ? new Date(String(data.joiningDate)).toLocaleDateString() : ""],
            ["Work Location", data.workLocation],
            ["Offer Valid Until", data.expiryDate ? new Date(String(data.expiryDate)).toLocaleDateString() : ""],
          ]) +
          p(`The offer letter PDF is attached to this email. Please review and respond using the secure button below.`),
        ctaLabel: "Review and respond",
        ctaUrl: s(data, "link"),
        ctaColor: "orange",
        footnote: "This offer is strictly confidential and intended only for the addressed recipient.",
      });
      break;

    case "offer_accepted":
      subject = `Offer accepted: ${name} — ${jobTitle}`;
      html = layout({
        title: "Candidate accepted the offer",
        eyebrow: "Offer Update",
        body:
          p(`<strong>${esc(name)}</strong> has accepted the offer for <strong>${esc(jobTitle)}</strong>.`) +
          detailTable([
            ["Application ID", data.applicationCode],
            ["Designation", data.designation],
            ["Date of Joining", data.joiningDate ? new Date(String(data.joiningDate)).toLocaleDateString() : ""],
          ]) +
          p(`Please coordinate the document collection and onboarding steps with the candidate.`),
        ctaLabel: "Open candidate profile",
        ctaUrl: s(data, "link"),
      });
      break;

    case "offer_reminder":
      subject = `Reminder: your offer from EMC - ${s(data, "jobTitle", "position")}`;
      html = layout({
        title: "Reminder to respond to your offer",
        eyebrow: "Offer Reminder",
        preheader: "Please review the offer and respond at your earliest convenience.",
        body:
          p(`Dear ${esc(name)},`) +
          p(`This is a gentle reminder that we have not yet received your response for <strong>${esc(jobTitle)}</strong> at ${esc(company)}.`) +
          detailTable([
            ["Designation", data.designation],
            ["Offer Valid Until", data.expiryDate ? new Date(String(data.expiryDate)).toLocaleDateString() : "Not specified"],
          ]) +
          p(`Please use the secure link below to accept or decline the offer.`),
        ctaLabel: "Review and respond to the offer",
        ctaUrl: s(data, "link", careerSiteUrl),
        ctaColor: "orange",
      });
      break;

    case "document_upload_request":
      subject = "Action required: upload your onboarding documents";
      html = layout({
        title: "Please upload your onboarding documents",
        eyebrow: "Document Collection",
        preheader: "Complete your onboarding by uploading the required documents.",
        body:
          p(`Dear ${esc(name)},`) +
          p(`Welcome aboard! To complete your onboarding for <strong>${esc(jobTitle)}</strong>, please upload the required documents through your secure document portal.`) +
          detailTable([
            ["Application ID", data.applicationCode],
            ["Documents Required", data.documentCount],
            ["Link Expires", data.expiresAt ? new Date(String(data.expiresAt)).toLocaleString() : ""],
          ]) +
          p(`All documents are transmitted over a secure channel and are visible only to authorised EMC HR staff.`),
        ctaLabel: "Open document portal",
        ctaUrl: s(data, "link"),
        ctaColor: "green",
      });
      break;

    case "document_accepted":
      subject = `Document accepted: ${s(data, "documentName", "your document")}`;
      html = layout({
        title: "Document verified and accepted",
        eyebrow: "Document Accepted",
        body: p(`Dear ${esc(name)},`) + detailTable([["Document", data.documentName], ["Status", "Accepted"]]) + p(`Thank you — no further action is required for this document.`),
        ctaLabel: "Open document portal",
        ctaUrl: s(data, "link"),
      });
      break;

    case "document_rejected":
      subject = `Document needs attention: ${s(data, "documentName", "your document")}`;
      html = layout({
        title: "Document could not be accepted",
        eyebrow: "Action Required",
        body:
          p(`Dear ${esc(name)},`) +
          detailTable([["Document", data.documentName], ["Remarks", data.remarks]]) +
          p(`Please contact the HR team if you need any assistance.`),
        ctaLabel: "Open document portal",
        ctaUrl: s(data, "link"),
        ctaColor: "orange",
      });
      break;

    case "document_reupload_request":
      subject = `Re-upload required: ${s(data, "documentName", "your document")}`;
      html = layout({
        title: "Please re-upload your document",
        eyebrow: "Action Required",
        body:
          p(`Dear ${esc(name)},`) +
          detailTable([["Document", data.documentName], ["Reason", data.remarks]]) +
          p(`Use the secure button below to upload a clearer or corrected copy.`),
        ctaLabel: "Re-upload document",
        ctaUrl: s(data, "link"),
        ctaColor: "orange",
      });
      break;

    case "pending_document_reminder":
      subject = "Reminder: pending onboarding documents";
      html = layout({
        title: "Reminder: documents pending",
        eyebrow: "Friendly Reminder",
        body:
          p(`Dear ${esc(name)},`) +
          p(`We are still awaiting the following onboarding document(s):`) +
          detailTable([["Pending Documents", data.pendingDocuments], ["Application ID", data.applicationCode]]) +
          p(`Please upload them at the earliest so we can complete your onboarding.`),
        ctaLabel: "Open document portal",
        ctaUrl: s(data, "link"),
        ctaColor: "orange",
      });
      break;

    case "hr_invitation": {
      const tempPassword = s(data, "password", "");
      subject = "You have been invited to the EMC Talent Acquisition Portal";
      html = layout({
        title: "Welcome to the EMC HR team",
        eyebrow: "HR Portal Invitation",
        preheader: "Your EMC HR portal account is ready.",
        body:
          p(`Hello ${esc(name)},`) +
          p(`You have been invited to join the EMC Talent Acquisition Portal as <strong>${esc(s(data, "roleName", "an HR user"))}</strong>.`) +
          (tempPassword
            ? detailTable([["Work email", data.email], ["Temporary password", tempPassword]]) +
              p(`Use the temporary password above with your work email to sign in. You may be asked to change it after your first sign-in. A one-time sign-in code by email is also available as an alternative.`) +
              p(`<strong>Keep this password private.</strong> If it does not work, use the OTP option on the login page or contact the IT administrator.`)
            : p(`Sign in with this email address and a 6-digit code from your authenticator app — no password is required. Use the separate setup link in your email to activate your authenticator.`)),
        ctaLabel: "Open HR portal",
        ctaUrl: s(data, "link", `${appUrl}/hr/login`),
        ctaColor: "green",
      });
      break;
    }

    case "hr_totp_enrollment":
      subject = "Set up your authenticator for the EMC HR portal";
      html = layout({
        title: "Set up your authenticator",
        eyebrow: "HR Portal Security Setup",
        preheader: "Your one-time authenticator setup link is ready.",
        body:
          p(`Hello ${esc(name)},`) +
          p(`Your administrator has authorized authenticator setup for your EMC HR account.`) +
          detailTable([
            ["Account email", data.email],
            ["Link validity", s(data, "expiresIn", "10 minutes")],
          ]) +
          p(`Open the secure link below, scan the QR code with Google Authenticator, Microsoft Authenticator, Zoho OneAuth or any RFC 6238 compatible app, then enter the 6-digit code to activate.`) +
          p(`<strong>This link is unique to you, expires soon and can only be used once.</strong> Do not forward it. If you did not expect this email, contact your administrator.`),
        ctaLabel: "Set up authenticator",
        ctaUrl: s(data, "link"),
        ctaColor: "green",
      });
      break;

    case "hr_otp":
      subject = `${s(data, "code", "")} is your EMC HR login code`;
      html = layout({
        title: "HR portal sign-in code",
        eyebrow: "HR Portal Sign-In",
        preheader: "Your one-time HR portal sign-in code.",
        body:
          p(`Hello ${esc(name)},`) +
          p(`Use the one-time code below to sign in to the EMC HR Management Portal:`) +
          `<div style="margin:22px 0;padding:18px 16px;background:#FFF4E8;border:2px dashed #F28C28;border-radius:14px;text-align:center">
             <div style="font-family:Consolas,Monaco,monospace;font-size:34px;letter-spacing:10px;font-weight:800;color:#D97417">${esc(s(data, "code"))}</div>
           </div>` +
          detailTable([["Valid for", s(data, "expiresIn", `${env.otpTtlMinutes} minutes`)]]) +
          p(`If you did not attempt to sign in, contact the system administrator immediately.`),
        ctaColor: "orange",
      });
      break;

    case "hr_notification":
    default: {
      const link = s(data, "link", "");
      subject = s(data, "subject", "EMC Talent Acquisition notification");
      html = layout({
        title: s(data, "title", "EMC Talent Acquisition Portal"),
        eyebrow: "Notification",
        body: p(esc(s(data, "message", "You have a new notification in the HR portal."))),
        ctaLabel: link ? s(data, "ctaLabel", "Open link") : undefined,
        ctaUrl: link || undefined,
      });
      break;
    }
  }

  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { subject, html, text };
}
